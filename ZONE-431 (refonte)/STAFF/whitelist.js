
const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_KEY);

const READ_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER MOD",
    "MANAGER ANIM",
    "MODÉRATION",
    "ANIMATION"
];

const MANAGE_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER MOD",
    "MANAGER ANIM"
];

let currentRole = null;
let entries = [];
let editingId = null;

const elements = {
    role: document.getElementById("staffRole"),
    table: document.getElementById("whitelistTableBody"),
    total: document.getElementById("totalCount"),
    categories: document.getElementById("categoryCount"),
    latest: document.getElementById("latestEntry"),
    recordCount: document.getElementById("recordCount"),
    search: document.getElementById("searchInput"),
    filter: document.getElementById("categoryFilter"),
    message: document.getElementById("messageArea"),
    modal: document.getElementById("entryModal"),
    form: document.getElementById("entryForm"),
    modalTitle: document.getElementById("modalTitle"),
    entryId: document.getElementById("entryId"),
    discord: document.getElementById("discordInput"),
    roblox: document.getElementById("robloxInput"),
    category: document.getElementById("categoryInput"),
    staff: document.getElementById("staffInput"),
    save: document.getElementById("saveButton"),
    add: document.getElementById("addEntryButton")
};

function showMessage(message, type = "success") {
    elements.message.textContent = message;
    elements.message.className = `message-area ${type}`;
}

function clearMessage() {
    elements.message.textContent = "";
    elements.message.className = "message-area hidden";
}

function normalizeRole(value) {
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
}

async function verifyAccess() {
    const { data: sessionData, error: sessionError } = await db.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.href = "../accueil.html?reason=staff";
        return false;
    }

    const { data: roleData, error: roleError } = await db.rpc("current_staff_role");

    if (roleError) {
        showMessage("Impossible de vérifier les autorisations du compte.", "error");
        return false;
    }

    currentRole = normalizeRole(roleData);

    if (!READ_ROLES.includes(currentRole)) {
        document.body.innerHTML = `
            <main style="min-height:100vh;display:grid;place-items:center;background:#080e17;color:#e5ecf4;font-family:Arial,sans-serif;padding:24px;text-align:center">
                <div>
                    <h1>ACCÈS REFUSÉ</h1>
                    <p>Votre rôle actuel ne permet pas de consulter ce module.</p>
                    <a href="zone%20staff.html" style="color:#82a9d0">Retour au tableau de bord</a>
                </div>
            </main>
        `;
        return false;
    }

    elements.role.textContent = currentRole;

    if (MANAGE_ROLES.includes(currentRole)) {
        elements.add.classList.remove("hidden");
    }

    return true;
}

function canManage() {
    return MANAGE_ROLES.includes(currentRole);
}

function canDelete() {
    return currentRole === "ADMINISTRATEUR";
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }).format(date);
}

function getFilteredEntries() {
    const search = elements.search.value.trim().toLowerCase();
    const category = elements.filter.value;

    return entries.filter(entry => {
        const matchesCategory = !category || entry.categorie === category;

        const searchable = [
            entry.pseudo_discord,
            entry.pseudo_ig,
            entry.categorie,
            entry.staff
        ].join(" ").toLowerCase();

        return matchesCategory && searchable.includes(search);
    });
}

function createCell(text, className = "") {
    const cell = document.createElement("td");
    cell.textContent = text || "—";

    if (className) cell.className = className;

    return cell;
}

function createActionButton(icon, title, callback, extraClass = "") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `icon-button ${extraClass}`.trim();
    button.title = title;
    button.setAttribute("aria-label", title);

    const iconElement = document.createElement("i");
    iconElement.className = icon;
    button.appendChild(iconElement);

    button.addEventListener("click", callback);
    return button;
}

function renderTable() {
    const filtered = getFilteredEntries();

    elements.table.replaceChildren();
    elements.recordCount.textContent =
        `${filtered.length} ENTRÉE${filtered.length > 1 ? "S" : ""}`;

    if (filtered.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 6;
        cell.className = "empty-state";
        cell.textContent = "Aucune entrée ne correspond à cette recherche.";

        row.appendChild(cell);
        elements.table.appendChild(row);
        return;
    }

    filtered.forEach(entry => {
        const row = document.createElement("tr");

        row.appendChild(createCell(entry.pseudo_discord));
        row.appendChild(createCell(entry.pseudo_ig));

        const categoryCell = document.createElement("td");
        const tag = document.createElement("span");
        tag.className = "category-tag";
        tag.textContent = entry.categorie;
        categoryCell.appendChild(tag);
        row.appendChild(categoryCell);

        row.appendChild(createCell(entry.staff));
        row.appendChild(createCell(formatDate(entry.date_whitelist)));

        const actions = document.createElement("td");
        actions.className = "action-cell";

        if (canManage()) {
            actions.appendChild(
                createActionButton(
                    "fa-solid fa-pen",
                    "Modifier l'entrée",
                    () => openEditModal(entry)
                )
            );
        }

        if (canDelete()) {
            actions.appendChild(
                createActionButton(
                    "fa-solid fa-trash",
                    "Supprimer l'entrée",
                    () => deleteEntry(entry),
                    "delete"
                )
            );
        }

        if (!canManage()) {
            actions.textContent = "Consultation";
        }

        row.appendChild(actions);
        elements.table.appendChild(row);
    });
}

function renderStats() {
    elements.total.textContent = entries.length;

    const categories = new Set(
        entries.map(entry => entry.categorie).filter(Boolean)
    );

    elements.categories.textContent = categories.size;

    const latest = [...entries].sort(
        (a, b) => new Date(b.date_whitelist) - new Date(a.date_whitelist)
    )[0];

    elements.latest.textContent = latest
        ? formatDate(latest.date_whitelist)
        : "—";
}

function renderCategoryFilter() {
    const currentValue = elements.filter.value;
    const categories = [...new Set(
        entries.map(entry => entry.categorie).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "fr"));

    elements.filter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "Toutes les catégories";
    elements.filter.appendChild(allOption);

    categories.forEach(category => {
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        elements.filter.appendChild(option);
    });

    elements.filter.value = categories.includes(currentValue) ? currentValue : "";
}

async function loadEntries() {
    clearMessage();

    elements.table.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">Chargement du registre...</td>
        </tr>
    `;

    const { data, error } = await db
        .from("whitelists")
        .select("id,pseudo_discord,pseudo_ig,categorie,staff,date_whitelist,created_at")
        .order("date_whitelist", { ascending: false });

    if (error) {
        showMessage(`Erreur de chargement : ${error.message}`, "error");
        elements.table.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">Impossible de charger le registre.</td>
            </tr>
        `;
        return;
    }

    entries = data || [];

    renderCategoryFilter();
    renderStats();
    renderTable();
}

function openModal() {
    elements.modal.classList.remove("hidden");
    elements.modal.setAttribute("aria-hidden", "false");
    elements.discord.focus();
}

function closeModal() {
    elements.modal.classList.add("hidden");
    elements.modal.setAttribute("aria-hidden", "true");
    elements.form.reset();
    elements.entryId.value = "";
    editingId = null;
}

function openCreateModal() {
    if (!canManage()) return;

    editingId = null;
    elements.form.reset();
    elements.entryId.value = "";
    elements.modalTitle.textContent = "Nouvelle entrée";
    elements.save.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Enregistrer';
    openModal();
}

function openEditModal(entry) {
    if (!canManage()) return;

    editingId = entry.id;

    elements.entryId.value = entry.id;
    elements.discord.value = entry.pseudo_discord || "";
    elements.roblox.value = entry.pseudo_ig || "";
    elements.category.value = entry.categorie || "";
    elements.staff.value = entry.staff || "";

    elements.modalTitle.textContent = "Modifier une entrée";
    elements.save.innerHTML = '<i class="fa-solid fa-check"></i> Enregistrer les modifications';

    openModal();
}

async function saveEntry(event) {
    event.preventDefault();

    if (!canManage()) {
        showMessage("Votre rôle ne permet pas de modifier le registre.", "error");
        return;
    }

    const payload = {
        pseudo_discord: elements.discord.value.trim(),
        pseudo_ig: elements.roblox.value.trim(),
        categorie: elements.category.value.trim(),
        staff: elements.staff.value.trim()
    };

    if (Object.values(payload).some(value => !value)) {
        showMessage("Tous les champs sont obligatoires.", "error");
        return;
    }

    elements.save.disabled = true;
    elements.save.textContent = "Enregistrement...";

    let result;

    if (editingId) {
        result = await db
            .from("whitelists")
            .update(payload)
            .eq("id", editingId);
    } else {
        result = await db
            .from("whitelists")
            .insert(payload);
    }

    elements.save.disabled = false;
    elements.save.innerHTML = editingId
        ? '<i class="fa-solid fa-check"></i> Enregistrer les modifications'
        : '<i class="fa-solid fa-floppy-disk"></i> Enregistrer';

    if (result.error) {
        showMessage(`Enregistrement refusé : ${result.error.message}`, "error");
        return;
    }

    closeModal();
    showMessage(
        editingId
            ? "L'entrée a été mise à jour."
            : "La nouvelle entrée a été ajoutée."
    );

    await loadEntries();
}

async function deleteEntry(entry) {
    if (!canDelete()) {
        showMessage("La suppression est réservée aux administrateurs.", "error");
        return;
    }

    const confirmed = window.confirm(
        `Confirmer la suppression de l'entrée de ${entry.pseudo_ig} ?`
    );

    if (!confirmed) return;

    const { error } = await db
        .from("whitelists")
        .delete()
        .eq("id", entry.id);

    if (error) {
        showMessage(`Suppression refusée : ${error.message}`, "error");
        return;
    }

    showMessage("L'entrée a été supprimée.");
    await loadEntries();
}

async function logout() {
    const { error } = await db.auth.signOut();

    if (error) {
        showMessage("La déconnexion a échoué.", "error");
        return;
    }

    window.location.href = "../accueil.html";
}

function bindEvents() {
    elements.add.addEventListener("click", openCreateModal);
    elements.form.addEventListener("submit", saveEntry);

    document.getElementById("closeModalButton")
        .addEventListener("click", closeModal);

    document.getElementById("cancelButton")
        .addEventListener("click", closeModal);

    document.querySelector("[data-close-modal]")
        .addEventListener("click", closeModal);

    document.getElementById("refreshButton")
        .addEventListener("click", loadEntries);

    document.getElementById("logoutButton")
        .addEventListener("click", logout);

    elements.search.addEventListener("input", renderTable);
    elements.filter.addEventListener("change", renderTable);

    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && !elements.modal.classList.contains("hidden")) {
            closeModal();
        }
    });
}

async function initialize() {
    bindEvents();

    const allowed = await verifyAccess();
    if (!allowed) return;

    await loadEntries();
}

initialize();
