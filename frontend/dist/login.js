import { api, Auth, showFieldError, clearAllFieldErrors, showAlert, hideAlert, setButtonLoading, inputVal, getParam, } from "./app.js";
if (Auth.isLoggedIn()) {
    window.location.href = getParam("next") ?? "index.html";
}
async function login() {
    clearAllFieldErrors();
    hideAlert("form-alert");
    const username = inputVal("username").trim();
    const password = inputVal("password");
    let valid = true;
    if (!username) {
        showFieldError("username", "Username is required");
        valid = false;
    }
    if (!password) {
        showFieldError("password", "Password is required");
        valid = false;
    }
    if (!valid)
        return;
    const btn = document.getElementById("login-btn");
    setButtonLoading(btn, true, "Logging in…");
    try {
        const data = await api.post("/auth/login", { username, password });
        Auth.setSession(data.token, { username: data.username, user_id: data.user_id });
        window.location.href = getParam("next") ?? "index.html";
    }
    catch (err) {
        showAlert("form-alert", err.message || "Login failed");
        setButtonLoading(btn, false);
    }
}
// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
document.getElementById("login-btn")?.addEventListener("click", login);
document.getElementById("password")?.addEventListener("keydown", (e) => {
    if (e.key === "Enter")
        login();
});
//# sourceMappingURL=login.js.map