import {
  api, Auth,
  renderNav, showFieldError, clearFieldError, clearAllFieldErrors,
  showAlert, hideAlert, setButtonLoading, inputVal, getParam,
  type Destination, type ApiError,
} from "./app.js";

renderNav();

if (!Auth.isLoggedIn()) {
  window.location.href = "login.html";
}

const destId = getParam("id");
if (!destId) window.location.href = "index.html";

const backLink = document.getElementById("back-link") as HTMLAnchorElement;
if (backLink) backLink.href = `detail.html?id=${destId}`;

async function loadDestination(): Promise<void> {
  try {
    const d = await api.get<Destination>(`/destinations/${destId}`);
    const currentUser = Auth.getUser();

    if (!currentUser || currentUser.user_id !== d.user_id) {
      showError();
      return;
    }
    prefillForm(d);
  } catch {
    document.getElementById("loading-state")!.style.display = "none";
    document.getElementById("error-state")!.style.display  = "block";
  }
}

function prefillForm(d: Destination): void {
  (document.getElementById("title")       as HTMLInputElement).value = d.title        ?? "";
  (document.getElementById("location")    as HTMLInputElement).value = d.location     ?? "";
  (document.getElementById("country")     as HTMLInputElement).value = d.country      ?? "";
  (document.getElementById("date_from")   as HTMLInputElement).value = d.date_from    ?? "";
  (document.getElementById("date_to")     as HTMLInputElement).value = d.date_to      ?? "";
  (document.getElementById("description") as HTMLTextAreaElement).value = d.description ?? "";

  const subtitle = document.getElementById("edit-subtitle");
  if (subtitle) subtitle.textContent = `Editing: ${d.title}`;

  document.getElementById("loading-state")!.style.display  = "none";
  document.getElementById("edit-form-card")!.style.display = "block";
}

function showError(): void {
  document.getElementById("loading-state")!.style.display = "none";
  document.getElementById("error-state")!.style.display   = "block";
}

function validateDates(): boolean {
  const from = inputVal("date_from");
  const to   = inputVal("date_to");
  if (from && to && from > to) {
    showFieldError("date_to", "End date must be on or after start date");
    return false;
  }
  clearFieldError("date_to");
  return true;
}

function validateForm(): boolean {
  clearAllFieldErrors();
  hideAlert("form-alert");
  let valid = true;

  const title = inputVal("title").trim();
  if (!title) {
    showFieldError("title", "Title is required");
    valid = false;
  } else if (title.length > 200) {
    showFieldError("title", "Title must be at most 200 characters");
    valid = false;
  }

  if (!validateDates()) valid = false;
  return valid;
}

async function submitForm(): Promise<void> {
  if (!validateForm()) return;

  const btn = document.getElementById("submit-btn") as HTMLButtonElement;
  setButtonLoading(btn, true, "Saving…");
  hideAlert("form-alert");
  hideAlert("success-alert");

  const payload = {
    title:       inputVal("title").trim(),
    location:    inputVal("location").trim() || null,
    country:     inputVal("country").trim() || null,
    date_from:   inputVal("date_from") || null,
    date_to:     inputVal("date_to") || null,
    description: inputVal("description").trim() || null,
  };

  try {
    await api.put<Destination>(`/destinations/${destId}`, payload);
    showAlert("success-alert", "✓ Changes saved successfully!", "success");
    setTimeout(() => { window.location.href = `detail.html?id=${destId}`; }, 1200);
  } catch (err) {
    const apiErr = err as ApiError;
    if (apiErr.fields) Object.entries(apiErr.fields).forEach(([k, v]) => showFieldError(k, v));
    showAlert("form-alert", apiErr.message);
  } finally {
    setButtonLoading(btn, false);
  }
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

document.getElementById("submit-btn")?.addEventListener("click", submitForm);
document.getElementById("title")?.addEventListener("input",    () => clearFieldError("title"));
document.getElementById("date_from")?.addEventListener("change", validateDates);
document.getElementById("date_to")?.addEventListener("change",   validateDates);

loadDestination();
