import {
  api, Auth, Modal,
  renderNav, escapeHtml, truncate, formatDateRange,
  getParam, setButtonLoading,
  type Destination,
} from "./app.js";

let allDestinations: Destination[] = [];
let pendingDeleteId: number | null = null;

async function loadDestinations(): Promise<void> {
  try {
    allDestinations = await api.get<Destination[]>("/destinations");
    renderCards(allDestinations);
  } catch (err) {
    document.getElementById("cards-container")!.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Could not load destinations</h3>
        <p>${escapeHtml((err as Error).message)}</p>
      </div>`;
  }
}

function renderCards(destinations: Destination[]): void {
  const container = document.getElementById("cards-container")!;
  const badge     = document.getElementById("count-badge")!;
  const count     = destinations.length;
  badge.textContent = `${count} destination${count !== 1 ? "s" : ""}`;

  if (count === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>No destinations yet</h3>
        <p>Start documenting your travels by adding your first destination.</p>
        <a href="create.html" class="btn btn-primary">+ Add Destination</a>
      </div>`;
    return;
  }

  const isLoggedIn  = Auth.isLoggedIn();
  const currentUser = Auth.getUser();

  container.innerHTML = `<div class="card-grid">${
    destinations.map((d, i) => buildCard(d, i, isLoggedIn, currentUser?.user_id ?? null)).join("")
  }</div>`;

  // Attach delete listeners now that the DOM exists
  container.querySelectorAll<HTMLButtonElement>("[data-delete-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const id   = parseInt(btn.dataset["deleteId"]!, 10);
      const name = btn.dataset["deleteName"] ?? "";
      confirmDelete(id, name);
    });
  });
}

function buildCard(
  d: Destination,
  i: number,
  isLoggedIn: boolean,
  currentUserId: number | null
): string {
  const isOwner = isLoggedIn && currentUserId === d.user_id;
  const delay   = Math.min(i * 0.06, 0.4);
  return `
    <div class="dest-card" style="animation-delay:${delay}s">
      <div class="dest-card-header">
        ${d.country ? `<div class="dest-card-flag">${escapeHtml(d.country)}</div>` : ""}
        <h3>${escapeHtml(d.title)}</h3>
        <div class="dest-card-meta">
          ${d.location ? `<span>📍 ${escapeHtml(d.location)}</span>` : ""}
          ${(d.date_from || d.date_to) ? `<span>📅 ${formatDateRange(d.date_from, d.date_to)}</span>` : ""}
        </div>
      </div>
      <div class="dest-card-body">
        <p>${escapeHtml(truncate(d.description ?? "No description provided."))}</p>
      </div>
      <div class="dest-card-footer">
        <span class="dest-card-author">by ${escapeHtml(d.author)}</span>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <a href="detail.html?id=${d.id}" class="btn btn-navy btn-sm">View</a>
          ${isOwner ? `
            <a href="edit.html?id=${d.id}" class="btn btn-ghost btn-sm">Edit</a>
            <button class="btn btn-danger btn-sm"
              data-delete-id="${d.id}"
              data-delete-name="${escapeHtml(d.title)}">Delete</button>
          ` : ""}
        </div>
      </div>
    </div>`;
}

function filterCards(): void {
  const q = (document.getElementById("search-input") as HTMLInputElement).value.toLowerCase();
  if (!q) { renderCards(allDestinations); return; }
  const filtered = allDestinations.filter(d =>
    [d.title, d.country, d.location, d.description]
      .some(f => f?.toLowerCase().includes(q))
  );
  renderCards(filtered);
}

function confirmDelete(id: number, name: string): void {
  pendingDeleteId = id;
  document.getElementById("delete-name")!.textContent = name;
  Modal.show("delete-modal");
}

// ─── INIT ─────────────────────────────────────────────────────────────────────

renderNav();
loadDestinations();

document.getElementById("search-input")
  ?.addEventListener("input", filterCards);

document.getElementById("confirm-delete-btn")
  ?.addEventListener("click", async () => {
    if (pendingDeleteId === null) return;
    const btn = document.getElementById("confirm-delete-btn") as HTMLButtonElement;
    setButtonLoading(btn, true, "Deleting…");
    try {
      await api.delete(`/destinations/${pendingDeleteId}`);
      Modal.hide("delete-modal");
      allDestinations = allDestinations.filter(d => d.id !== pendingDeleteId);
      pendingDeleteId = null;
      filterCards();
    } catch (err) {
      alert("Delete failed: " + (err as Error).message);
    } finally {
      setButtonLoading(btn, false);
    }
  });

document.getElementById("cancel-delete-btn")
  ?.addEventListener("click", () => Modal.hide("delete-modal"));
