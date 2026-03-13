// ─── TYPES ────────────────────────────────────────────────────────────────────

export interface Destination {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  location: string | null;
  country: string | null;
  date_from: string | null;
  date_to: string | null;
  created_at: string;
  updated_at: string;
  author: string;
}

export interface AuthUser {
  user_id: number;
  username: string;
}

export interface AuthResponse {
  token: string;
  username: string;
  user_id: number;
}

export interface ApiError extends Error {
  status: number;
  fields?: Record<string, string>;
}

export interface DestinationFormData {
  title: string;
  description: string | null;
  location: string | null;
  country: string | null;
  date_from: string | null;
  date_to: string | null;
}
// ─── CONFIG ───────────────────────────────────────────────────────────────────

const API_BASE = "http://localhost:5001/api";

// ─── AUTH ─────────────────────────────────────────────────────────────────────

export const Auth = {
  getToken: (): string | null => localStorage.getItem("travel_token"),

  getUser: (): AuthUser | null => {
    try {
      return JSON.parse(localStorage.getItem("travel_user") ?? "null");
    } catch {
      return null;
    }
  },

  setSession: (token: string, user: AuthUser): void => {
    localStorage.setItem("travel_token", token);
    localStorage.setItem("travel_user", JSON.stringify(user));
  },

  clearSession: (): void => {
    localStorage.removeItem("travel_token");
    localStorage.removeItem("travel_user");
  },

  isLoggedIn: (): boolean => !!localStorage.getItem("travel_token"),
};

// ─── API CLIENT ───────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body: unknown = null
): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = Auth.getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const opts: RequestInit = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${API_BASE}${path}`, opts);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.error ?? "Request failed") as ApiError;
    err.status = res.status;
    err.fields = data.fields;
    throw err;
  }
  return data as T;
}

export const api = {
  get:    <T>(path: string)                   => request<T>("GET",    path),
  post:   <T>(path: string, body: unknown)    => request<T>("POST",   path, body),
  put:    <T>(path: string, body: unknown)    => request<T>("PUT",    path, body),
  delete: <T>(path: string)                   => request<T>("DELETE", path),
};

// ─── NAVBAR ───────────────────────────────────────────────────────────────────

export function renderNav(): void {
  const userInfo = document.getElementById("nav-user-info");
  const navLinks = document.getElementById("nav-auth-links");
  if (!userInfo || !navLinks) return;

  const user = Auth.getUser();
  if (user) {
    userInfo.innerHTML = `Logged in as <strong>${escapeHtml(user.username)}</strong>`;
    navLinks.innerHTML = `
      <li><a href="create.html" class="nav-link">+ New Destination</a></li>
      <li><button class="nav-btn outline" id="logout-btn">Log out</button></li>
    `;
    document.getElementById("logout-btn")?.addEventListener("click", logout);
  } else {
    userInfo.innerHTML = "";
    navLinks.innerHTML = `
      <li><a href="login.html" class="nav-btn outline">Log in</a></li>
      <li><a href="signup.html" class="nav-btn">Sign up</a></li>
    `;
  }
}

export function logout(): void {
  Auth.clearSession();
  window.location.href = "index.html";
}

// ─── FORM HELPERS ─────────────────────────────────────────────────────────────

export function showFieldError(id: string, msg: string): void {
  const el = document.getElementById(`${id}-error`);
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (el) { el.textContent = msg; el.classList.add("visible"); }
  if (input) input.classList.add("invalid");
}

export function clearFieldError(id: string): void {
  const el = document.getElementById(`${id}-error`);
  const input = document.getElementById(id) as HTMLInputElement | null;
  if (el) { el.textContent = ""; el.classList.remove("visible"); }
  if (input) input.classList.remove("invalid");
}

export function clearAllFieldErrors(): void {
  document.querySelectorAll(".field-error").forEach(e => {
    e.textContent = "";
    e.classList.remove("visible");
  });
  document.querySelectorAll(".form-control").forEach(e =>
    e.classList.remove("invalid")
  );
}

export function showAlert(id: string, msg: string, type: "error" | "success" = "error"): void {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `alert alert-${type} visible`;
}

export function hideAlert(id: string): void {
  document.getElementById(id)?.classList.remove("visible");
}

// ─── MODAL ────────────────────────────────────────────────────────────────────

export const Modal = {
  show: (id: string): void => document.getElementById(id)?.classList.add("active"),
  hide: (id: string): void => document.getElementById(id)?.classList.remove("active"),
};

document.addEventListener("keydown", (e: KeyboardEvent) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal-overlay.active").forEach(m =>
      m.classList.remove("active")
    );
  }
});

// ─── UTILITIES ────────────────────────────────────────────────────────────────

export function escapeHtml(str: string | null | undefined): string {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

export function formatDateRange(from: string | null, to: string | null): string {
  if (!from && !to) return "—";
  if (from && to)   return `${formatDate(from)} → ${formatDate(to)}`;
  if (from)         return `From ${formatDate(from)}`;
  return `Until ${formatDate(to)}`;
}

export function truncate(str: string | null | undefined, n = 160): string {
  if (!str) return "";
  return str.length > n ? str.slice(0, n) + "…" : str;
}

export function getParam(key: string): string | null {
  return new URLSearchParams(window.location.search).get(key);
}

export function setButtonLoading(btn: HTMLButtonElement, loading: boolean, text = ""): void {
  if (loading) {
    btn.dataset["originalText"] = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${text || "Loading…"}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset["originalText"] ?? "Submit";
    btn.disabled = false;
  }
}

export function inputVal(id: string): string {
  return (document.getElementById(id) as HTMLInputElement | null)?.value ?? "";
}
