/* ---------- Kartell POS — state & persistence ---------- */
const STORAGE_KEY = "kartellPOS_v1";

const menu = [
  { name: "Chicken & Chips", price: 650, cat: "Main Course", emoji: "🍗" },
  { name: "Beef Burger", price: 550, cat: "Main Course", emoji: "🍔" },
  { name: "Pilau Beef", price: 700, cat: "Main Course", emoji: "🍛" },
  { name: "Fish & Chips", price: 750, cat: "Main Course", emoji: "🐟" },
  { name: "Pancakes", price: 350, cat: "Breakfast", emoji: "🥞" },
  { name: "Full Breakfast", price: 500, cat: "Breakfast", emoji: "🍳" },
  { name: "Fresh Juice", price: 250, cat: "Drinks", emoji: "🧃" },
  { name: "Soda", price: 100, cat: "Drinks", emoji: "🥤" },
  { name: "Chocolate Cake", price: 300, cat: "Desserts", emoji: "🍰" },
  { name: "Ice Cream", price: 250, cat: "Desserts", emoji: "🍨" },
  { name: "Tea", price: 120, cat: "Drinks", emoji: "☕" },
  { name: "Chicken Wings", price: 600, cat: "Main Course", emoji: "🍖" }
];
const CATEGORIES = ["All", "Main Course", "Breakfast", "Drinks", "Desserts"];

function defaultState() {
  const tables = [];
  for (let i = 1; i <= 20; i++) {
    tables.push({ id: i, seats: i % 2 === 0 ? 4 : 2, status: "free", orderId: null });
  }
  return {
    settings: {
      restaurantName: "Kartell Kitchen",
      currency: "KSh — Kenyan Shilling",
      receiptFooter: "Thank you for dining with us!",
      requireLogin: true,
      offline: true,
      backup: true
    },
    tables,
    orders: [],
    payments: [],
    activity: [],
    nextOrderNum: 1049,
    loggedInUser: null
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    // guard against corrupted/older shape
    if (!parsed.tables || !parsed.settings) return defaultState();
    return parsed;
  } catch (e) {
    return defaultState();
  }
}
function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    toast("Could not save locally — storage may be full");
  }
}

/* ---------- helpers ---------- */
function money(n) { return "KSh " + Math.round(n).toLocaleString(); }
function nowTimeStr() { return new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); }
function genRef() {
  return Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
}
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}
function findTable(id) { return state.tables.find(t => t.id === id); }
function findOrder(id) { return state.orders.find(o => o.id === id); }

function addActivity(icon, color, title, detail, amountText, amountClass) {
  state.activity.unshift({ icon, color, title, detail, amountText: amountText || "", amountClass: amountClass || "neutral", ts: Date.now() });
  state.activity = state.activity.slice(0, 12);
}
function relTime(ts) {
  const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (mins < 1) return "now";
  if (mins < 60) return mins + "m";
  return Math.round(mins / 60) + "h";
}

/* ---------- navigation ---------- */
function showPage(id) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active-page"));
  document.getElementById(id).classList.add("active-page");
  document.querySelectorAll(".nav-item").forEach(b => b.classList.toggle("active", b.dataset.page === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll(".nav-item").forEach(b => b.addEventListener("click", () => showPage(b.dataset.page)));

/* ---------- login gate ---------- */
function checkLoginGate() {
  const gate = document.getElementById("loginScreen");
  if (state.settings.requireLogin && !state.loggedInUser) {
    gate.classList.add("show");
  } else {
    gate.classList.remove("show");
    if (!state.loggedInUser) state.loggedInUser = { name: "Guest", role: "Staff" };
    updateSidebarUser();
  }
}
function attemptLogin() {
  const sel = document.getElementById("loginUser").value.split("|");
  const [name, role, pin] = sel;
  const entered = document.getElementById("loginPin").value.trim();
  const err = document.getElementById("loginError");
  if (entered !== pin) {
    err.textContent = "Incorrect PIN — try again.";
    document.getElementById("loginPin").value = "";
    return;
  }
  err.textContent = "";
  state.loggedInUser = { name, role };
  document.getElementById("loginPin").value = "";
  save();
  document.getElementById("loginScreen").classList.remove("show");
  updateSidebarUser();
  renderAll();
  toast(`Welcome back, ${name.split(" ")[0]}`);
}
function logout() {
  state.loggedInUser = null;
  save();
  checkLoginGate();
}
function updateSidebarUser() {
  const u = state.loggedInUser || { name: "Guest", role: "Staff" };
  document.getElementById("sidebarUserName").textContent = u.name;
  document.getElementById("sidebarUserRole").textContent = u.role;
  document.getElementById("sidebarAvatar").textContent = u.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  document.getElementById("dashGreeting").innerHTML = `Good day, ${u.name.split(" ")[0]} <span>👋</span>`;
}

/* ---------- floor / tables ---------- */
function tableLabel(t) {
  if (t.status === "free") return t.seats + " seats";
  if (t.status === "bill") return "Bill ready";
  const o = findOrder(t.orderId);
  return o ? money(o.total) : "Occupied";
}
function renderFloor(el, ids, positioned) {
  el.innerHTML = ids.map((id, i) => {
    const t = findTable(id);
    const posClass = positioned ? ` t${i + 1}` : "";
    return `<button class="table${posClass} ${t.status}-table" onclick="selectTable(${t.id})"><b>T${String(t.id).padStart(2, "0")}</b><small>${tableLabel(t)}</small></button>`;
  }).join("");
}
function renderDashFloor() { renderFloor(document.getElementById("dashFloor"), state.tables.slice(0, 8).map(t => t.id), true); }
function renderLargeFloor() { renderFloor(document.getElementById("largeFloor"), state.tables.map(t => t.id), false); }

/* ---------- order modal ---------- */
let currentTableId = null;
let cart = [];

function openNewOrderPicker() {
  const el = document.getElementById("pickTableFloor");
  el.innerHTML = state.tables.map(t => {
    const disabled = t.status !== "free" ? " disabled" : "";
    return `<button class="table ${t.status}-table" ${disabled} onclick="pickTable(${t.id})"><b>T${String(t.id).padStart(2, "0")}</b><small>${tableLabel(t)}</small></button>`;
  }).join("");
  document.getElementById("pickTableModal").classList.add("show");
}
function closePickTable() { document.getElementById("pickTableModal").classList.remove("show"); }
function pickTable(id) {
  const t = findTable(id);
  if (t.status !== "free") { toast("That table is already in use"); return; }
  closePickTable();
  selectTable(id);
}

function selectTable(id) {
  const t = findTable(id);
  if (t.status === "bill") { openPayment(id); return; }
  openOrder(id);
}
function openOrder(tableId) {
  currentTableId = tableId;
  const t = findTable(tableId);
  const existing = t.orderId ? findOrder(t.orderId) : null;
  cart = existing ? existing.items.map(i => ({ ...i })) : [];

  document.getElementById("orderModalTitle").textContent = "Table " + String(tableId).padStart(2, "0");
  document.getElementById("orderModalSubtitle").textContent = existing
    ? `Order #${existing.id} · ${existing.items.reduce((a, x) => a + x.qty, 0)} items already sent`
    : "Select menu items to build the order.";
  const statusEl = document.getElementById("orderModalStatus");
  statusEl.textContent = t.status === "free" ? "● Available" : "● Occupied";
  document.getElementById("requestBillBtn").style.display = existing ? "block" : "none";

  document.getElementById("orderModal").classList.add("show");
  renderQuickMenu();
  renderCart();
}
function closeOrder() {
  document.getElementById("orderModal").classList.remove("show");
  currentTableId = null;
  cart = [];
}
function renderQuickMenu(filter = "", cat = "All") {
  const q = document.getElementById("quickMenu");
  q.innerHTML = "";
  menu.filter(x => x.name.toLowerCase().includes(filter.toLowerCase()) && (cat === "All" || x.cat === cat))
    .forEach(x => {
      const b = document.createElement("button");
      b.className = "quick-item";
      b.innerHTML = `<span>${x.emoji}</span><b>${x.name}</b><small>${money(x.price)}</small>`;
      b.onclick = () => addCart(x);
      q.appendChild(b);
    });
}
function filterMenu(v) { renderQuickMenu(v); }
function addCart(item) {
  let found = cart.find(x => x.name === item.name);
  if (found) found.qty++; else cart.push({ ...item, qty: 1 });
  renderCart();
  toast(`${item.name} added`);
}
function changeQty(name, d) {
  const x = cart.find(i => i.name === name);
  if (!x) return;
  x.qty += d;
  if (x.qty <= 0) cart = cart.filter(i => i.name !== name);
  renderCart();
}
function renderCart() {
  const box = document.getElementById("cartItems");
  document.getElementById("cartCount").textContent = cart.reduce((a, x) => a + x.qty, 0) + " items";
  if (!cart.length) {
    box.innerHTML = '<div class="empty">No items yet.<br><small>Select a menu item.</small></div>';
    document.getElementById("cartTotal").textContent = money(0);
    return;
  }
  box.innerHTML = cart.map(x =>
    `<div class="cart-line"><div>${x.emoji}</div><div><b>${x.name}</b><small>${money(x.price)}</small></div><div class="qty"><button onclick="changeQty('${x.name}',-1)">−</button><span>${x.qty}</span><button onclick="changeQty('${x.name}',1)">+</button></div></div>`
  ).join("");
  const total = cart.reduce((a, x) => a + x.price * x.qty, 0);
  document.getElementById("cartTotal").textContent = money(total);
}

function checkout() {
  if (!cart.length) { toast("Add items before sending the order"); return; }
  const t = findTable(currentTableId);
  const total = cart.reduce((a, x) => a + x.price * x.qty, 0);
  const itemCount = cart.reduce((a, x) => a + x.qty, 0);

  if (t.orderId) {
    const existing = findOrder(t.orderId);
    existing.items = cart.map(i => ({ ...i }));
    existing.total = total;
    if (existing.status === "served") existing.status = "preparing";
    addActivity("♨", "blue", "Order updated", `Table ${String(t.id).padStart(2, "0")} · ${itemCount} items`, "Kitchen", "neutral");
  } else {
    const order = {
      id: "#" + (state.nextOrderNum++),
      table: t.id,
      server: (state.loggedInUser && state.loggedInUser.name) || "Staff",
      items: cart.map(i => ({ ...i })),
      total,
      status: "new",
      createdAt: Date.now()
    };
    state.orders.unshift(order);
    t.status = "busy";
    t.orderId = order.id;
    addActivity("+", "purple", "New order", `Table ${String(t.id).padStart(2, "0")} · ${itemCount} items`, "Waiter", "neutral");
  }
  save();
  toast("KOT sent to kitchen ✓");
  cart = [];
  renderCart();
  closeOrder();
  renderAll();
}

function requestBill() {
  const t = findTable(currentTableId);
  if (!t.orderId) { toast("No active order for this table"); return; }
  const o = findOrder(t.orderId);
  o.status = "bill";
  t.status = "bill";
  addActivity("▣", "orange", "Bill requested", `Table ${String(t.id).padStart(2, "0")} · ${money(o.total)}`, "Cashier", "neutral");
  save();
  toast("Bill requested");
  closeOrder();
  renderAll();
}

/* ---------- payment modal ---------- */
let currentPaymentTableId = null;
let currentMethod = "mpesa";
let splitEnabled = false;

function openPayment(tableId) {
  const t = findTable(tableId);
  if (!t.orderId) { toast("No bill for this table"); return; }
  currentPaymentTableId = tableId;
  currentMethod = "mpesa";
  splitEnabled = false;
  document.getElementById("splitEnabled").checked = false;
  document.getElementById("splitControls").style.display = "none";
  document.querySelectorAll(".method-btn").forEach(b => b.classList.toggle("active", b.dataset.method === "mpesa"));
  document.getElementById("mpesaFields").style.display = "block";
  document.getElementById("stkStatus").textContent = "";
  document.getElementById("mpesaPhone").value = "";
  document.getElementById("confirmPaymentBtn").disabled = false;
  document.getElementById("confirmPaymentBtn").textContent = "Send STK Push";
  document.getElementById("paymentModalTitle").textContent = "Table " + String(tableId).padStart(2, "0") + " — Bill";
  renderPaymentSummary();
  document.getElementById("paymentModal").classList.add("show");
}
function closePayment() {
  document.getElementById("paymentModal").classList.remove("show");
  currentPaymentTableId = null;
}
function renderPaymentSummary() {
  const t = findTable(currentPaymentTableId);
  if (!t) return;
  const o = findOrder(t.orderId);
  document.getElementById("paymentTotal").textContent = money(o.total);
  const breakdown = document.getElementById("splitBreakdown");
  if (splitEnabled) {
    const count = Math.max(2, parseInt(document.getElementById("splitCount").value) || 2);
    const base = Math.round(o.total / count);
    const rows = [];
    for (let i = 0; i < count; i++) {
      const share = i < count - 1 ? base : o.total - base * (count - 1);
      rows.push(`<div><span>Guest ${i + 1}</span><b>${money(share)}</b></div>`);
    }
    breakdown.innerHTML = rows.join("");
  } else {
    breakdown.innerHTML = "";
  }
}
function toggleSplit() {
  splitEnabled = document.getElementById("splitEnabled").checked;
  document.getElementById("splitControls").style.display = splitEnabled ? "block" : "none";
  renderPaymentSummary();
}
function selectMethod(m) {
  currentMethod = m;
  document.querySelectorAll(".method-btn").forEach(b => b.classList.toggle("active", b.dataset.method === m));
  document.getElementById("mpesaFields").style.display = m === "mpesa" ? "block" : "none";
  document.getElementById("confirmPaymentBtn").textContent = m === "mpesa" ? "Send STK Push" : "Confirm Payment";
}
function confirmPayment() {
  const t = findTable(currentPaymentTableId);
  if (!t) return;
  const o = findOrder(t.orderId);
  if (currentMethod === "mpesa") {
    const phone = document.getElementById("mpesaPhone").value.trim();
    if (!/^0[71]\d{8}$/.test(phone)) {
      document.getElementById("stkStatus").textContent = "Enter a valid Safaricom/Airtel number, e.g. 0712345678";
      return;
    }
    const btn = document.getElementById("confirmPaymentBtn");
    btn.disabled = true;
    document.getElementById("stkStatus").textContent = `Sending STK push to ${phone}…`;
    setTimeout(() => {
      document.getElementById("stkStatus").textContent = "Waiting for customer to enter M-Pesa PIN…";
      setTimeout(() => {
        document.getElementById("stkStatus").textContent = "Payment confirmed ✓";
        setTimeout(() => finalizePayment(t, o, phone), 500);
      }, 1400);
    }, 1000);
  } else {
    finalizePayment(t, o, null);
  }
}
function finalizePayment(t, o, phone) {
  const count = splitEnabled ? Math.max(2, parseInt(document.getElementById("splitCount").value) || 2) : 1;
  const base = Math.round(o.total / count);
  for (let i = 0; i < count; i++) {
    const share = count === 1 ? o.total : (i < count - 1 ? base : o.total - base * (count - 1));
    state.payments.unshift({
      ref: (currentMethod === "mpesa" ? genRef() : currentMethod.toUpperCase() + "-" + o.id.replace("#", "")) + (count > 1 ? "-" + (i + 1) : ""),
      orderId: o.id,
      method: currentMethod,
      amount: share,
      time: nowTimeStr(),
      status: "Completed",
      phone: phone || null
    });
  }
  o.status = "paid";
  t.status = "free";
  t.orderId = null;
  addActivity("✓", "green", "Payment received", `${currentMethod.toUpperCase()} · Table ${String(t.id).padStart(2, "0")}${count > 1 ? " · split " + count + " ways" : ""}`, "+" + money(o.total), "neutral");
  save();
  toast("Payment completed ✓");
  closePayment();
  renderAll();
}

/* ---------- kitchen / KOT ---------- */
function activeKotOrders() {
  return state.orders.filter(o => ["new", "preparing", "ready"].includes(o.status));
}
function renderKOT() {
  const grid = document.getElementById("kotGrid");
  const list = activeKotOrders();
  if (!list.length) {
    grid.innerHTML = '<div class="empty" style="grid-column:1/-1">No active kitchen tickets.<br><small>New orders will appear here.</small></div>';
    return;
  }
  grid.innerHTML = list.map(o => {
    const readyClass = o.status === "ready" ? " ready-kot" : "";
    const label = o.status === "new" ? "Start Preparing" : o.status === "preparing" ? "Mark Ready" : "Mark Served ✓";
    return `<div class="kot${readyClass}"><div class="kot-head"><b>KOT ${o.id}</b><span>TABLE ${String(o.table).padStart(2, "0")}</span></div><small>Sent ${new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</small><ul>${o.items.map(i => `<li>${i.qty} × ${i.name}</li>`).join("")}</ul><button onclick="advanceKOT('${o.id}')">${label}</button></div>`;
  }).join("");
}
function advanceKOT(orderId) {
  const o = findOrder(orderId);
  if (!o) return;
  if (o.status === "new") { o.status = "preparing"; toast("Order is now preparing"); }
  else if (o.status === "preparing") { o.status = "ready"; toast("Order marked ready"); }
  else if (o.status === "ready") { o.status = "served"; toast("Order marked as served"); }
  save();
  renderAll();
}

/* ---------- orders page ---------- */
const STATUS_LABEL = { new: "Preparing", preparing: "Preparing", ready: "Ready", served: "Ready", bill: "Bill ready", paid: "Paid" };
const STATUS_PILL = { new: "cooking", preparing: "cooking", ready: "cooking", served: "cooking", bill: "bill", paid: "paid" };
let orderFilter = "all";
function renderOrderFilters() {
  const counts = { all: state.orders.length, preparing: 0, ready: 0, paid: 0 };
  state.orders.forEach(o => {
    if (["new", "preparing"].includes(o.status)) counts.preparing++;
    else if (["ready", "served", "bill"].includes(o.status)) counts.ready++;
    else if (o.status === "paid") counts.paid++;
  });
  const defs = [["all", "All"], ["preparing", "Preparing"], ["ready", "Ready"], ["paid", "Paid"]];
  document.getElementById("orderFilters").innerHTML = defs.map(([key, label]) =>
    `<button class="filter${orderFilter === key ? " active" : ""}" onclick="setOrderFilter('${key}')">${label} <b>${counts[key]}</b></button>`
  ).join("");
}
function setOrderFilter(key) { orderFilter = key; renderAll(); }
function filteredOrders() {
  if (orderFilter === "all") return state.orders;
  if (orderFilter === "preparing") return state.orders.filter(o => ["new", "preparing"].includes(o.status));
  if (orderFilter === "ready") return state.orders.filter(o => ["ready", "served", "bill"].includes(o.status));
  if (orderFilter === "paid") return state.orders.filter(o => o.status === "paid");
  return state.orders;
}
function renderOrdersTable() {
  const rows = filteredOrders();
  document.getElementById("ordersTable").innerHTML = rows.length ? rows.map(o => {
    const itemCount = o.items.reduce((a, x) => a + x.qty, 0);
    const payAction = o.status === "bill" ? `<button class="ghost" onclick="openPayment(${o.table})">Pay</button>` : "";
    return `<tr><td><b>${o.id}</b><small>${new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</small></td><td>T${String(o.table).padStart(2, "0")}</td><td>${o.server}</td><td>${itemCount} items</td><td><b>${money(o.total)}</b></td><td><span class="pill ${STATUS_PILL[o.status]}">${STATUS_LABEL[o.status]}</span> ${payAction}</td></tr>`;
  }).join("") : '<tr><td colspan="6" style="text-align:center;color:#98a19d">No orders in this view yet.</td></tr>';
}
function renderRecentOrders() {
  const rows = state.orders.slice(0, 5);
  document.getElementById("recentOrdersTable").innerHTML = rows.length ? rows.map(o => {
    const itemCount = o.items.reduce((a, x) => a + x.qty, 0);
    return `<tr><td><b>${o.id}</b><small>${new Date(o.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}</small></td><td>T${String(o.table).padStart(2, "0")}</td><td>${itemCount} items</td><td><b>${money(o.total)}</b></td><td><span class="pill ${STATUS_PILL[o.status]}">${STATUS_LABEL[o.status]}</span></td></tr>`;
  }).join("") : '<tr><td colspan="5" style="text-align:center;color:#98a19d">No orders yet today.</td></tr>';
}

/* ---------- menu page ---------- */
let activeCategory = "All";
function renderCategoryTabs() {
  document.getElementById("categoryTabs").innerHTML = CATEGORIES.map(c =>
    `<button class="${c === activeCategory ? "active" : ""}" onclick="setCategory('${c}')">${c}</button>`
  ).join("");
}
function setCategory(c) { activeCategory = c; renderMenu(); renderCategoryTabs(); }
function renderMenu() {
  const items = menu.filter(x => activeCategory === "All" || x.cat === activeCategory);
  document.getElementById("menuGrid").innerHTML = items.map(x =>
    `<div class="menu-card"><div class="food-img">${x.emoji}</div><div class="menu-info"><small>${x.cat}</small><b>${x.name}</b><strong>${money(x.price)}</strong></div></div>`
  ).join("");
}

/* ---------- payments page ---------- */
function renderPayments() {
  const total = state.payments.reduce((a, p) => a + p.amount, 0);
  const byMethod = m => state.payments.filter(p => p.method === m).reduce((a, p) => a + p.amount, 0);
  document.getElementById("payTotal").textContent = money(total);
  document.getElementById("payMpesa").textContent = money(byMethod("mpesa"));
  document.getElementById("payCash").textContent = money(byMethod("cash"));
  document.getElementById("payCard").textContent = money(byMethod("card"));
  document.getElementById("paymentsTable").innerHTML = state.payments.length ? state.payments.map(p =>
    `<tr><td><b>${p.ref}</b></td><td>${p.orderId}</td><td><span class="method ${p.method}">${p.method.toUpperCase()}</span></td><td><b>${money(p.amount)}</b></td><td>${p.time}</td><td><span class="pill paid">${p.status}</span></td></tr>`
  ).join("") : '<tr><td colspan="6" style="text-align:center;color:#98a19d">No payments recorded yet.</td></tr>';
}

/* ---------- dashboard ---------- */
function renderDashboardStats() {
  const todaySales = state.payments.reduce((a, p) => a + p.amount, 0);
  const ordersToday = state.orders.length;
  const occupied = state.tables.filter(t => t.status !== "free").length;
  const pendingOrders = state.orders.filter(o => o.status === "bill");
  const pending = pendingOrders.reduce((a, o) => a + o.total, 0);

  document.getElementById("statSales").textContent = money(todaySales);
  document.getElementById("statSalesTrend").textContent = "Live total";
  document.getElementById("statOrders").textContent = ordersToday;
  document.getElementById("statOrdersTrend").textContent = "Live total";
  document.getElementById("statTables").innerHTML = occupied + ' <small>/ ' + state.tables.length + '</small>';
  document.getElementById("statOccupancyPct").textContent = Math.round((occupied / state.tables.length) * 100) + "% occupancy";
  document.getElementById("occupancyBar").style.width = Math.round((occupied / state.tables.length) * 100) + "%";
  document.getElementById("statPending").textContent = money(pending);
  document.getElementById("statPendingCount").textContent = pendingOrders.length + " bills pending";
}
function renderActivity() {
  const el = document.getElementById("activityFeed");
  el.innerHTML = state.activity.length ? state.activity.map(a =>
    `<div class="activity-item"><div class="act-icon ${a.color}">${a.icon}</div><div><b>${a.title}</b><p>${a.detail}</p></div><strong class="${a.amountClass}">${a.amountText}</strong><small>${relTime(a.ts)}</small></div>`
  ).join("") : '<div class="empty">No activity yet.<br><small>Actions will appear here live.</small></div>';
}

/* ---------- settings ---------- */
function applyRestaurantBranding() {
  document.getElementById("sidebarRestaurantName").textContent = state.settings.restaurantName;
  document.getElementById("dashRestaurantName").textContent = state.settings.restaurantName;
  document.getElementById("offlineIndicator").style.display = state.settings.offline ? "block" : "none";
}
function loadSettingsForm() {
  document.getElementById("settingName").value = state.settings.restaurantName;
  document.getElementById("settingCurrency").value = state.settings.currency;
  document.getElementById("settingFooter").value = state.settings.receiptFooter;
  document.getElementById("settingRequireLogin").checked = state.settings.requireLogin;
  document.getElementById("settingOffline").checked = state.settings.offline;
  document.getElementById("settingBackup").checked = state.settings.backup;
}
function saveSettings() {
  state.settings.restaurantName = document.getElementById("settingName").value.trim() || "Kartell Kitchen";
  state.settings.currency = document.getElementById("settingCurrency").value.trim();
  state.settings.receiptFooter = document.getElementById("settingFooter").value.trim();
  state.settings.requireLogin = document.getElementById("settingRequireLogin").checked;
  state.settings.offline = document.getElementById("settingOffline").checked;
  state.settings.backup = document.getElementById("settingBackup").checked;
  save();
  applyRestaurantBranding();
  toast("Settings saved");
  checkLoginGate();
}

/* ---------- master render ---------- */
function renderAll() {
  renderDashFloor();
  renderLargeFloor();
  renderDashboardStats();
  renderActivity();
  renderRecentOrders();
  renderOrderFilters();
  renderOrdersTable();
  renderMenu();
  renderCategoryTabs();
  renderKOT();
  renderPayments();
}

/* ---------- search shortcut ---------- */
document.getElementById("search").addEventListener("input", e => {
  const v = e.target.value.toLowerCase();
  if (v.includes("menu")) showPage("menu");
  else if (v.includes("kitchen") || v.includes("kot")) showPage("kitchen");
  else if (v.includes("payment")) showPage("payments");
  else if (v.includes("table")) showPage("tables");
});

/* ---------- init ---------- */
document.getElementById("topDate").textContent = new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "short", year: "numeric" });
loadSettingsForm();
applyRestaurantBranding();
checkLoginGate();
updateSidebarUser();
renderAll();
