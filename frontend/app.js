// ---------------------------
// Config
// ---------------------------
const BACKEND_URL = "https://tracker-d08p.onrender.com";

// ---------------------------
// Storage
// ---------------------------
const STORAGE_KEY = "habitTrackerData_v1";

function loadData() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return { habits: [], records: {} };
  try {
    return JSON.parse(raw);
  } catch {
    return { habits: [], records: {} };
  }
}

function saveData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// ---------------------------
// State
// ---------------------------
let state = loadData();
// state = { habits:[{id,name,color,createdAt}], records:{ "YYYY-MM-DD":{habitId:true} } }

let selectedHabitId = state.habits[0]?.id || null;
const today = new Date();
let currentMonth = today.getMonth();
let currentYear = today.getFullYear();
let chartInstance = null;

// ---------------------------
// DOM
// ---------------------------
const habitForm = document.getElementById("habit-form");
const habitNameInput = document.getElementById("habit-name");
const habitList = document.getElementById("habit-list");
const selectedHabitNameEl = document.getElementById("selected-habit-name");

const prevMonthBtn = document.getElementById("prev-month");
const nextMonthBtn = document.getElementById("next-month");
const calendarTitleEl = document.getElementById("calendar-title");
const calendarGridEl = document.getElementById("calendar-grid");

const statTotalHabitsEl = document.getElementById("stat-total-habits");
const statTodayCompletedEl = document.getElementById("stat-today-completed");
const statLast7El = document.getElementById("stat-last7");

const exportBtn = document.getElementById("export-data");
const clearBtn = document.getElementById("clear-data");
const dataOutputEl = document.getElementById("data-output");

const googleStatusEl = document.getElementById("google-status");
const connectGoogleBtn = document.getElementById("connect-google");
const syncHabitBtn = document.getElementById("sync-habit");

// ---------------------------
// Utils
// ---------------------------
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function* dateRangeDays(from, to) {
  const cur = new Date(from);
  while (cur <= to) {
    yield new Date(cur);
    cur.setDate(cur.getDate() + 1);
  }
}

function randomColor() {
  const colors = ["#22c55e", "#38bdf8", "#f97316", "#eab308", "#a855f7"];
  return colors[Math.floor(Math.random() * colors.length)];
}

// ---------------------------
// Habits
// ---------------------------
habitForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const name = habitNameInput.value.trim();
  if (!name) return;

  const id = "habit_" + Date.now();
  state.habits.push({
    id,
    name,
    color: randomColor(),
    createdAt: new Date().toISOString(),
  });
  selectedHabitId = id;
  saveData();
  habitNameInput.value = "";
  renderHabits();
  renderCalendar();
  renderStats();
  updateChart();
});

function renderHabits() {
  habitList.innerHTML = "";
  if (state.habits.length === 0) {
    habitList.innerHTML = "<li>No habits yet. Add one above.</li>";
    selectedHabitNameEl.textContent = "None";
    return;
  }

  for (const habit of state.habits) {
    const li = document.createElement("li");
    li.className = "habit-item" + (habit.id === selectedHabitId ? " active" : "");

    const nameDiv = document.createElement("div");
    nameDiv.className = "habit-name";

    const colorDot = document.createElement("span");
    colorDot.className = "habit-color";
    colorDot.style.backgroundColor = habit.color;

    const nameSpan = document.createElement("span");
    nameSpan.textContent = habit.name;

    nameDiv.appendChild(colorDot);
    nameDiv.appendChild(nameSpan);

    const actions = document.createElement("div");
    actions.className = "habit-actions";

    const renameBtn = document.createElement("button");
    renameBtn.textContent = "Rename";
    renameBtn.className = "rename-btn";
    renameBtn.onclick = (e) => {
      e.stopPropagation();
      const newName = prompt("New habit name:", habit.name);
      if (!newName) return;
      habit.name = newName.trim();
      saveData();
      renderHabits();
      renderStats();
    };

    const delBtn = document.createElement("button");
    delBtn.textContent = "Delete";
    delBtn.className = "delete-btn";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (!confirm("Delete this habit and its records?")) return;

      state.habits = state.habits.filter((h) => h.id !== habit.id);

      for (const [dateKey, rec] of Object.entries(state.records)) {
        if (rec[habit.id]) {
          delete rec[habit.id];
          if (Object.keys(rec).length === 0) {
            delete state.records[dateKey];
          }
        }
      }

      if (selectedHabitId === habit.id) {
        selectedHabitId = state.habits[0]?.id || null;
      }

      saveData();
      renderHabits();
      renderCalendar();
      renderStats();
      updateChart();
    };

    actions.appendChild(renameBtn);
    actions.appendChild(delBtn);

    li.appendChild(nameDiv);
    li.appendChild(actions);

    li.onclick = () => {
      selectedHabitId = habit.id;
      renderHabits();
      renderCalendar();
    };

    habitList.appendChild(li);
  }

  const sel = state.habits.find((h) => h.id === selectedHabitId);
  selectedHabitNameEl.textContent = sel ? sel.name : "None";
}

// ---------------------------
// Calendar
// ---------------------------
prevMonthBtn.onclick = () => {
  currentMonth--;
  if (currentMonth < 0) {
    currentMonth = 11;
    currentYear--;
  }
  renderCalendar();
};

nextMonthBtn.onclick = () => {
  currentMonth++;
  if (currentMonth > 11) {
    currentMonth = 0;
    currentYear++;
  }
  renderCalendar();
};

function renderCalendar() {
  calendarGridEl.innerHTML = "";

  const monthNames = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
  ];
  calendarTitleEl.textContent = `${monthNames[currentMonth]} ${currentYear}`;

  const weekdays = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  for (const w of weekdays) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell disabled";
    cell.textContent = w;
    calendarGridEl.appendChild(cell);
  }

  const firstDay = new Date(currentYear, currentMonth, 1);
  const startWeekday = firstDay.getDay();
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const totalDays = lastDay.getDate();

  for (let i = 0; i < startWeekday; i++) {
    const empty = document.createElement("div");
    empty.className = "calendar-cell disabled";
    calendarGridEl.appendChild(empty);
  }

  for (let day = 1; day <= totalDays; day++) {
    const cell = document.createElement("div");
    cell.className = "calendar-cell";
    cell.textContent = day;

    const dateObj = new Date(currentYear, currentMonth, day);
    const key = formatDate(dateObj);

    if (
      dateObj.getFullYear() === today.getFullYear() &&
      dateObj.getMonth() === today.getMonth() &&
      dateObj.getDate() === today.getDate()
    ) {
      cell.classList.add("today");
    }

    if (selectedHabitId) {
      const done = !!(state.records[key] && state.records[key][selectedHabitId]);
      cell.classList.add(done ? "done" : "not-done");
      cell.onclick = () => toggleHabitDay(selectedHabitId, key);
    } else {
      cell.classList.add("disabled");
    }

    calendarGridEl.appendChild(cell);
  }
}

function toggleHabitDay(habitId, dateKey) {
  if (!state.records[dateKey]) {
    state.records[dateKey] = {};
  }

  if (state.records[dateKey][habitId]) {
    delete state.records[dateKey][habitId];
    if (Object.keys(state.records[dateKey]).length === 0) {
      delete state.records[dateKey];
    }
  } else {
    state.records[dateKey][habitId] = true;
  }

  saveData();
  renderCalendar();
  renderStats();
  updateChart();
}

// ---------------------------
// Stats & Chart
// ---------------------------
function renderStats() {
  statTotalHabitsEl.textContent = state.habits.length;

  const todayKey = formatDate(today);
  const todayRecords = state.records[todayKey] || {};
  statTodayCompletedEl.textContent = Object.keys(todayRecords).length;

  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 6);

  let totalSlots = 0;
  let filled = 0;

  for (const d of dateRangeDays(start, end)) {
    const key = formatDate(d);
    const rec = state.records[key] || {};
    totalSlots += state.habits.length;
    filled += Object.keys(rec).length;
  }

  const pct = totalSlots === 0 ? 0 : Math.round((filled / totalSlots) * 100);
  statLast7El.textContent = `${pct}%`;
}

function buildChartData() {
  const labels = [];
  const values = [];

  const end = new Date(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 29);

  for (const d of dateRangeDays(start, end)) {
    const key = formatDate(d);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);

    const rec = state.records[key] || {};
    const total = state.habits.length;
    const completed = Object.keys(rec).length;
    const v = total === 0 ? 0 : Math.round((completed / total) * 100);
    values.push(v);
  }

  return { labels, values };
}

function updateChart() {
  const ctx = document.getElementById("progress-chart").getContext("2d");
  const { labels, values } = buildChartData();

  if (chartInstance) {
    chartInstance.data.labels = labels;
    chartInstance.data.datasets[0].data = values;
    chartInstance.update();
    return;
  }

  chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Completion %",
          data: values,
          tension: 0.3,
        },
      ],
    },
    options: {
      scales: {
        y: {
          min: 0,
          max: 100,
          ticks: { stepSize: 20 },
        },
      },
    },
  });
}

// ---------------------------
// Data export / clear
// ---------------------------
exportBtn.onclick = () => {
  dataOutputEl.value = JSON.stringify(state, null, 2);
};

clearBtn.onclick = () => {
  if (!confirm("Clear ALL data and habits?")) return;
  state = { habits: [], records: {} };
  selectedHabitId = null;
  saveData();
  renderHabits();
  renderCalendar();
  renderStats();
  updateChart();
  dataOutputEl.value = "";
};

// ---------------------------
// Google Calendar integration
// ---------------------------
async function checkGoogleStatus() {
  try {
    const res = await fetch(`${BACKEND_URL}/api/status`);
    const data = await res.json();
    googleStatusEl.textContent = data.connected
      ? "Connected to Google Calendar"
      : "Not connected";
  } catch {
    googleStatusEl.textContent = "Backend not reachable";
  }
}

connectGoogleBtn.onclick = () => {
  window.location.href = `${BACKEND_URL}/auth/google`;
};

syncHabitBtn.onclick = async () => {
  if (!selectedHabitId) {
    alert("Select a habit first.");
    return;
  }

  const habit = state.habits.find((h) => h.id === selectedHabitId);
  if (!habit) {
    alert("Invalid habit.");
    return;
  }

  const completedDates = [];
  for (const [dateKey, rec] of Object.entries(state.records)) {
    if (rec[selectedHabitId]) completedDates.push(dateKey);
  }

  if (completedDates.length === 0) {
    alert("No completed days for this habit.");
    return;
  }

  if (
    !confirm(
      `Sync ${completedDates.length} days to Google Calendar for "${habit.name}"?`
    )
  ) {
    return;
  }

  try {
    const res = await fetch(`${BACKEND_URL}/api/sync-habit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ habitName: habit.name, completedDates }),
    });

    const data = await res.json();
    if (res.ok) {
      alert(`Synced! Created ${data.createdCount} events.`);
    } else {
      alert(`Failed to sync: ${data.error || "Unknown error"}`);
    }
  } catch (err) {
    alert("Could not reach backend. Is it running?");
  }
};

// ---------------------------
// Init
// ---------------------------
function init() {
  renderHabits();
  renderCalendar();
  renderStats();
  updateChart();
  checkGoogleStatus();

  const params = new URLSearchParams(window.location.search);
  if (params.get("connected") === "1") {
    window.history.replaceState({}, "", "index.html");
    checkGoogleStatus();
  }
}

init();

