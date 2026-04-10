export async function api(path, options = {}) {
  const token = localStorage.getItem("token");
  const isFormData = options.body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || "Request failed");
  return data;
}

export function getUser() {
  try {
    return JSON.parse(localStorage.getItem("user"));
  } catch {
    return null;
  }
}
export function isLoggedIn() {
  return !!localStorage.getItem("token");
}
export function isAdmin() {
  return getUser()?.role === "ADMIN";
}

export function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  window.location.href = "/";
}

export function formatPrice(cents) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

export function toast(message, type = "success") {
  document.querySelectorAll(".sf-toast").forEach((t) => t.remove());
  const el = document.createElement("div");
  el.className =
    "sf-toast fixed bottom-6 right-6 z-[9999] px-6 py-3 text-lg font-semibold bg-white shadow-[0_12px_24px_0_rgba(0,0,0,0.09)] border-l-4 " +
    (type === "error"
      ? "border-red-600 text-red-700"
      : "border-red-600 text-[#393939]");
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => {
    el.style.transition = "opacity 0.3s";
    el.style.opacity = "0";
    setTimeout(() => el.remove(), 300);
  }, 3000);
}

export async function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  if (!badge || !isLoggedIn()) return;
  try {
    const { items } = await api("/cart");
    const count = items.reduce((s, i) => s + i.quantity, 0);
    badge.textContent = count;
    badge.className =
      count > 0
        ? "bg-red-600 text-white rounded-full min-w-[2rem] min-h-[2rem] inline-flex items-center justify-center text-xs font-bold ml-2 px-1"
        : "hidden";
  } catch {}
}

// Shared nav HTML injected into every page
export function renderNav(containerId = "main-nav") {
  const el = document.getElementById(containerId);
  if (!el) return;
  const user = getUser();

  const linkCls =
    "nav-link relative px-8 py-4 flex items-center text-[#393939] uppercase font-black text-xl no-underline hover:no-underline cursor-pointer bg-transparent border-0 font-[inherit]";

  el.innerHTML = `
    ${user ? `<a href="/pages/sell.html" class="${linkCls}">Sell</a>` : ""}
    ${user?.role === 'ADMIN' ? `<a href="/admin" class="${linkCls}">Admin</a>` : ""}
    ${user ? `<a href="/pages/orders.html" class="${linkCls}">Orders</a>` : ""}
    ${user ? `<a href="/pages/account.html" class="${linkCls}">Account</a>` : ""}

    ${!user ? `<a href="/pages/login.html" class="${linkCls}">Sign In</a>` : ""}
    ${user ? `<button onclick="import('/js/utils.js').then(m=>m.logout())" class="${linkCls}">Sign Out</button>` : ""}
    <button onclick="window.toggleCart ? window.toggleCart() : window.location.href='/pages/cart.html'" class="${linkCls}">
      My Cart
      <span id="cart-badge" class="hidden bg-red-600 text-white rounded-full min-w-[2rem] min-h-[2rem] inline-flex items-center justify-center text-xs font-bold ml-2 px-1">0</span>
    </button>
  `;
}
