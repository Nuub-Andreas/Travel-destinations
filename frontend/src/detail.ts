import {
  api, Auth, Modal,
  renderNav, escapeHtml, formatDate, formatDateRange,
  getParam, setButtonLoading,
  type Destination,
} from "./app.js";

renderNav();

const destId = getParam("id");
if (!destId) window.location.href = "index.html";

async function loadDestination(): Promise<void> {
  try {
    const d = await api.get<Destination>(`/destinations/${destId}`);
    renderDetail(d);
  } catch {
    document.getElementById("loading-state")!.style.display = "none";
    document.getElementById("error-state")!.style.display   = "block";
  }
}

function renderDetail(d: Destination): void {
  document.title = `Wanderlog — ${d.title}`;

  const breadcrumb = document.getElementById("breadcrumb-title");
  if (breadcrumb) breadcrumb.textContent = d.title;

  const eyebrow = document.getElementById("detail-eyebrow");
  if (eyebrow) eyebrow.textContent =
    [d.location, d.country].filter(Boolean).join(", ") || "Destination";

  const titleEl = document.getElementById("detail-title");
  if (titleEl) titleEl.textContent = d.title;

  const descEl = document.getElementById("detail-description");
  if (descEl) descEl.textContent = d.description ?? "No description provided.";

  // Meta row
  const metaItems: string[] = [];
  if (d.date_from || d.date_to)
    metaItems.push(`<div class="detail-meta-item">📅 ${formatDateRange(d.date_from, d.date_to)}</div>`);
  if (d.location)
    metaItems.push(`<div class="detail-meta-item">📍 ${escapeHtml(d.location)}</div>`);
  if (d.country)
    metaItems.push(`<div class="detail-meta-item">🌍 ${escapeHtml(d.country)}</div>`);
  const metaEl = document.getElementById("detail-meta");
  if (metaEl) metaEl.innerHTML = metaItems.join("");

  // Sidebar info
  const set = (id: string, val: string) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  set("info-location",  d.location   ?? "—");
  set("info-country",   d.country    ?? "—");
  set("info-date-from", d.date_from  ? formatDate(d.date_from) : "—");
  set("info-date-to",   d.date_to    ? formatDate(d.date_to)   : "—");
  set("info-author",    d.author     ?? "—");
  set("info-created",   formatDate(d.created_at.slice(0, 10)));

  // Owner actions
  const user = Auth.getUser();
  if (user && user.user_id === d.user_id) {
    const editBtn = document.getElementById("edit-btn") as HTMLAnchorElement | null;
    if (editBtn) editBtn.href = `edit.html?id=${d.id}`;

    document.getElementById("delete-btn")?.addEventListener("click", () => {
      const nameEl = document.getElementById("delete-title-text");
      if (nameEl) nameEl.textContent = d.title;
      Modal.show("delete-modal");
    });

    const actionsEl = document.getElementById("owner-actions");
    if (actionsEl) actionsEl.style.display = "flex";
  }

  document.getElementById("loading-state")!.style.display  = "none";
  document.getElementById("page-content")!.style.display   = "block";

  if (getParam("created") === "1") {
    const banner = document.getElementById("created-banner");
    if (banner) {
      banner.style.display = "flex";
      setTimeout(() => { banner.style.display = "none"; }, 4000);
    }
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

document.getElementById("confirm-delete-btn")
  ?.addEventListener("click", async () => {
    const btn = document.getElementById("confirm-delete-btn") as HTMLButtonElement;
    setButtonLoading(btn, true, "Deleting…");
    try {
      await api.delete(`/destinations/${destId}`);
      window.location.href = "index.html";
    } catch (err) {
      alert("Delete failed: " + (err as Error).message);
      setButtonLoading(btn, false);
    }
  });

document.getElementById("cancel-delete-btn")
  ?.addEventListener("click", () => Modal.hide("delete-modal"));

loadDestination();
