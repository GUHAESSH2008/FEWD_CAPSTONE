
const STORAGE_KEY = "expiryguard-items-v2";

const $ = id => document.getElementById(id);

let items = [];
let viewMode = "grid";
let editingId = null;

// Load products from browser storage
try {
  const saved = JSON.parse(
    localStorage.getItem(STORAGE_KEY) || "[]"
  );

  if (Array.isArray(saved)) {
    items = saved;
  }
} catch (error) {
  console.error("Could not load saved products", error);
}

// Product emojis
const productEmojis = {
  milk: "🥛",
  bread: "🍞",
  tomato: "🍅",
  rice: "🍚",
  apple: "🍎",
  banana: "🍌",
  egg: "🥚",
  cheese: "🧀",
  juice: "🧃",
  carrot: "🥕",
  soap: "🧼",
  butter: "🧈",
  yogurt: "🥣",
  coffee: "☕"
};

const categoryEmojis = {
  Groceries: "🛒",
  Dairy: "🥛",
  Beverages: "🧃",
  "Personal care": "🧴",
  Household: "🧼",
  Bakery: "🍞",
  Vegetables: "🥬",
  Grains: "🍚"
};

// Save products
function saveItems() {
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(items)
  );
}

// Calculate days until expiry
function getDaysLeft(dateText) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiry = new Date(dateText + "T00:00:00");

  const utcToday = Date.UTC(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

  const utcExpiry = Date.UTC(
    expiry.getFullYear(),
    expiry.getMonth(),
    expiry.getDate()
  );

  return Math.round(
    (utcExpiry - utcToday) / 86400000
  );
}

// Determine product status
function getStatus(days) {
  if (days < 0) return "expired";
  if (days <= 7) return "soon";
  if (days <= 30) return "first";
  return "ok";
}

function statusLabel(status) {
  const labels = {
    expired: "Expired",
    soon: "Expiring Soon",
    first: "Use First",
    ok: "Fine for Now"
  };

  return labels[status];
}

function daysLabel(days) {
  if (days < 0) {
    return `${Math.abs(days)} days past expiry`;
  }

  if (days === 0) {
    return "Expires today";
  }

  return `${days} days left`;
}

// Get suitable product emoji
function getEmoji(item) {
  const name = item.name.toLowerCase();

  for (const key in productEmojis) {
    if (name.includes(key)) {
      return productEmojis[key];
    }
  }

  return categoryEmojis[item.category] || "📦";
}

// Format date
function formatDate(dateText) {
  return new Date(
    dateText + "T00:00:00"
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric"
  });
}

// Prevent HTML injection
function escapeHTML(value) {
  return String(value).replace(
    /[&<>"']/g,
    char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]
  );
}

// Display products and update dashboard
function showItems() {
  const search = $("q").value.toLowerCase();
  const category = $("fCat").value;
  const statusFilter = $("fStatus").value;
  const sortBy = $("sort").value;

  const counts = {
    expired: 0,
    soon: 0,
    first: 0,
    ok: 0
  };

  const processed = items.map(item => {
    const days = getDaysLeft(item.date);

    return {
      ...item,
      days,
      status: getStatus(days)
    };
  });

  // Dashboard counts
  processed.forEach(item => {
    counts[item.status]++;
  });

  $("cExpired").textContent = counts.expired;
  $("cSoon").textContent = counts.soon;
  $("cFirst").textContent = counts.first;
  $("cOk").textContent = counts.ok;

  $("total").textContent = `(${items.length})`;

  // Apply filters
  let filtered = processed.filter(item => {
    return (
      item.name.toLowerCase().includes(search) &&
      (!category || item.category === category) &&
      (!statusFilter || item.status === statusFilter)
    );
  });

  // Sort products
  filtered.sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name);
    }

    return a.date.localeCompare(b.date);
  });

  const container = $("products");

  container.className =
    viewMode === "grid"
      ? "product-grid"
      : "product-list";

  container.innerHTML = "";

  $("empty").classList.toggle(
    "show",
    filtered.length === 0
  );

  // Generate product cards
  filtered.forEach(item => {
    const card = document.createElement("article");
    card.className = "card";

    card.innerHTML = `
      <div class="visual">
        <span class="pill ${item.status}">
          ${statusLabel(item.status)}
        </span>
        ${getEmoji(item)}
      </div>

      <div class="card-content">
        <h3>${escapeHTML(item.name)}</h3>

        <span class="chip">
          ${escapeHTML(item.category)}
        </span>

        <p class="meta">
          Quantity:
          <b>${escapeHTML(item.qty)}</b>
        </p>

        <p class="meta">
          Expiry:
          <b>${formatDate(item.date)}</b>
        </p>

        <div class="days ${item.status}">
          <span>${daysLabel(item.days)}</span>

          <span class="actions">
            <button
              type="button"
              data-edit="${item.id}"
              title="Edit product">
              ✎
            </button>

            <button
              type="button"
              class="delete"
              data-delete="${item.id}"
              title="Delete product">
              🗑
            </button>
          </span>
        </div>
      </div>
    `;

    container.appendChild(card);
  });
}

// Add or update product
$("form").addEventListener("submit", function(event) {
  event.preventDefault();

  const name = $("name").value.trim();
  const category = $("cat").value;
  const qty = Number($("qty").value);
  const date = $("date").value;

  if (
    !name ||
    !date ||
    !Number.isInteger(qty) ||
    qty < 1
  ) {
    $("err").textContent =
      "Please fill in all fields correctly.";
    return;
  }

  if (editingId !== null) {
    const item = items.find(
      product => product.id === editingId
    );

    if (item) {
      item.name = name;
      item.category = category;
      item.qty = qty;
      item.date = date;
    }

    editingId = null;
  } else {
    items.push({
      id: crypto.randomUUID
        ? crypto.randomUUID()
        : String(Date.now() + Math.random()),
      name,
      category,
      qty,
      date
    });
  }

  saveItems();
  $("form").reset();
  $("qty").value = 1;
  $("err").textContent = "";

  document.querySelector(".add-btn").textContent =
    "＋ Add Product";

  showItems();
});

// Edit and delete product
$("products").addEventListener("click", function(event) {
  const editButton = event.target.closest("[data-edit]");
  const deleteButton = event.target.closest("[data-delete]");

  if (editButton) {
    const item = items.find(
      product => product.id === editButton.dataset.edit
    );

    if (!item) return;

    editingId = item.id;

    $("name").value = item.name;
    $("cat").value = item.category;
    $("qty").value = item.qty;
    $("date").value = item.date;

    document.querySelector(".add-btn").textContent =
      "✓ Save Changes";

    $("add").scrollIntoView({
      behavior: "smooth"
    });

    $("name").focus();
  }

  if (deleteButton) {
    if (!confirm("Remove this product?")) return;

    items = items.filter(
      product => product.id !== deleteButton.dataset.delete
    );

    saveItems();
    showItems();
  }
});

// Search and filters
["q", "fCat", "fStatus", "sort"].forEach(id => {
  $(id).addEventListener(
    id === "q" ? "input" : "change",
    showItems
  );
});

// Grid view
$("grid").addEventListener("click", function() {
  viewMode = "grid";

  $("grid").classList.add("selected");
  $("list").classList.remove("selected");

  showItems();
});

// List view
$("list").addEventListener("click", function() {
  viewMode = "list";

  $("list").classList.add("selected");
  $("grid").classList.remove("selected");

  showItems();
});

// Import old ExpiryGuard data if available
if (items.length === 0) {
  try {
    const oldItems = JSON.parse(
      localStorage.getItem("items") || "[]"
    );

    if (Array.isArray(oldItems) && oldItems.length) {
      items = oldItems.map((item, index) => ({
        ...item,
        id: item.id || `old-${index}-${Date.now()}`
      }));

      saveItems();
    }
  } catch (error) {
    console.error("Could not import old items", error);
  }
}

// Load dashboard
showItems();
