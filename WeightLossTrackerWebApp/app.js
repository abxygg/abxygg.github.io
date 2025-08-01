// Main JavaScript for the fitness tracker web application.

// Global variables for static plan data and Chart instances
let appData = null;
let weightChart = null;
let nutritionChart = null;
const workoutCharts = {};
let dashboardChart = null;

// Utility: parse date strings to comparable numbers for sorting
function parseDate(str) {
  return new Date(str);
}

// -------------------- LocalStorage Helpers --------------------

function getWeightEntries() {
  return JSON.parse(localStorage.getItem('weightEntries') || '[]');
}

function saveWeightEntries(entries) {
  localStorage.setItem('weightEntries', JSON.stringify(entries));
}

function getFoodEntries() {
  return JSON.parse(localStorage.getItem('foodEntries') || '[]');
}

function saveFoodEntries(entries) {
  localStorage.setItem('foodEntries', JSON.stringify(entries));
}

function getWorkoutLogs() {
  return JSON.parse(localStorage.getItem('workoutLogs') || '{}');
}

function saveWorkoutLogs(logs) {
  localStorage.setItem('workoutLogs', JSON.stringify(logs));
}

function getPurchasedItems() {
  return JSON.parse(localStorage.getItem('purchasedItems') || '{}');
}

function savePurchasedItems(obj) {
  localStorage.setItem('purchasedItems', JSON.stringify(obj));
}

// -------------------- Initialization --------------------

document.addEventListener('DOMContentLoaded', () => {
  // Load static app data from JSON
  fetch('app_data.json')
    .then(response => response.json())
    .then(data => {
      appData = data;
      initNavigation();
      renderWeightSection();
      renderWorkoutsTable();
      renderNutritionSection();
      renderGrocerySection();
      renderSchedulerSection();
      renderDashboardSection();
      setupGroceryForm();
      setupClearButtons();
    })
    .catch(err => {
      console.error('Failed to load app_data.json', err);
    });
});

// Setup navigation tab switching
function initNavigation() {
  const navButtons = document.querySelectorAll('#tab-nav button');
  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const section = btn.getAttribute('data-section');
      document.querySelectorAll('.tab-section').forEach(sec => {
        if (sec.id === section) {
          sec.classList.add('active');
        } else {
          sec.classList.remove('active');
        }
      });
    });
  });
}

// -------------------- Weight Section --------------------

function renderWeightSection() {
  const entries = getWeightEntries().sort((a, b) => parseDate(a.date) - parseDate(b.date));
  updateWeightSummary(entries);
  updateWeightChart(entries);
  // Setup form
  const form = document.getElementById('weight-form');
  form.onsubmit = evt => {
    evt.preventDefault();
    const dateStr = document.getElementById('weight-date').value;
    const weightVal = parseFloat(document.getElementById('weight-value').value);
    if (!dateStr || isNaN(weightVal)) return;
    // Add or replace entry
    const newEntries = entries.filter(e => e.date !== dateStr);
    newEntries.push({ date: dateStr, weight: weightVal });
    newEntries.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    saveWeightEntries(newEntries);
    // Reset form
    form.reset();
    // Re-render
    renderWeightSection();
  };
}

function updateWeightSummary(entries) {
  const summaryDiv = document.getElementById('weight-summary');
  summaryDiv.innerHTML = '';
  if (entries.length === 0) return;
  const latest = entries[entries.length - 1];
  // Find entry 7 days prior
  let prev = null;
  for (let i = entries.length - 2; i >= 0; i--) {
    const diffMs = parseDate(latest.date) - parseDate(entries[i].date);
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    if (diffDays >= 7) {
      prev = entries[i];
      break;
    }
  }
  let changeText = '';
  if (prev) {
    const change = (latest.weight - prev.weight).toFixed(1);
    const sign = change > 0 ? '+' : '';
    changeText = `<p>Change (7d): <strong style="color: ${change < 0 ? 'green' : (change > 0 ? 'red' : 'inherit')}">${sign}${change} lb</strong></p>`;
  }
  summaryDiv.innerHTML = `<p>Current Weight: <strong>${latest.weight.toFixed(1)} lb</strong></p>${changeText}`;
}

function updateWeightChart(entries) {
  const ctx = document.getElementById('weightChart').getContext('2d');
  // Prepare data arrays
  const labels = entries.map(e => e.date);
  const weights = entries.map(e => e.weight);
  const movingAvg = [];
  for (let i = 6; i < weights.length; i++) {
    const slice = weights.slice(i - 6, i + 1);
    const sum = slice.reduce((a, b) => a + b, 0);
    movingAvg.push((sum / 7).toFixed(2));
  }
  const avgLabels = labels.slice(6);
  const datasets = [];
  if (labels.length > 0) {
    datasets.push({
      label: 'Weight',
      data: weights,
      borderColor: 'rgba(53, 162, 235, 1)',
      backgroundColor: 'rgba(53, 162, 235, 0.2)',
      tension: 0.3,
    });
  }
  if (movingAvg.length > 0) {
    datasets.push({
      label: '7-day Avg',
      data: Array(6).fill(null).concat(movingAvg),
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      borderDash: [5, 5],
      tension: 0.3,
    });
  }
  if (weightChart) {
    weightChart.data.labels = labels;
    weightChart.data.datasets = datasets;
    weightChart.update();
  } else {
    weightChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: datasets,
      },
      options: {
        responsive: true,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'top',
          },
          title: {
            display: false,
          },
        },
        scales: {
          x: {
            title: {
              display: true,
              text: 'Date',
            },
          },
          y: {
            title: {
              display: true,
              text: 'Weight (lb)',
            },
          },
        },
      },
    });
  }
}

// -------------------- Workouts Section --------------------

function renderWorkoutsSection() {
  const container = document.getElementById('workouts-list');
  container.innerHTML = '';
  if (!appData || !appData.ppl_plan) return;
  const logs = getWorkoutLogs();
  appData.ppl_plan.forEach((exercise, index) => {
    // Create details element
    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = `${exercise.Exercise} (Sets: ${exercise.Sets}, Reps: ${exercise["Reps (target range)"]})`;
    details.appendChild(summary);
    // Info section
    const infoDiv = document.createElement('div');
    infoDiv.innerHTML = `
      <p><strong>Tempo:</strong> ${exercise.Tempo || '-'}</p>
      <p><strong>Rest:</strong> ${exercise["Rest (sec)"] || '-'}</p>
      <p><strong>RIR Target:</strong> ${exercise["RIR Target"] || '-'}</p>
      ${exercise["Key Cues (form & intent)"] ? `<p><strong>Cues:</strong> ${exercise["Key Cues (form & intent)"]}</p>` : ''}
      ${exercise.Notes ? `<p><strong>Notes:</strong> ${exercise.Notes}</p>` : ''}
    `;
    details.appendChild(infoDiv);
    // Plan and logs table
    const table = document.createElement('table');
    table.className = 'workout-table';
    const headerRow = document.createElement('tr');
    headerRow.innerHTML = '<th>Week</th><th>Target Load</th><th>Target Reps</th><th>Logged Load</th><th>Logged Reps</th>';
    table.appendChild(headerRow);
    for (let week = 1; week <= 8; week++) {
      const row = document.createElement('tr');
      const planLoad = exercise[`Week ${week} Load`] || '';
      const planReps = exercise[`W${week} Reps`] || '';
      let loggedLoad = '';
      let loggedReps = '';
      if (logs[exercise.Exercise]) {
        const log = logs[exercise.Exercise].find(l => l.week === week);
        if (log) {
          loggedLoad = log.load;
          loggedReps = log.reps;
        }
      }
      row.innerHTML = `<td>${week}</td><td>${planLoad}</td><td>${planReps}</td><td>${loggedLoad}</td><td>${loggedReps}</td>`;
      table.appendChild(row);
    }
    details.appendChild(table);
    // Chart area
    const chartCanvas = document.createElement('canvas');
    const canvasId = `workoutChart-${index}`;
    chartCanvas.id = canvasId;
    chartCanvas.height = 180;
    details.appendChild(chartCanvas);
    // Render chart for this exercise
    renderWorkoutChart(exercise.Exercise, canvasId);
    // Add log form
    const form = document.createElement('form');
    form.className = 'form-inline';
    form.innerHTML = `
      <label>Week:</label>
      <select name="week">
        ${Array.from({ length: 8 }, (_, i) => `<option value="${i + 1}">${i + 1}</option>`).join('')}
      </select>
      <label>Load (lb):</label>
      <input type="number" name="load" step="0.1" required>
      <label>Reps:</label>
      <input type="number" name="reps" required>
      <button type="submit">Add Log</button>
    `;
    form.onsubmit = evt => {
      evt.preventDefault();
      const week = parseInt(form.elements['week'].value);
      const load = parseFloat(form.elements['load'].value);
      const reps = parseInt(form.elements['reps'].value);
      addWorkoutLog(exercise.Exercise, week, load, reps);
      // Re-render entire section to update table and chart
      renderWorkoutsSection();
    };
    details.appendChild(form);
    container.appendChild(details);
  });
  // Update select options for the global workout form after rendering
  populateWorkoutFormOptions();
}

function addWorkoutLog(name, week, load, reps) {
  const logs = getWorkoutLogs();
  const list = logs[name] || [];
  const existingIndex = list.findIndex(l => l.week === week);
  if (existingIndex >= 0) {
    list[existingIndex] = { week, load, reps };
  } else {
    list.push({ week, load, reps });
  }
  // Sort by week
  list.sort((a, b) => a.week - b.week);
  logs[name] = list;
  saveWorkoutLogs(logs);
}

function renderWorkoutChart(name, canvasId) {
  const ctx = document.getElementById(canvasId).getContext('2d');
  const logs = getWorkoutLogs()[name] || [];
  if (logs.length === 0) {
    if (workoutCharts[name]) {
      workoutCharts[name].destroy();
      delete workoutCharts[name];
    }
    return;
  }
  const weeks = logs.map(l => l.week);
  const loads = logs.map(l => l.load);
  if (workoutCharts[name]) {
    const chart = workoutCharts[name];
    chart.data.labels = weeks;
    chart.data.datasets[0].data = loads;
    chart.update();
  } else {
    workoutCharts[name] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: weeks,
        datasets: [
          {
            label: 'Load',
            data: loads,
            borderColor: 'rgba(255, 159, 64, 1)',
            backgroundColor: 'rgba(255, 159, 64, 0.2)',
            tension: 0.3,
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: 'top' },
        },
        scales: {
          x: {
            title: { display: true, text: 'Week' },
          },
          y: {
            title: { display: true, text: 'Load (lb)' },
          },
        },
      },
    });
  }
}

// -------------------- Global Workout Form --------------------

function populateWorkoutFormOptions() {
  // Fill exercise select and week select on the global form
  const exerciseSelect = document.getElementById('workout-exercise-select');
  const weekSelect = document.getElementById('workout-week-select');
  if (!exerciseSelect || !weekSelect || !appData) return;
  // Populate exercise options if not already
  if (exerciseSelect.options.length === 0) {
    appData.ppl_plan.forEach(ex => {
      const opt = document.createElement('option');
      opt.value = ex.Exercise;
      opt.textContent = ex.Exercise;
      exerciseSelect.appendChild(opt);
    });
  }
  // Populate weeks 1–8 if not already
  if (weekSelect.options.length === 0) {
    for (let i = 1; i <= 8; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = i;
      weekSelect.appendChild(opt);
    }
  }
}

function setupGlobalWorkoutForm() {
  const form = document.getElementById('workout-form');
  if (!form) return;
  form.onsubmit = evt => {
    evt.preventDefault();
    const exercise = document.getElementById('workout-exercise-select').value;
    const week = parseInt(document.getElementById('workout-week-select').value);
    const load = parseFloat(document.getElementById('workout-load').value);
    const reps = parseInt(document.getElementById('workout-reps').value);
    if (!exercise || isNaN(week) || isNaN(load) || isNaN(reps)) return;
    addWorkoutLog(exercise, week, load, reps);
    // Clear inputs except selects
    document.getElementById('workout-load').value = '';
    document.getElementById('workout-reps').value = '';
    // Re-render section
    renderWorkoutsSection();
  };
}

// -------------------- Custom Grocery Items --------------------

function getCustomGroceryList() {
  return JSON.parse(localStorage.getItem('customGrocery') || '[]');
}

function saveCustomGroceryList(list) {
  localStorage.setItem('customGrocery', JSON.stringify(list));
}

function setupGroceryForm() {
  const form = document.getElementById('grocery-form');
  if (!form) return;
  form.onsubmit = evt => {
    evt.preventDefault();
    const name = document.getElementById('grocery-item-name').value.trim();
    const qty = document.getElementById('grocery-item-qty').value.trim();
    if (!name || !qty) return;
    const list = getCustomGroceryList();
    list.push({ Item: name, "Weekly Qty (approx)": qty });
    saveCustomGroceryList(list);
    // Clear form
    form.reset();
    renderGrocerySection();
  };
}


// -------------------- Nutrition Section --------------------

function renderNutritionSection() {
  const guidelinesDiv = document.getElementById('nutrition-guidelines');
  // Show guidelines
  guidelinesDiv.innerHTML = '';
  if (appData && appData.nutrition && appData.nutrition.length > 0) {
    const ul = document.createElement('ul');
    appData.nutrition.forEach(line => {
      const li = document.createElement('li');
      li.textContent = line;
      ul.appendChild(li);
    });
    guidelinesDiv.appendChild(ul);
  }
  // Render chart and summary
  updateNutritionChart();
  updateNutritionSummary();
  // Setup form
  const form = document.getElementById('food-form');
  form.onsubmit = evt => {
    evt.preventDefault();
    const dateStr = document.getElementById('food-date').value;
    const calories = parseFloat(document.getElementById('food-calories').value);
    const protein = parseFloat(document.getElementById('food-protein').value);
    const carbs = parseFloat(document.getElementById('food-carbs').value);
    const fat = parseFloat(document.getElementById('food-fat').value);
    if (!dateStr || [calories, protein, carbs, fat].some(v => isNaN(v))) return;
    let entries = getFoodEntries();
    entries.push({ date: dateStr, calories, protein, carbs, fat });
    entries.sort((a, b) => parseDate(a.date) - parseDate(b.date));
    saveFoodEntries(entries);
    form.reset();
    renderNutritionSection();
  };
}

function updateNutritionChart() {
  const ctx = document.getElementById('nutritionChart').getContext('2d');
  const entries = getFoodEntries().sort((a, b) => parseDate(a.date) - parseDate(b.date));
  const labels = entries.map(e => e.date);
  const calories = entries.map(e => e.calories);
  const protein = entries.map(e => e.protein);
  const carbs = entries.map(e => e.carbs);
  const fat = entries.map(e => e.fat);
  const datasets = [];
  if (labels.length > 0) {
    datasets.push({
      label: 'Calories',
      data: calories,
      borderColor: 'rgba(255, 99, 132, 1)',
      backgroundColor: 'rgba(255, 99, 132, 0.2)',
      tension: 0.3,
    });
    datasets.push({
      label: 'Protein (g)',
      data: protein,
      borderColor: 'rgba(53, 162, 235, 1)',
      backgroundColor: 'rgba(53, 162, 235, 0.2)',
      tension: 0.3,
    });
    datasets.push({
      label: 'Carbs (g)',
      data: carbs,
      borderColor: 'rgba(255, 205, 86, 1)',
      backgroundColor: 'rgba(255, 205, 86, 0.2)',
      tension: 0.3,
    });
    datasets.push({
      label: 'Fat (g)',
      data: fat,
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.3,
    });
  }
  if (nutritionChart) {
    nutritionChart.data.labels = labels;
    nutritionChart.data.datasets = datasets;
    nutritionChart.update();
  } else {
    nutritionChart = new Chart(ctx, {
      type: 'line',
      data: { labels, datasets },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display: true, text: 'Date' } },
          y: { title: { display: true, text: 'Calories / Grams' } },
        },
      },
    });
  }
}

function updateNutritionSummary() {
  const summaryDiv = document.getElementById('nutrition-summary');
  summaryDiv.innerHTML = '';
  const entries = getFoodEntries().sort((a, b) => parseDate(a.date) - parseDate(b.date));
  if (entries.length === 0) return;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 6);
  const last7 = entries.filter(e => parseDate(e.date) >= cutoff);
  const count = last7.length || 1;
  let caloriesSum = 0, proteinSum = 0, carbsSum = 0, fatSum = 0;
  last7.forEach(e => {
    caloriesSum += e.calories;
    proteinSum += e.protein;
    carbsSum += e.carbs;
    fatSum += e.fat;
  });
  summaryDiv.innerHTML = `<p><strong>7‑day Average</strong></p>
    <p>Calories: ${(caloriesSum / count).toFixed(0)}</p>
    <p>Protein: ${(proteinSum / count).toFixed(0)} g</p>
    <p>Carbs: ${(carbsSum / count).toFixed(0)} g</p>
    <p>Fat: ${(fatSum / count).toFixed(0)} g</p>`;
}

// -------------------- Grocery Section --------------------

function renderGrocerySection() {
  const listEl = document.getElementById('grocery-list');
  listEl.innerHTML = '';
  if (!appData || !appData.grocery_list) return;
  const purchased = getPurchasedItems();
  // Combine static and custom lists
  const combined = appData.grocery_list.concat(getCustomGroceryList());
  combined.forEach(item => {
    const li = document.createElement('li');
    const button = document.createElement('button');
    const key = item.Item;
    const isPurchased = purchased[key];
    button.innerHTML = isPurchased ? '✔️' : '⚪';
    button.addEventListener('click', () => {
      purchased[key] = !purchased[key];
      savePurchasedItems(purchased);
      renderGrocerySection();
    });
    const text = document.createElement('span');
    text.innerHTML = `<strong>${item.Item}</strong> – ${item["Weekly Qty (approx)"]}`;
    li.appendChild(button);
    li.appendChild(text);
    listEl.appendChild(li);
  });
}

// Functions to manage scheduler progress in localStorage
function getSchedulerProgress() {
  return JSON.parse(localStorage.getItem('schedulerProgress') || '{}');
}

function saveSchedulerProgress(obj) {
  localStorage.setItem('schedulerProgress', JSON.stringify(obj));
}

function updateSchedulerProgress(week, day, completedVal, noteVal) {
  const progress = getSchedulerProgress();
  if (!progress[week]) progress[week] = {};
  const cell = progress[week][day] || { completed: false, note: '' };
  if (completedVal !== null) cell.completed = completedVal;
  if (noteVal !== null) cell.note = noteVal;
  progress[week][day] = cell;
  saveSchedulerProgress(progress);
}

// -------------------- Workouts Table --------------------

function renderWorkoutsTable() {
  const container = document.getElementById('workouts-container');
  if (!container || !appData || !appData.ppl_plan) return;
  container.innerHTML = '';
  // Group exercises by workout day based on blank separators ("0" rows)
  const dayNames = ['Push A','Pull A','Legs A','Push B','Pull B','Legs B'];
  const groups = [];
  let groupIndex = 0;
  appData.ppl_plan.forEach(ex => {
    if (!ex.Exercise || ex.Exercise.toString().trim() === '0') {
      groupIndex++;
      return;
    }
    if (!groups[groupIndex]) groups[groupIndex] = [];
    groups[groupIndex].push(ex);
  });
  const logs = getWorkoutLogs();
  // Build tables for each group
  groups.forEach((group, idx) => {
    if (!group || group.length === 0) return;
    const section = document.createElement('div');
    section.className = 'workout-group';
    const heading = document.createElement('h3');
    heading.textContent = dayNames[idx] || `Group ${idx+1}`;
    section.appendChild(heading);
    const table = document.createElement('table');
    table.className = 'workout-table';
    // Header row
    const headerRow = document.createElement('tr');
    const baseHeaders = ['Exercise','Sets','Target Reps'];
    baseHeaders.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      headerRow.appendChild(th);
    });
    for (let week = 1; week <= 8; week++) {
      const thLoad = document.createElement('th');
      thLoad.textContent = `W${week} Load`;
      headerRow.appendChild(thLoad);
      const thReps = document.createElement('th');
      thReps.textContent = `W${week} Reps`;
      headerRow.appendChild(thReps);
    }
    table.appendChild(headerRow);
    // Rows
    group.forEach(ex => {
      const tr = document.createElement('tr');
      const nameTd = document.createElement('td'); nameTd.textContent = ex.Exercise; tr.appendChild(nameTd);
      const setsTd = document.createElement('td'); setsTd.textContent = ex.Sets; tr.appendChild(setsTd);
      const repsTd = document.createElement('td'); repsTd.textContent = ex['Reps (target range)']; tr.appendChild(repsTd);
      for (let week = 1; week <= 8; week++) {
        // Load cell
        const loadTd = document.createElement('td');
        const loadInput = document.createElement('input');
        loadInput.type = 'number';
        loadInput.step = '0.1';
        loadInput.placeholder = ex[`Week ${week} Load`] || '';
        // Prepopulate
        let existing = '';
        if (logs[ex.Exercise]) {
          const item = logs[ex.Exercise].find(l => l.week === week);
          if (item && item.load !== undefined && item.load !== '') existing = item.load;
        }
        loadInput.value = existing;
        loadInput.dataset.exercise = ex.Exercise;
        loadInput.dataset.week = week;
        loadInput.dataset.type = 'load';
        loadTd.appendChild(loadInput);
        tr.appendChild(loadTd);
        // Reps cell
        const repsTdWeek = document.createElement('td');
        const repsInput = document.createElement('input');
        repsInput.type = 'number';
        repsInput.step = '1';
        repsInput.placeholder = ex[`W${week} Reps`] || '';
        let existingReps = '';
        if (logs[ex.Exercise]) {
          const item = logs[ex.Exercise].find(l => l.week === week);
          if (item && item.reps !== undefined && item.reps !== '') existingReps = item.reps;
        }
        repsInput.value = existingReps;
        repsInput.dataset.exercise = ex.Exercise;
        repsInput.dataset.week = week;
        repsInput.dataset.type = 'reps';
        repsTdWeek.appendChild(repsInput);
        tr.appendChild(repsTdWeek);
      }
      table.appendChild(tr);
    });
    section.appendChild(table);
    container.appendChild(section);
  });
  // Attach listeners
  container.querySelectorAll('input').forEach(input => {
    input.addEventListener('change', () => {
      const exercise = input.dataset.exercise;
      const week = parseInt(input.dataset.week);
      const type = input.dataset.type;
      const value = input.value;
      updateWorkoutLogValue(exercise, week, type, value);
    });
  });
}

function updateWorkoutLogValue(exercise, week, type, value) {
  const logs = getWorkoutLogs();
  let list = logs[exercise] || [];
  let item = list.find(l => l.week === week);
  if (!item) {
    item = { week: week, load: '', reps: '' };
    list.push(item);
  }
  if (type === 'load') {
    item.load = value ? parseFloat(value) : '';
  } else {
    item.reps = value ? parseInt(value) : '';
  }
  // Remove item if both fields are empty
  if ((item.load === '' || item.load === undefined) && (item.reps === '' || item.reps === undefined)) {
    list = list.filter(l => l !== item);
  }
  logs[exercise] = list;
  saveWorkoutLogs(logs);
}

// -------------------- Clear Data Buttons --------------------

function setupClearButtons() {
  // Weight
  const clearWeight = document.getElementById('clear-weight-btn');
  if (clearWeight) {
    clearWeight.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all weight entries?')) {
        localStorage.removeItem('weightEntries');
        renderWeightSection();
        renderDashboardSection();
      }
    });
  }
  // Workouts
  const clearWorkouts = document.getElementById('clear-workouts-btn');
  if (clearWorkouts) {
    clearWorkouts.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all workout logs?')) {
        localStorage.removeItem('workoutLogs');
        renderWorkoutsTable();
      }
    });
  }
  // Food
  const clearFood = document.getElementById('clear-food-btn');
  if (clearFood) {
    clearFood.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all food entries?')) {
        localStorage.removeItem('foodEntries');
        renderNutritionSection();
      }
    });
  }
  // Grocery
  const clearGrocery = document.getElementById('clear-grocery-btn');
  if (clearGrocery) {
    clearGrocery.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear grocery data (custom items and purchase marks)?')) {
        localStorage.removeItem('purchasedItems');
        localStorage.removeItem('customGrocery');
        renderGrocerySection();
      }
    });
  }
  // Scheduler
  const clearScheduler = document.getElementById('clear-scheduler-btn');
  if (clearScheduler) {
    clearScheduler.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear scheduler progress?')) {
        localStorage.removeItem('schedulerProgress');
        renderSchedulerSection();
      }
    });
  }
}

// -------------------- Scheduler Section --------------------

function renderSchedulerSection() {
  const table = document.getElementById('scheduler-table');
  if (!table || !appData || !appData.scheduler) return;
  table.innerHTML = '';
  // Column definitions
  const columns = ['Week','Mon: Push A','Tue: Pull A','Wed: Legs A','Thu: Push B','Fri: Pull B','Sat: Legs B','Sun: Rest/Cardio'];
  // Load progress
  const progress = getSchedulerProgress();
  // Header row
  const headerRow = document.createElement('tr');
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col;
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);
  // Rows with interactive cells
  appData.scheduler.forEach(row => {
    const tr = document.createElement('tr');
    columns.forEach(col => {
      const td = document.createElement('td');
      if (col === 'Week') {
        td.textContent = row[col];
      } else {
        const weekKey = row['Week'];
        const dayKey = col;
        const cellData = progress[weekKey] && progress[weekKey][dayKey] ? progress[weekKey][dayKey] : { completed: false, note: '' };
        td.innerHTML = `
          <label style="display:flex; align-items:center; gap:0.25rem;">
            <input type="checkbox" data-week="${weekKey}" data-day="${dayKey}" ${cellData.completed ? 'checked' : ''}>
            Done
          </label>
          <input type="text" placeholder="Notes" data-week="${weekKey}" data-day="${dayKey}" value="${cellData.note || ''}" style="width: 100%; margin-top: 4px;">
        `;
      }
      tr.appendChild(td);
    });
    table.appendChild(tr);
  });
  // Attach listeners for checkboxes and notes
  table.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => {
      const week = cb.getAttribute('data-week');
      const day = cb.getAttribute('data-day');
      updateSchedulerProgress(week, day, cb.checked, null);
    });
  });
  table.querySelectorAll('input[type="text"]').forEach(input => {
    input.addEventListener('change', () => {
      const week = input.getAttribute('data-week');
      const day = input.getAttribute('data-day');
      updateSchedulerProgress(week, day, null, input.value);
    });
  });
}

// -------------------- Dashboard Section --------------------

function renderDashboardSection() {
  const summaryDiv = document.getElementById('dashboard-summary');
  const ctx = document.getElementById('dashboardChart').getContext('2d');
  const entries = getWeightEntries().sort((a,b) => parseDate(a.date) - parseDate(b.date));
  // Compute 7-day moving average like weight section
  const labels = entries.map(e => e.date);
  const moving = [];
  for (let i = 6; i < entries.length; i++) {
    const slice = entries.slice(i - 6, i + 1);
    const avg = slice.reduce((sum, e) => sum + e.weight, 0) / 7;
    moving.push(avg.toFixed(2));
  }
  const avgLabels = labels.slice(6);
  // Compute weekly average loss (comparing last week average vs previous)
  let weeklyLoss = null;
  if (moving.length >= 7) {
    const lastWeek = moving.slice(-7).reduce((a,b) => a + parseFloat(b), 0) / 7;
    const prevWeek = moving.slice(-14,-7).reduce((a,b) => a + parseFloat(b), 0) / 7;
    weeklyLoss = prevWeek && !isNaN(prevWeek) ? (lastWeek - prevWeek) : null;
  }
  // Compute calorie suggestion based on weekly loss
  let suggestion = null;
  if (weeklyLoss !== null) {
    // Negative loss indicates weight drop
    if (weeklyLoss < -2) {
      suggestion = 'Increase calories by 150–200 kcal/day';
    } else if (weeklyLoss > -1) {
      suggestion = 'Decrease calories by 200 kcal/day or add 2,000 steps';
    } else {
      suggestion = 'Maintain current intake';
    }
  }
  // Update summary
  summaryDiv.innerHTML = '';
  if (weeklyLoss !== null) {
    summaryDiv.innerHTML = `<p><strong>Weekly Avg Loss:</strong> ${weeklyLoss.toFixed(2)} lb</p><p><strong>Calorie Suggestion:</strong> ${suggestion}</p>`;
  } else {
    summaryDiv.innerHTML = '<p>No enough data to compute weekly statistics.</p>';
  }
  // Chart of moving average
  const dashboardDatasets = [];
  if (moving.length > 0) {
    dashboardDatasets.push({
      label: '7‑day Avg Weight',
      data: Array(6).fill(null).concat(moving),
      borderColor: 'rgba(75, 192, 192, 1)',
      backgroundColor: 'rgba(75, 192, 192, 0.2)',
      tension: 0.3,
    });
    dashboardDatasets.push({
      label: 'Weight',
      data: entries.map(e => e.weight),
      borderColor: 'rgba(53, 162, 235, 1)',
      backgroundColor: 'rgba(53, 162, 235, 0.2)',
      tension: 0.3,
    });
  }
  if (dashboardChart) {
    dashboardChart.data.labels = labels;
    dashboardChart.data.datasets = dashboardDatasets;
    dashboardChart.update();
  } else {
    dashboardChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: labels,
        datasets: dashboardDatasets,
      },
      options: {
        responsive: true,
        interaction: { mode: 'index', intersect: false },
        plugins: { legend: { position: 'top' } },
        scales: {
          x: { title: { display: true, text: 'Date' } },
          y: { title: { display: true, text: 'Weight (lb)' } },
        },
      },
    });
  }
}