const STATUS_LABELS = {
  pending:'Pending', accepted:'Accepted', out_for_delivery:'On the way',
  delivered:'Delivered', declined:'Declined', cancelled:'Cancelled'
};
const STATUS_STEPS = ['pending','accepted','out_for_delivery','delivered'];

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function logout() {
  fetch("/logout", { method:"POST" }).then(() => window.location.href = "/login.html");
}

function toggleCard(id) {
  document.getElementById('card-' + id).classList.toggle('expanded');
}

function buildTracker(status) {
  if (status === 'cancelled' || status === 'declined') {
    return `<div class="tracker"><div class="t-step bad">
      <div class="t-dot">✕</div>
      <div class="t-label">${STATUS_LABELS[status]}</div>
    </div></div>`;
  }
  const cur = STATUS_STEPS.indexOf(status);
  return `<div class="tracker">${STATUS_STEPS.map((s, i) => `
    <div class="t-step ${i < cur ? 'done' : i === cur ? 'current' : ''}">
      <div class="t-dot">${i < cur ? '✓' : ''}</div>
      <div class="t-label">${STATUS_LABELS[s]}</div>
    </div>`).join('')}</div>`;
}

function renderOrderCard(order, index) {
  const date    = new Date(order.createdAt);
  const dateStr = date.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
  const timeStr = date.toLocaleTimeString('en-IN', { hour:'2-digit', minute:'2-digit' });
  const shortId = order._id.slice(-6).toUpperCase();

  const itemsHTML = order.items.map(i => `
    <tr>
      <td><span class="iqty">${i.qty}×</span>${i.name}</td>
      <td>₹${i.price * i.qty}</td>
    </tr>`).join('');

  const cancelBtn = order.status === 'pending'
    ? `<div class="cancel-row"><button class="cancel-btn" onclick="cancelOrder('${order._id}')">Cancel order</button></div>` : '';

  const card = document.createElement('div');
  card.className = 'order-card';
  card.id = 'card-' + order._id;
  card.style.animationDelay = (index * 0.06) + 's';
  card.innerHTML = `
    <div class="oc-header" onclick="toggleCard('${order._id}')">
      <div class="oc-meta">
        <span class="oc-id">Order #${shortId}</span>
        <span class="oc-date">${dateStr} · ${timeStr}</span>
      </div>
      <div class="oc-right">
        <span class="oc-amount">₹${order.totalAmount}</span>
        <span class="status-badge status-${order.status}">${STATUS_LABELS[order.status] || order.status}</span>
        <span class="chevron">▼</span>
      </div>
    </div>
    <div class="oc-body"><div class="oc-body-inner">
      ${buildTracker(order.status)}
      <table class="items-table">
        <thead><tr><th>Item</th><th>Price</th></tr></thead>
        <tbody>${itemsHTML}</tbody>
      </table>
      <div class="oc-address">
        <span class="oc-addr-lbl">Deliver to</span>${order.address}
      </div>
      ${cancelBtn}
    </div></div>`;
  return card;
}

function renderSummary(orders) {
  const strip = document.getElementById('summary-strip');
  if (!strip) return;
  const delivered = orders.filter(o => o.status === 'delivered').length;
  const active    = orders.filter(o => ['pending','accepted','out_for_delivery'].includes(o.status)).length;
  const cancelled = orders.filter(o => ['cancelled','declined'].includes(o.status)).length;
  strip.innerHTML = `
    <div class="s-card"><div class="s-label">Total orders</div><div class="s-value">${orders.length}</div></div>
    <div class="s-card"><div class="s-label">Delivered</div><div class="s-value">${delivered}</div></div>
    <div class="s-card"><div class="s-label">Active now</div><div class="s-value accent">${active}</div></div>
    <div class="s-card"><div class="s-label">Cancelled</div><div class="s-value">${cancelled}</div></div>`;
  strip.style.display = 'grid';
}

function cancelOrder(id) {
  if (!confirm("Are you sure you want to cancel this order?")) return;
  fetch(`/orders/${id}/cancel`, { method:"PATCH" })
    .then(res => res.json())
    .then(data => {
      showToast(data.message || data.error || "Done");
      setTimeout(() => location.reload(), 900);
    })
    .catch(err => console.error(err));
}

fetch("/myorders")
  .then(res => {
    if (!res.ok) { window.location.href = "/login.html"; return; }
    return res.json();
  })
  .then(orders => {
    if (!orders) return;
    const loginLink  = document.getElementById("loginLink");
    const logoutLink = document.getElementById("logoutLink");
    if (loginLink)  loginLink.style.display  = "none";
    if (logoutLink) logoutLink.style.display = "inline";
    const div = document.getElementById("orders");
    div.innerHTML = "";
    if (!orders.length) {
      div.innerHTML = `
        <div class="empty-state">
          <div class="icon">🌿</div>
          <h3>No orders yet</h3>
          <p>You haven't placed any orders yet.</p>
          <a href="/">Go to menu</a>
        </div>`;
      return;
    }
    renderSummary(orders);
    orders.forEach((order, i) => div.appendChild(renderOrderCard(order, i)));
  });