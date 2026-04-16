// ── TOAST ─────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2800);
}

function itemEmoji(name) {
  const n = name.toLowerCase();
  if (/coffee|espresso|latte|cappuccino|mocha|americano|brew/i.test(n)) return '☕';
  if (/tea|chai|matcha|herbal/i.test(n)) return '🍵';
  if (/cake|muffin|brownie|pastry|cookie|scone|biscuit/i.test(n)) return '🧁';
  if (/sandwich|wrap|burger|roll|toast/i.test(n)) return '🥪';
  if (/salad|bowl|soup/i.test(n)) return '🥗';
  if (/juice|shake|smoothie|lassi/i.test(n)) return '🥤';
  return '🍽️';
}

function guessCategory(name) {
  const n = name.toLowerCase();
  if (/coffee|espresso|latte|cappuccino|mocha|americano|brew/i.test(n)) return 'Coffee';
  if (/tea|chai|matcha|herbal/i.test(n)) return 'Tea';
  if (/cake|muffin|brownie|pastry|cookie|scone|biscuit/i.test(n)) return 'Bakery';
  if (/sandwich|wrap|burger|roll|toast/i.test(n)) return 'Bites';
  if (/juice|shake|smoothie|lassi/i.test(n)) return 'Drinks';
  return 'Food';
}

// ── CART ─────────────────────────────────────────────────
let cart = JSON.parse(localStorage.getItem("cart")) || [];

function saveCart() { localStorage.setItem("cart", JSON.stringify(cart)); }

function addToCart(item) {
  const existing = cart.find(i => i.name === item.name);
  if (existing) { existing.qty += 1; }
  else { cart.push({ name: item.name, price: item.price, qty: 1 }); }
  saveCart();
  updateCartBadge();
  showToast(item.name + " added! 🌿");
}

function updateCartBadge() {
  const badge = document.getElementById("cartBadge");
  if (!badge) return;
  const total = cart.reduce((s, i) => s + i.qty, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? "flex" : "none";
}

// ── MENU ─────────────────────────────────────────────────
let allMenuItems = [];

fetch("/menu")
  .then(res => res.json())
  .then(data => { allMenuItems = data; renderMenu(allMenuItems); })
  .catch(() => {
    document.getElementById("menu").innerHTML =
      '<p style="grid-column:1/-1;text-align:center;color:#7A5C3E;padding:40px">Could not load menu.</p>';
  });

function renderMenu(items) {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";

  if (!items.length) {
    menuDiv.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#7A5C3E;padding:40px;font-style:italic">No items found.</p>';
    return;
  }

  items.forEach((item, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.animationDelay = (i * 0.045) + 's';

    const imageHTML = (item.image && item.image.trim())
      ? `<img src="${item.image}" class="food-img" alt="${item.name}">`
      : `<div class="card-no-img">${itemEmoji(item.name)}</div>`;

    card.innerHTML = `
      ${imageHTML}
      <div class="card-body">
        <p class="card-category">${guessCategory(item.name)}</p>
        <h3>${item.name}</h3>
        <div class="card-footer">
          <span class="card-price">₹${item.price}</span>
          <button class="add-btn" ${!item.inStock ? "disabled" : ""}>${item.inStock ? "+ Add" : "Out of Stock"}</button>
        </div>
      </div>`;

    card.querySelector(".add-btn").onclick = () => addToCart(item);
    menuDiv.appendChild(card);
  });
}

// ── SEARCH ───────────────────────────────────────────────
const searchInput = document.getElementById("searchInput");
if (searchInput) {
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.toLowerCase();
    renderMenu(allMenuItems.filter(item => item.name.toLowerCase().includes(q)));
  });
}

// ── AUTH CHECK ────────────────────────────────────────────
fetch("/myorders")
  .then(res => {
    if (res.ok) {
      const loginLink  = document.getElementById("loginLink");
      const logoutLink = document.getElementById("logoutLink");
      if (loginLink)  loginLink.style.display  = "none";
      if (logoutLink) logoutLink.style.display = "inline";
    }
  })
  .catch(() => {});

function logout() {
  fetch("/logout", { method: "POST" })
    .then(() => window.location.href = "/login.html");
}

// ── INIT ─────────────────────────────────────────────────
updateCartBadge();