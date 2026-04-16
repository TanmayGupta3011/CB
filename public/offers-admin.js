// ── TOAST ─────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── AUTH CHECK (your original logic) ─────────────────────
fetch("/orders")
  .then(res => {
    if (res.status === 403) {
      window.location.href = "/admin-login.html";
      return;
    }
    loadOffers();
  });

// ── LOAD OFFERS (your original logic, new render) ─────────
function loadOffers() {
  fetch("/offers")
    .then(res => res.json())
    .then(data => {
      const div     = document.getElementById("offersList");
      const countEl = document.getElementById("offer-count");
      div.innerHTML = "";
      if (countEl) countEl.textContent = data.length + " offer" + (data.length !== 1 ? "s" : "");

      if (!data.length) {
        div.innerHTML = '<div class="empty-list">No offers yet. Add your first one above!</div>';
        return;
      }

      data.forEach((offer, i) => {
        const card = document.createElement("div");
        card.className = "offer-row";
        card.style.animationDelay = (i * 0.05) + 's';

        const imgHTML = (offer.image && offer.image.trim())
          ? `<img src="${offer.image}" class="offer-row-img" alt="${offer.title}">`
          : `<div class="offer-row-no-img">🌿</div>`;

        card.innerHTML = `
          ${imgHTML}
          <div class="offer-row-body">
            <div class="offer-row-title">${offer.title}</div>
            <div class="offer-row-desc">${offer.description}</div>
            <div class="offer-row-price">₹${offer.price}</div>
          </div>
          <div class="offer-row-footer">
            <button class="del-btn" onclick="deleteOffer('${offer._id}', '${offer.title}')">Remove offer</button>
          </div>`;

        div.appendChild(card);
      });
    });
}

// ── ADD OFFER (your original logic) ──────────────────────
function addOffer() {
  const title       = document.getElementById("title").value.trim();
  const description = document.getElementById("description").value.trim();
  const price       = Number(document.getElementById("price").value);
  const image       = document.getElementById("image").value.trim();

  if (!title)       { showToast("Please enter an offer title."); return; }
  if (!description) { showToast("Please enter a description."); return; }
  if (!price)       { showToast("Please enter a valid price."); return; }

  fetch("/admin/offers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, price, image })
  })
  .then(() => {
    document.getElementById("title").value       = "";
    document.getElementById("description").value = "";
    document.getElementById("price").value       = "";
    document.getElementById("image").value       = "";
    showToast("Offer added!");
    loadOffers();
  });
}

// ── DELETE OFFER (your original logic) ───────────────────
function deleteOffer(id, title) {
  if (!confirm(`Remove "${title}"?`)) return;
  fetch(`/admin/offers/${id}`, { method: "DELETE" })
    .then(() => {
      showToast("Offer removed.");
      loadOffers();
    });
}

// ── LOGOUT (your original logic) ─────────────────────────
function logout() {
  fetch("/admin/logout", { method: "POST" })
    .then(() => window.location.href = "/admin-login.html");
}