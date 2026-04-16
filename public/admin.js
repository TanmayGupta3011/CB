// ── STATE ─────────────────────────────────────────────────
let allOrders = [];
let currentFilter = 'all';

const STATUS_LABELS = {
  pending:'Pending', accepted:'Accepted', out_for_delivery:'On the way',
  delivered:'Delivered', declined:'Declined', cancelled:'Cancelled'
};

// ── TOAST ─────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── LOGOUT ────────────────────────────────────────────────
function logout() {
  fetch("/admin/logout", { method:"POST" })
    .then(() => window.location.href = "/admin-login.html");
}

// ── TOGGLE CARD ───────────────────────────────────────────
function toggleCard(id) {
  document.getElementById('card-' + id).classList.toggle('expanded');
}

// ── LOAD ORDERS ───────────────────────────────────────────
function loadOrders() {
  fetch("/orders")
    .then(res => {
      if (res.status === 403) { window.location.href = "/admin-login.html"; return; }
      return res.json();
    })
    .then(data => {
      if (!data) return;
      allOrders = data;
      renderStats();
      renderOrders();
    });
}

// ── STATS STRIP ───────────────────────────────────────────
function renderStats() {
  const strip   = document.getElementById('stats-strip');
  const pending = allOrders.filter(o => o.status === 'pending').length;
  const active  = allOrders.filter(o => ['accepted','out_for_delivery'].includes(o.status)).length;
  const done    = allOrders.filter(o => o.status === 'delivered').length;
  const revenue = allOrders.filter(o => o.status === 'delivered').reduce((s,o) => s + o.totalAmount, 0);

  strip.innerHTML = `
    <div class="stat-card"><div class="stat-label">Total orders</div><div class="stat-value">${allOrders.length}</div></div>
    <div class="stat-card"><div class="stat-label">Pending</div><div class="stat-value accent">${pending}</div></div>
    <div class="stat-card"><div class="stat-label">Active</div><div class="stat-value">${active}</div></div>
    <div class="stat-card"><div class="stat-label">Delivered</div><div class="stat-value">${done}</div></div>
    <div class="stat-card"><div class="stat-label">Revenue</div><div class="stat-value">₹${revenue}</div></div>`;
}

// ── RENDER ORDERS ─────────────────────────────────────────
function renderOrders() {
  const list = document.getElementById('orders-list');
  const filtered = currentFilter === 'all'
    ? allOrders
    : allOrders.filter(o => o.status === currentFilter);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="icon">📋</div><p>No orders in this category.</p></div>`;
    return;
  }

  list.innerHTML = '';
  filtered.forEach((order, i) => list.appendChild(buildCard(order, i)));
}

// ── BUILD SINGLE CARD ─────────────────────────────────────
function buildCard(order, i) {
  const date    = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  const shortId = order._id.slice(-6).toUpperCase();

  const itemsHTML = order.items.map(item => `
    <tr>
      <td><span class="iqty">${item.qty}×</span>${item.name}</td>
      <td>₹${item.price * item.qty}</td>
    </tr>`).join('');

  // ── Phone number row ──────────────────────────────────
  // order.userId is populated if you use .populate('userId') in the backend,
  // OR we store phone on the order itself (see index.js changes below).
  // We show it if present, otherwise show a dash.
  const phone = order.userPhone || (order.userId && order.userId.phone) || null;
  const phoneRow = phone
    ? `<div class="oc-info-row"><span class="oc-info-lbl">Phone</span><a href="tel:${phone}" class="oc-phone">${phone}</a></div>`
    : `<div class="oc-info-row"><span class="oc-info-lbl">Phone</span><span class="oc-info-val muted">Not provided</span></div>`;

  const isCancelled = order.status === 'cancelled';
  const isTerminal  = ['delivered','declined','cancelled'].includes(order.status);

  const buttonsHTML = isCancelled
    ? `<p class="terminal-msg">Cancelled by customer.</p>`
    : isTerminal
    ? `<p class="terminal-msg">Order is ${STATUS_LABELS[order.status] || order.status}.</p>`
    : `<div class="action-row">
        <button class="act-btn accept"   onclick="updateStatus('${order._id}','accepted',this)">✓ Accept</button>
        <button class="act-btn dispatch" onclick="updateStatus('${order._id}','out_for_delivery',this)">🚴 Dispatch</button>
        <button class="act-btn deliver"  onclick="updateStatus('${order._id}','delivered',this)">✅ Delivered</button>
        <button class="act-btn decline"  onclick="updateStatus('${order._id}','declined',this)">✕ Decline</button>
       </div>`;

  const card = document.createElement('div');
  card.className = 'order-card';
  card.id = 'card-' + order._id;
  card.style.animationDelay = (i * 0.04) + 's';

  card.innerHTML = `
    <div class="oc-head" onclick="toggleCard('${order._id}')">
      <div class="oc-meta">
        <span class="oc-id">Order #${shortId}</span>
        <span class="oc-date">${dateStr} · ${timeStr}</span>
      </div>
      <div class="oc-right">
        <span class="oc-amount">₹${order.totalAmount}</span>
        <span class="status-badge status-${order.status}" id="badge-${order._id}">${STATUS_LABELS[order.status] || order.status}</span>
        <span class="chevron">▼</span>
      </div>
    </div>
    <div class="oc-body">
      <div class="oc-body-inner">
        <div class="oc-info-grid">
          <div class="oc-info-row">
            <span class="oc-info-lbl">Address</span>
            <span class="oc-info-val">${order.address || 'Not provided'}</span>
          </div>
          ${phoneRow}
        </div>
        <table class="items-table">
          <thead><tr><th>Item</th><th>Price</th></tr></thead>
          <tbody>${itemsHTML}</tbody>
        </table>
        <div id="actions-${order._id}">${buttonsHTML}</div>
      </div>
    </div>`;

  return card;
}

// ── UPDATE STATUS — instant, no reload ───────────────────
function updateStatus(id, status, btn) {
  const actionsDiv = document.getElementById('actions-' + id);
  const allBtns = actionsDiv ? actionsDiv.querySelectorAll('.act-btn') : [];
  allBtns.forEach(b => { b.disabled = true; b.classList.add('loading'); });

  fetch(`/orders/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status })
  })
  .then(res => res.json())
  .then(data => {
    if (data.error) {
      showToast('Error: ' + data.error);
      allBtns.forEach(b => { b.disabled = false; b.classList.remove('loading'); });
      return;
    }

    // Update badge instantly
    const badge = document.getElementById('badge-' + id);
    if (badge) {
      badge.textContent = STATUS_LABELS[status] || status;
      badge.className   = 'status-badge status-' + status;
    }

    // Update local state
    const order = allOrders.find(o => o._id === id);
    if (order) order.status = status;

    // Swap buttons to terminal message if done
    const isTerminal = ['delivered','declined'].includes(status);
    if (actionsDiv && isTerminal) {
      actionsDiv.innerHTML = `<p class="terminal-msg">Order is ${STATUS_LABELS[status]}.</p>`;
    } else {
      allBtns.forEach(b => { b.disabled = false; b.classList.remove('loading'); });
    }

    renderStats();
    showToast('Updated to: ' + (STATUS_LABELS[status] || status));
  })
  .catch(() => {
    allBtns.forEach(b => { b.disabled = false; b.classList.remove('loading'); });
    showToast('Network error. Please try again.');
  });
}

// ── FILTER TABS ───────────────────────────────────────────
document.getElementById('filter-tabs').addEventListener('click', e => {
  const btn = e.target.closest('.ftab');
  if (!btn) return;
  document.querySelectorAll('.ftab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  currentFilter = btn.dataset.filter;
  renderOrders();
});

// ── INIT ─────────────────────────────────────────────────
loadOrders();
setInterval(loadOrders, 30000); // auto-refresh every 30s