const MONTHLY_ALLOWANCE = 63;
const STORAGE_KEY = "blngECouponData";

const monthTitle = document.getElementById("monthTitle");
const totalSpent = document.getElementById("totalSpent");
const balanceLeft = document.getElementById("balanceLeft");
const usagePercent = document.getElementById("usagePercent");
const usageRing = document.getElementById("usageRing");
const projectedWaste = document.getElementById("projectedWaste");

const spendingForm = document.getElementById("spendingForm");
const itemName = document.getElementById("itemName");
const category = document.getElementById("category");
const amount = document.getElementById("amount");

const transactionList = document.getElementById("transactionList");
const historyList = document.getElementById("historyList");
const searchInput = document.getElementById("searchInput");

const clearDashboardBtn = document.getElementById("clearDashboardBtn");
const clearAnalyticsBtn = document.getElementById("clearAnalyticsBtn");

const annualSpent = document.getElementById("annualSpent");
const annualWasted = document.getElementById("annualWasted");

const pieChart = document.getElementById("pieChart");
const trendChart = document.getElementById("trendChart");

const navButtons = document.querySelectorAll(".nav-btn");
const tabs = document.querySelectorAll(".tab-content");

function getCurrentMonthKey(){
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function formatMonth(monthKey){
  const [year, month] = monthKey.split("-");
  const date = new Date(Number(year), Number(month) - 1);

  return date.toLocaleDateString("en-US", {
    month:"long",
    year:"numeric"
  });
}

function formatMoney(value){
  return `$${Number(value).toFixed(2)}`;
}

function loadData(){
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : { months:{} };
}

function saveData(data){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function ensureCurrentMonth(){
  const data = loadData();
  const currentMonth = getCurrentMonthKey();

  if(!data.months[currentMonth]){
    data.months[currentMonth] = {
      allowance:MONTHLY_ALLOWANCE,
      entries:[]
    };

    saveData(data);
  }

  return data;
}

function calculateMonth(monthData){
  const spent = monthData.entries.reduce((sum, entry) => sum + entry.amount, 0);
  const balance = monthData.allowance - spent;
  const wasted = Math.max(balance, 0);
  const overspent = Math.max(spent - monthData.allowance, 0);
  const usage = Math.min((spent / monthData.allowance) * 100, 100);

  return {
    spent,
    balance,
    wasted,
    overspent,
    usage
  };
}

function getProjectedWaste(monthData){
  const now = new Date();
  const today = now.getDate();
  const totalDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const stats = calculateMonth(monthData);

  if(stats.spent === 0){
    return "No spending recorded yet for this month.";
  }

  const dailyAverage = stats.spent / today;
  const projectedSpent = dailyAverage * totalDays;
  const projectedBalance = MONTHLY_ALLOWANCE - projectedSpent;

  if(projectedBalance > 0){
    return `Projected wasted balance: ${formatMoney(projectedBalance)}`;
  }

  return `Projected overspend: ${formatMoney(Math.abs(projectedBalance))}`;
}

function renderDashboard(){
  const data = ensureCurrentMonth();
  const currentMonth = getCurrentMonthKey();
  const monthData = data.months[currentMonth];
  const stats = calculateMonth(monthData);

  monthTitle.textContent = formatMonth(currentMonth);
  totalSpent.textContent = formatMoney(stats.spent);
  balanceLeft.textContent = formatMoney(stats.balance);
  usagePercent.textContent = `${Math.round(stats.usage)}%`;
  usageRing.style.background = `conic-gradient(var(--blng-green) ${stats.usage * 3.6}deg, #e8f1ec 0deg)`;
  projectedWaste.textContent = getProjectedWaste(monthData);

  balanceLeft.style.color = stats.balance < 0 ? "var(--red)" : "var(--blng-dark)";

  renderTransactions();
}

function renderTransactions(){
  const data = ensureCurrentMonth();
  const currentMonth = getCurrentMonthKey();
  const monthData = data.months[currentMonth];
  const keyword = searchInput.value.toLowerCase();

  const filtered = monthData.entries.filter(entry => {
    return (
      entry.name.toLowerCase().includes(keyword) ||
      entry.category.toLowerCase().includes(keyword)
    );
  });

  transactionList.innerHTML = "";

  if(filtered.length === 0){
    transactionList.innerHTML = `<div class="empty-state">No spending records found for this month.</div>`;
    return;
  }

  [...filtered].reverse().forEach(entry => {
    const item = document.createElement("div");
    item.className = "transaction-item";

    item.innerHTML = `
      <button class="delete-btn" data-id="${entry.id}" aria-label="Delete spending">×</button>

      <div class="transaction-info">
        <strong>${entry.name}</strong>
        <span>${entry.category} • ${entry.date}</span>
      </div>

      <div class="amount-tag">${formatMoney(entry.amount)}</div>
    `;

    transactionList.appendChild(item);
  });
}

function renderHistory(){
  const data = ensureCurrentMonth();
  const currentMonth = getCurrentMonthKey();

  const monthKeys = Object.keys(data.months)
    .filter(monthKey => monthKey !== currentMonth)
    .sort()
    .reverse();

  historyList.innerHTML = "";

  if(monthKeys.length === 0){
    historyList.innerHTML = `<div class="empty-state">No past month history yet.</div>`;
    return;
  }

  monthKeys.forEach(monthKey => {
    const monthData = data.months[monthKey];
    const stats = calculateMonth(monthData);

    const item = document.createElement("div");
    item.className = "history-item";

    item.innerHTML = `
      <div class="history-info">
        <strong>${formatMonth(monthKey)}</strong>
        <span>${monthData.entries.length} spending entries</span>
      </div>

      <div class="history-stats">
        <span>Spent: ${formatMoney(stats.spent)}</span>
        <span>Wasted: ${formatMoney(stats.wasted)}</span>
        <span>Balance: ${formatMoney(stats.balance)}</span>
      </div>
    `;

    historyList.appendChild(item);
  });
}

function renderAnalytics(){
  const data = ensureCurrentMonth();
  const currentMonth = getCurrentMonthKey();
  const monthData = data.months[currentMonth];

  drawPieChart(monthData.entries);
  drawTrendChart(data.months);
  renderAnnualSummary(data.months);
}

function drawPieChart(entries){
  const ctx = pieChart.getContext("2d");
  ctx.clearRect(0, 0, pieChart.width, pieChart.height);

  const totals = {};

  entries.forEach(entry => {
    totals[entry.category] = (totals[entry.category] || 0) + entry.amount;
  });

  const values = Object.values(totals);
  const labels = Object.keys(totals);
  const total = values.reduce((sum, value) => sum + value, 0);

  ctx.font = "13px Inter, system-ui";

  if(total === 0){
    ctx.fillStyle = "#68756e";
    ctx.fillText("No category data yet", 90, 150);
    return;
  }

  const colors = ["#007a3d", "#f5b700", "#d71920", "#004626"];
  let start = 0;

  values.forEach((value, index) => {
    const slice = (value / total) * Math.PI * 2;

    ctx.beginPath();
    ctx.moveTo(150, 150);
    ctx.arc(150, 150, 108, start, start + slice);
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    start += slice;
  });

  labels.forEach((label, index) => {
    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(18, 18 + index * 24, 12, 12);

    ctx.fillStyle = "#102018";
    ctx.fillText(`${label}: ${formatMoney(values[index])}`, 38, 29 + index * 24);
  });
}

function drawTrendChart(months){
  const ctx = trendChart.getContext("2d");
  ctx.clearRect(0, 0, trendChart.width, trendChart.height);

  const keys = Object.keys(months).sort().slice(-12);

  ctx.font = "13px Inter, system-ui";

  if(keys.length === 0){
    ctx.fillStyle = "#68756e";
    ctx.fillText("No monthly trend yet", 230, 150);
    return;
  }

  const values = keys.map(key => calculateMonth(months[key]).spent);
  const max = Math.max(...values, MONTHLY_ALLOWANCE);

  ctx.beginPath();
  ctx.moveTo(50, 250);
  ctx.lineTo(560, 250);
  ctx.strokeStyle = "#dce8e1";
  ctx.stroke();

  values.forEach((value, index) => {
    const barWidth = 32;
    const gap = 18;
    const x = 60 + index * (barWidth + gap);
    const height = (value / max) * 190;
    const y = 250 - height;

    ctx.fillStyle = "#007a3d";
    ctx.fillRect(x, y, barWidth, height);

    ctx.fillStyle = "#102018";
    ctx.fillText(keys[index].slice(5), x + 4, 270);
  });
}

function renderAnnualSummary(months){
  const currentYear = new Date().getFullYear().toString();

  let spent = 0;
  let wasted = 0;

  Object.keys(months).forEach(key => {
    if(key.startsWith(currentYear)){
      const stats = calculateMonth(months[key]);
      spent += stats.spent;
      wasted += stats.wasted;
    }
  });

  annualSpent.textContent = formatMoney(spent);
  annualWasted.textContent = formatMoney(wasted);
}

function clearAllDataWithDoubleConfirmation(){
  const firstConfirm = confirm("Are you sure you want to clear all BLNG e-Coupon data?");
  if(!firstConfirm) return;

  const secondConfirm = confirm("This will permanently remove all spending records and history from this browser. Continue?");
  if(!secondConfirm) return;

  localStorage.removeItem(STORAGE_KEY);
  renderAll();
}

function deleteEntryWithDoubleConfirmation(id){
  const firstConfirm = confirm("Delete this spending record?");
  if(!firstConfirm) return;

  const secondConfirm = confirm("This action cannot be undone. Confirm delete?");
  if(!secondConfirm) return;

  const data = loadData();
  const currentMonth = getCurrentMonthKey();

  if(!data.months[currentMonth]) return;

  data.months[currentMonth].entries = data.months[currentMonth].entries.filter(entry => entry.id !== id);

  saveData(data);
  renderAll();
}

spendingForm.addEventListener("submit", event => {
  event.preventDefault();

  const data = ensureCurrentMonth();
  const currentMonth = getCurrentMonthKey();

  const newEntry = {
    id:crypto.randomUUID(),
    name:itemName.value,
    category:category.value,
    amount:Number(amount.value),
    date:new Date().toLocaleDateString("en-GB", {
      day:"2-digit",
      month:"short",
      year:"numeric"
    })
  };

  data.months[currentMonth].entries.push(newEntry);
  saveData(data);

  amount.value = "";
  renderAll();
});

transactionList.addEventListener("click", event => {
  if(!event.target.classList.contains("delete-btn")) return;

  const id = event.target.dataset.id;
  deleteEntryWithDoubleConfirmation(id);
});

searchInput.addEventListener("input", renderTransactions);

clearDashboardBtn.addEventListener("click", clearAllDataWithDoubleConfirmation);
clearAnalyticsBtn.addEventListener("click", clearAllDataWithDoubleConfirmation);

navButtons.forEach(button => {
  button.addEventListener("click", () => {
    navButtons.forEach(btn => btn.classList.remove("active"));
    tabs.forEach(tab => tab.classList.remove("active"));

    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");

    renderAnalytics();
  });
});

function renderAll(){
  renderDashboard();
  renderHistory();
  renderAnalytics();
}

renderAll();
