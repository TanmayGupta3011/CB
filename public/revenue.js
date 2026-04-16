function logout() {
  fetch("/admin/logout", { method:"POST" })
    .then(() => window.location.href = "/admin-login.html");
}

// ── FETCH REVENUE STATS ───────────────────────────────────
fetch("/admin/revenue")
  .then(res => {
    if (res.status === 403) { window.location.href = "/admin-login.html"; return; }
    return res.json();
  })
  .then(data => {
    if (!data) return;
    renderBigStats(data);
  });

// ── FETCH ALL ORDERS for chart + table ───────────────────
fetch("/orders")
  .then(res => {
    if (res.status === 403) { window.location.href = "/admin-login.html"; return; }
    return res.json();
  })
  .then(orders => {
    if (!orders) return;
    renderChart(orders);
    renderTable(orders);
  });

// ── BIG STAT CARDS ────────────────────────────────────────
function renderBigStats(data) {
  document.getElementById('big-stats').innerHTML = `
    <div class="big-card accent">
      <div class="big-label">Total revenue</div>
      <div class="big-value">₹${data.totalRevenue}</div>
      <div class="big-sub">All time, delivered orders</div>
    </div>
    <div class="big-card green">
      <div class="big-label">Today's revenue</div>
      <div class="big-value">₹${data.todayRevenue}</div>
      <div class="big-sub">${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'short'})}</div>
    </div>
    <div class="big-card blue">
      <div class="big-label">This month</div>
      <div class="big-value">₹${data.monthRevenue}</div>
      <div class="big-sub">${new Date().toLocaleDateString('en-IN',{month:'long',year:'numeric'})}</div>
    </div>
    <div class="big-card">
      <div class="big-label">Delivered orders</div>
      <div class="big-value">${data.totalOrders}</div>
      <div class="big-sub">Completed successfully</div>
    </div>`;
}

// ── CHART: daily revenue last 7 days ─────────────────────
function renderChart(orders) {
  const delivered = orders.filter(o => o.status === 'delivered');

  // Build last 7 days labels + amounts
  const days = [];
  const amounts = [];
  for (let d = 6; d >= 0; d--) {
    const date = new Date();
    date.setDate(date.getDate() - d);
    const label = date.toLocaleDateString('en-IN', { weekday:'short', day:'numeric' });
    days.push(label);

    const dayTotal = delivered
      .filter(o => new Date(o.createdAt).toDateString() === date.toDateString())
      .reduce((s, o) => s + o.totalAmount, 0);
    amounts.push(dayTotal);
  }

  const ctx = document.getElementById('revenueChart').getContext('2d');
  new Chart(ctx, {
    type: 'bar',
    data: {
      labels: days,
      datasets: [{
        label: 'Revenue (₹)',
        data: amounts,
        backgroundColor: 'rgba(176, 90, 47, 0.2)',
        borderColor: '#B05A2F',
        borderWidth: 2,
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => '₹' + ctx.parsed.y
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f0f0f0' },
          ticks: {
            callback: v => '₹' + v,
            font: { size: 11 }
          }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 11 } }
        }
      }
    }
  });
}

// ── RECENT ORDERS TABLE ───────────────────────────────────
function renderTable(orders) {
  const tbody    = document.getElementById('orders-table');
  const delivered = orders.filter(o => o.status === 'delivered').slice(0, 15);

  if (!delivered.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-msg">No delivered orders yet.</td></tr>';
    return;
  }

  tbody.innerHTML = delivered.map(o => {
    const shortId  = o._id.slice(-6).toUpperCase();
    const itemsStr = o.items.map(i => i.name + ' ×' + i.qty).join(', ');
    return `<tr>
      <td>#${shortId}</td>
      <td style="max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${itemsStr}</td>
      <td>₹${o.totalAmount}</td>
      <td><span class="delivered-pill">Delivered</span></td>
    </tr>`;
  }).join('');
}