// ── TOAST ─────────────────────────────────────────────────
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

// ── IMAGE HANDLING ────────────────────────────────────────
// Reads local file → resizes to max 800×600 → returns base64 JPEG
function resizeImageFile(file, maxW = 800, maxH = 600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = e => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        let { width: w, height: h } = img;
        const ratio = Math.min(maxW / w, maxH / h, 1); // never upscale
        w = Math.round(w * ratio);
        h = Math.round(h * ratio);

        const canvas = document.createElement('canvas');
        canvas.width  = w;
        canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

// Preview selected image in the form
document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('imageFile');
  const preview   = document.getElementById('imagePreview');
  const urlInput  = document.getElementById('image');

  if (fileInput && preview) {
    fileInput.addEventListener('change', async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const b64 = await resizeImageFile(file);
        preview.src   = b64;
        preview.style.display = 'block';
        urlInput.value = ''; // clear URL field if file chosen
      } catch {
        showToast('Could not read image file.');
      }
    });
  }

  // Clear file input when URL typed
  if (urlInput && fileInput) {
    urlInput.addEventListener('input', () => {
      if (urlInput.value.trim()) {
        fileInput.value = '';
        if (preview) { preview.src = ''; preview.style.display = 'none'; }
      }
    });
  }
});

// ── AUTH CHECK ────────────────────────────────────────────
fetch("/orders")
  .then(res => {
    if (res.status === 403) { window.location.href = "/admin-login.html"; return; }
    return res.json();
  })
  .then(() => { loadMenu(); });

// ── LOAD MENU ─────────────────────────────────────────────
function loadMenu() {
  fetch("/menu")
    .then(res => res.json())
    .then(data => {
      const div     = document.getElementById("menuList");
      const countEl = document.getElementById("item-count");
      div.innerHTML = "";
      if (countEl) countEl.textContent = data.length + " item" + (data.length !== 1 ? "s" : "");

      if (!data.length) {
        div.innerHTML = '<div class="empty-list">No menu items yet. Add your first dish above!</div>';
        return;
      }

      data.forEach((item, i) => {
        const row = document.createElement("div");
        row.className = "menu-row";
        row.style.animationDelay = (i * 0.04) + 's';

        const imgHTML = (item.image && item.image.trim())
          ? `<div class="row-img"><img src="${item.image}" alt="${item.name}"></div>`
          : `<div class="row-img">🍽️</div>`;

        row.innerHTML = `
          ${imgHTML}
          <div class="row-info">
            <div class="row-name">${item.name}</div>
            <div class="row-price">₹${item.price}</div>
          </div>
          <span class="stock-pill ${item.inStock ? 'stock-in' : 'stock-out'}">
            ${item.inStock ? 'In Stock' : 'Out of Stock'}
          </span>
          <div class="row-actions">
            <button class="row-btn" onclick="toggleStock('${item._id}', ${item.inStock})">
              ${item.inStock ? 'Mark Out' : 'Mark In'}
            </button>
            <button class="row-btn danger" onclick="deleteItem('${item._id}', '${item.name.replace(/'/g,"\\'")}')">Delete</button>
          </div>`;

        div.appendChild(row);
      });
    });
}

// ── ADD ITEM ─────────────────────────────────────────────
async function addItem() {
  const name     = document.getElementById("name").value.trim();
  const price    = Number(document.getElementById("price").value);
  const urlInput = document.getElementById("image").value.trim();
  const fileInput = document.getElementById("imageFile");
  const preview   = document.getElementById("imagePreview");

  if (!name)  { showToast("Please enter a dish name."); return; }
  if (!price) { showToast("Please enter a valid price."); return; }

  let image = urlInput; // default: use URL

  // If file chosen, use the resized base64 from preview
  if (fileInput && fileInput.files[0] && preview && preview.src && preview.src.startsWith('data:')) {
    image = preview.src;
  }

  fetch("/admin/menu", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, image })
  })
  .then(() => {
    document.getElementById("name").value  = "";
    document.getElementById("price").value = "";
    document.getElementById("image").value = "";
    if (fileInput) fileInput.value = "";
    if (preview) { preview.src = ""; preview.style.display = "none"; }
    showToast(name + " added to menu!");
    loadMenu();
  });
}

// ── TOGGLE STOCK ──────────────────────────────────────────
function toggleStock(id, currentStock) {
  fetch(`/admin/menu/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ inStock: !currentStock })
  })
  .then(() => { showToast("Stock status updated."); loadMenu(); });
}

// ── DELETE ITEM ───────────────────────────────────────────
function deleteItem(id, name) {
  if (!confirm(`Delete "${name}" from the menu?`)) return;
  fetch(`/admin/menu/${id}`, { method: "DELETE" })
    .then(() => { showToast(name + " removed."); loadMenu(); });
}

// ── LOGOUT ────────────────────────────────────────────────
function logout() {
  fetch("/admin/logout", { method:"POST" })
    .then(() => window.location.href = "/admin-login.html");
}