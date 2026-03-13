import {
  api, Auth,
  showFieldError, clearAllFieldErrors,
  showAlert, hideAlert, setButtonLoading, inputVal,
  type AuthResponse, type ApiError,
} from "./app.js";

if (Auth.isLoggedIn()) {
  window.location.href = "index.html";
}

function validatePasswordStrength(): void {
  const pw = inputVal("password");
  const el = document.getElementById("password-strength");
  if (!el) return;

  if (!pw) { el.style.display = "none"; return; }
  el.style.display = "block";

  if (pw.length < 6) {
    el.textContent = "⚠ Too short";
    el.style.color = "var(--error)";
  } else if (pw.length < 10) {
    el.textContent = "○ Moderate strength";
    el.style.color = "orange";
  } else {
    el.textContent = "● Strong password";
    el.style.color = "var(--success)";
  }
}

async function signup(): Promise<void> {
  clearAllFieldErrors();
  hideAlert("form-alert");

  const username = inputVal("username").trim();
  const email    = inputVal("email").trim();
  const password = inputVal("password");
  const confirm  = inputVal("confirm_password");

  let valid = true;

  if (!username) {
    showFieldError("username", "Username is required"); valid = false;
  } else if (username.length < 3) {
    showFieldError("username", "At least 3 characters"); valid = false;
  }

  if (!email) {
    showFieldError("email", "Email is required"); valid = false;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError("email", "Invalid email address"); valid = false;
  }

  if (!password) {
    showFieldError("password", "Password is required"); valid = false;
  } else if (password.length < 6) {
    showFieldError("password", "At least 6 characters"); valid = false;
  }

  if (!confirm) {
    showFieldError("confirm_password", "Please confirm your password"); valid = false;
  } else if (password !== confirm) {
    showFieldError("confirm_password", "Passwords do not match"); valid = false;
  }

  if (!valid) return;

  const btn = document.getElementById("signup-btn") as HTMLButtonElement;
  setButtonLoading(btn, true, "Creating account…");

  try {
    const data = await api.post<AuthResponse>("/auth/signup", { username, email, password });
    Auth.setSession(data.token, { username: data.username, user_id: data.user_id });
    window.location.href = "index.html";
  } catch (err) {
    const apiErr = err as ApiError;
    if (apiErr.fields) Object.entries(apiErr.fields).forEach(([k, v]) => showFieldError(k, v));
    showAlert("form-alert", apiErr.message || "Sign up failed");
    setButtonLoading(btn, false);
  }
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

document.getElementById("signup-btn")?.addEventListener("click", signup);
document.getElementById("password")?.addEventListener("input", validatePasswordStrength);

document.getElementById("confirm_password")?.addEventListener("keydown", (e: Event) => {
  if ((e as KeyboardEvent).key === "Enter") signup();
});
