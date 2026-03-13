import { api, Auth, renderNav, showFieldError, clearFieldError, clearAllFieldErrors, showAlert, hideAlert, setButtonLoading, inputVal, } from "./app.js";
renderNav();
if (!Auth.isLoggedIn()) {
    window.location.href = `login.html?next=create.html`;
}
function validateDates() {
    const from = inputVal("date_from");
    const to = inputVal("date_to");
    if (from && to && from > to) {
        showFieldError("date_to", "End date must be on or after start date");
        return false;
    }
    clearFieldError("date_to");
    return true;
}
function validateForm() {
    clearAllFieldErrors();
    hideAlert("form-alert");
    let valid = true;
    const title = inputVal("title").trim();
    if (!title) {
        showFieldError("title", "Title is required");
        valid = false;
    }
    else if (title.length > 200) {
        showFieldError("title", "Title must be at most 200 characters");
        valid = false;
    }
    if (!validateDates())
        valid = false;
    return valid;
}
async function submitForm() {
    if (!validateForm())
        return;
    const btn = document.getElementById("submit-btn");
    setButtonLoading(btn, true, "Saving…");
    const payload = {
        title: inputVal("title").trim(),
        location: inputVal("location").trim() || null,
        country: inputVal("country").trim() || null,
        date_from: inputVal("date_from") || null,
        date_to: inputVal("date_to") || null,
        description: inputVal("description").trim() || null,
    };
    try {
        const dest = await api.post("/destinations", payload);
        window.location.href = `detail.html?id=${dest.id}&created=1`;
    }
    catch (err) {
        const apiErr = err;
        if (apiErr.fields) {
            Object.entries(apiErr.fields).forEach(([k, v]) => showFieldError(k, v));
        }
        showAlert("form-alert", apiErr.message);
        setButtonLoading(btn, false);
    }
}
// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────
document.getElementById("submit-btn")?.addEventListener("click", submitForm);
document.getElementById("title")?.addEventListener("input", () => clearFieldError("title"));
document.getElementById("date_from")?.addEventListener("change", validateDates);
document.getElementById("date_to")?.addEventListener("change", validateDates);
//# sourceMappingURL=create.js.map