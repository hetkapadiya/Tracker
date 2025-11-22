import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { google } from "googleapis";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

// Allow frontend calls
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "https://yourstracker.netlify.app",
    credentials: true,
  })
);
app.use(express.json());

// ---------------------------
// Google OAuth setup
// ---------------------------

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Demo only: store tokens in memory
let userTokens = null;

// Start Google login
app.get("/auth/google", (req, res) => {
  const scopes = ["https://www.googleapis.com/auth/calendar.events"];

  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    scope: scopes,
    prompt: "consent",
  });

  res.redirect(url);
});

// Google callback
app.get("/auth/google/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) {
    return res.status(400).send("Missing code");
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    userTokens = tokens;
    oauth2Client.setCredentials(tokens);
    console.log("Got Google tokens");

    const redirectUrl =
      (process.env.FRONTEND_URL || "http://localhost:5500") +
      "/index.html?connected=1";

    res.redirect(redirectUrl);
  } catch (err) {
    console.error("OAuth error:", err);
    res.status(500).send("Authentication failed");
  }
});

// Check if connected
app.get("/api/status", (req, res) => {
  res.json({
    connected: !!userTokens,
  });
});

// Sync a habit's completed dates to Google Calendar
app.post("/api/sync-habit", async (req, res) => {
  if (!userTokens) {
    return res.status(401).json({ error: "Not connected to Google" });
  }

  const { habitName, completedDates } = req.body;

  if (!habitName || !Array.isArray(completedDates)) {
    return res.status(400).json({ error: "Invalid request body" });
  }

  try {
    oauth2Client.setCredentials(userTokens);
    const calendar = google.calendar({ version: "v3", auth: oauth2Client });

    const createdIds = [];

    for (const dateStr of completedDates) {
      // dateStr = "YYYY-MM-DD"
      const [year, month, day] = dateStr.split("-");
      const startDate = new Date(Date.UTC(year, month - 1, day));
      const endDate = new Date(Date.UTC(year, month - 1, Number(day) + 1));

      const event = {
        summary: `Habit: ${habitName} ✅`,
        description: "Created by Habit Tracker app",
        start: { date: dateStr },
        end: { date: formatDateUTC(endDate) },
      };

      const response = await calendar.events.insert({
        calendarId: "primary",
        requestBody: event,
      });

      createdIds.push(response.data.id);
    }

    res.json({
      success: true,
      createdCount: createdIds.length,
      eventIds: createdIds,
    });
  } catch (err) {
    console.error("Calendar sync error:", err.message);
    res.status(500).json({ error: "Failed to sync with Google Calendar" });
  }
});

function formatDateUTC(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});


