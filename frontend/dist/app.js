// ─── TYPES ────────────────────────────────────────────────────────────────────
// ─── CONFIG ───────────────────────────────────────────────────────────────────
const API_BASE = "http://localhost:5001/api";
// ─── AUTH ─────────────────────────────────────────────────────────────────────
export const Auth = {
    getToken: () => localStorage.getItem("travel_token"),
    getUser: () => {
        try {
            return JSON.parse(localStorage.getItem("travel_user") ?? "null");
        }
        catch {
            return null;
        }
    },
    setSession: (token, user) => {
        localStorage.setItem("travel_token", token);
        localStorage.setItem("travel_user", JSON.stringify(user));
    },
    clearSession: () => {
        localStorage.removeItem("travel_token");
        localStorage.removeItem("travel_user");
    },
    isLoggedIn: () => !!localStorage.getItem("travel_token"),
};
// ─── API CLIENT ───────────────────────────────────────────────────────────────
async function request(method, path, body = null) {
    const headers = { "Content-Type": "application/json" };
    const token = Auth.getToken();
    if (token)
        headers["Authorization"] = `Bearer ${token}`;
    const opts = { method, headers };
    if (body)
        opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const err = new Error(data.error ?? "Request failed");
        err.status = res.status;
        err.fields = data.fields;
        throw err;
    }
    return data;
}
export const api = {
    get: (path) => request("GET", path),
    post: (path, body) => request("POST", path, body),
    put: (path, body) => request("PUT", path, body),
    delete: (path) => request("DELETE", path),
};
// ─── NAVBAR ───────────────────────────────────────────────────────────────────
export function renderNav() {
    const userInfo = document.getElementById("nav-user-info");
    const navLinks = document.getElementById("nav-auth-links");
    if (!userInfo || !navLinks)
        return;
    const user = Auth.getUser();
    if (user) {
        userInfo.innerHTML = `Logged in as <strong>${escapeHtml(user.username)}</strong>`;
        navLinks.innerHTML = `
      <li><a href="create.html" class="nav-link">+ New Destination</a></li>
      <li><button class="nav-btn outline" id="logout-btn">Log out</button></li>
    `;
        document.getElementById("logout-btn")?.addEventListener("click", logout);
    }
    else {
        userInfo.innerHTML = "";
        navLinks.innerHTML = `
      <li><a href="login.html" class="nav-btn outline">Log in</a></li>
      <li><a href="signup.html" class="nav-btn">Sign up</a></li>
    `;
    }
}
export function logout() {
    Auth.clearSession();
    window.location.href = "index.html";
}
// ─── FORM HELPERS ─────────────────────────────────────────────────────────────
export function showFieldError(id, msg) {
    const el = document.getElementById(`${id}-error`);
    const input = document.getElementById(id);
    if (el) {
        el.textContent = msg;
        el.classList.add("visible");
    }
    if (input)
        input.classList.add("invalid");
}
export function clearFieldError(id) {
    const el = document.getElementById(`${id}-error`);
    const input = document.getElementById(id);
    if (el) {
        el.textContent = "";
        el.classList.remove("visible");
    }
    if (input)
        input.classList.remove("invalid");
}
export function clearAllFieldErrors() {
    document.querySelectorAll(".field-error").forEach(e => {
        e.textContent = "";
        e.classList.remove("visible");
    });
    document.querySelectorAll(".form-control").forEach(e => e.classList.remove("invalid"));
}
export function showAlert(id, msg, type = "error") {
    const el = document.getElementById(id);
    if (!el)
        return;
    el.textContent = msg;
    el.className = `alert alert-${type} visible`;
}
export function hideAlert(id) {
    document.getElementById(id)?.classList.remove("visible");
}
// ─── MODAL ────────────────────────────────────────────────────────────────────
export const Modal = {
    show: (id) => document.getElementById(id)?.classList.add("active"),
    hide: (id) => document.getElementById(id)?.classList.remove("active"),
};
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        document.querySelectorAll(".modal-overlay.active").forEach(m => m.classList.remove("active"));
    }
});
// ─── UTILITIES ────────────────────────────────────────────────────────────────
export function escapeHtml(str) {
    if (!str)
        return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}
export function formatDate(dateStr) {
    if (!dateStr)
        return "—";
    const [y, m, d] = dateStr.split("-");
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}
export function formatDateRange(from, to) {
    if (!from && !to)
        return "—";
    if (from && to)
        return `${formatDate(from)} → ${formatDate(to)}`;
    if (from)
        return `From ${formatDate(from)}`;
    return `Until ${formatDate(to)}`;
}
export function truncate(str, n = 160) {
    if (!str)
        return "";
    return str.length > n ? str.slice(0, n) + "…" : str;
}
export function getParam(key) {
    return new URLSearchParams(window.location.search).get(key);
}
export function setButtonLoading(btn, loading, text = "") {
    if (loading) {
        btn.dataset["originalText"] = btn.innerHTML;
        btn.innerHTML = `<span class="spinner"></span> ${text || "Loading…"}`;
        btn.disabled = true;
    }
    else {
        btn.innerHTML = btn.dataset["originalText"] ?? "Submit";
        btn.disabled = false;
    }
}
export function inputVal(id) {
    return document.getElementById(id)?.value ?? "";
}
//# sourceMappingURL=app.js.map