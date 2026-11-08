
"use strict";

/* =========================================================
   CONFIGURATION SUPABASE
========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

const TABLE_NAME = "rp_blacklist_entries";
const MANAGE_PERMISSION = "blacklist.manage";

/* =========================================================
   ÉTAT DU MODULE
========================================================= */

const state = {
    user: null,
    profile: null,
    roles: [],
    entries: [],
    canManage: false,
    isGlobalAdmin: false
};

/* =========================================================
   ÉLÉMENTS HTML
========================================================= */

const elements = {
    staffName: document.getElementById("staff-name"),
    staffRole: document.getElementById("staff-role"),
    permissionStatus: document.getElementById("permission-status"),

    accessError: document.getElementById("access-error"),
    accessErrorMessage: document.getElementById("access-error-message"),
    moduleContent: document.getElementById("module-content"),

    totalCount: document.getElementById("total-count"),
    activeCount: document.getElementById("active-count"),
    liftedCount: document.getElementById("lifted-count"),

    searchInput: document.getElementById("search-input"),
    statusFilter: document.getElementById("status-filter"),
    resultCount: document.getElementById("result-count"),

    table: document.getElementById("blacklist-table"),
    tableBody: document.getElementById("blacklist-body"),
    loadingState: document.getElementById("loading-state"),
    emptyState: document.getElementById("empty-state"),

    addButton: document.getElementById("add-button"),
    refreshButton: document.getElementById("refresh-button"),

    modal: document.getElementById("entry-modal"),
    modalTitle: document.getElementById("modal-title"),
    closeModal: document.getElementById("close-modal"),
    cancelModal: document.getElementById("cancel-modal"),
    entryForm: document.getElementById("entry-form"),

    entryId: document.getElementById("entry-id"),
    pseudoIg: document.getElementById("pseudo-ig"),
    pseudoDiscord: document.getElementById("pseudo-discord"),
    entryReason: document.getElementById("entry-reason"),
    entryManager: document.getElementById("entry-manager"),
    entryStatus: document.getElementById("entry-status"),

    formError: document.getElementById("form-error"),
    saveButton: document.getElementById("save-entry"),
    toast: document.getElementById("toast")
};

/* =========================================================
   OUTILS
========================================================= */

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");

    window.clearTimeout(showToast.timeout);

    showToast.timeout = window.setTimeout(() => {
        elements.toast.classList.add("hidden");
    }, 3500);
}

function showAccessError(message) {
    elements.moduleContent.classList.add("hidden");
    elements.accessError.classList.remove("hidden");
    elements.accessErrorMessage.textContent = message;
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
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

function getRoleLabel() {
    if (state.isGlobalAdmin) return "ADMINISTRATEUR";

    if (!state.roles.length) return "MEMBRE AUTORISÉ";

    return state.roles
        .map(role => role.role_code)
        .filter(Boolean)
        .join(" / ");
}

/* =========================================================
   AUTHENTIFICATION ET AUTORISATIONS
========================================================= */

async function checkAuthentication() {
    const { data: { user }, error } = await supabaseClient.auth.getUser();

    if (error || !user) {
        showAccessError("Vous devez être connecté pour accéder à ce module.");
        return false;
    }

    state.user = user;

    const { data: profile, error: profileError } = await supabaseClient
        .from("rp_member_profiles")
        .select("user_id, display_name, department, status")
        .eq("user_id", user.id)
        .maybeSingle();

    if (profileError) {
        console.error("Erreur profil :", profileError);
        showAccessError("Impossible de vérifier votre profil auprès de Supabase.");
        return false;
    }

    if (!profile) {
        showAccessError("Votre compte ne possède pas de profil RP autorisé.");
        return false;
    }

    state.profile = profile;

    const { data: roles, error: rolesError } = await supabaseClient
        .from("rp_member_role_assignments")
        .select("role_code, department_code")
        .eq("user_id", user.id);

    if (rolesError) {
        console.error("Erreur rôles :", rolesError);
        showAccessError("Impossible de récupérer vos autorisations.");
        return false;
    }

    state.roles = roles || [];

    await resolvePermissions();

    elements.staffName.textContent =
        profile.display_name || user.email || "Membre du personnel";

    elements.staffRole.textContent = getRoleLabel();

    elements.permissionStatus.textContent = state.canManage
        ? "GESTION AUTORISÉE"
        : "CONSULTATION UNIQUEMENT";

    elements.permissionStatus.classList.toggle("manage", state.canManage);
    elements.permissionStatus.classList.toggle("read", !state.canManage);

    elements.addButton.classList.toggle("hidden", !state.canManage);

    elements.moduleContent.classList.remove("hidden");
    elements.accessError.classList.add("hidden");

    return true;
}

async function resolvePermissions() {
    state.isGlobalAdmin = state.roles.some(role =>
        role.role_code === "ADMIN" &&
        role.department_code === null
    );

    if (!state.isGlobalAdmin) {
        const { data, error } = await supabaseClient.rpc("current_staff_role");

        if (!error && data === "ADMINISTRATEUR") {
            state.isGlobalAdmin = true;
        }
    }

    if (state.isGlobalAdmin) {
        state.canManage = true;
        return;
    }

    const { data: overrides, error: overrideError } = await supabaseClient
        .from("rp_member_permission_overrides")
        .select("is_allowed")
        .eq("user_id", state.user.id)
        .eq("permission_code", MANAGE_PERMISSION)
        .is("department_code", null)
        .limit(1);

    if (overrideError) {
        console.error("Erreur dérogation :", overrideError);
        throw new Error("Impossible de vérifier votre dérogation de permission.");
    }

    if (overrides && overrides.length > 0) {
        state.canManage = overrides[0].is_allowed === true;
        return;
    }

    const assignedRoles = state.roles
        .map(role => role.role_code)
        .filter(Boolean);

    if (!assignedRoles.length) {
        state.canManage = false;
        return;
    }

    const { data: defaults, error: defaultsError } = await supabaseClient
        .from("rp_role_permission_defaults")
        .select("role_code, permission_code, is_allowed")
        .in("role_code", assignedRoles)
        .eq("permission_code", MANAGE_PERMISSION);

    if (defaultsError) {
        console.error("Erreur permissions par rôle :", defaultsError);
        throw new Error("Impossible de vérifier les permissions de votre rôle.");
    }

    state.canManage = (defaults || []).some(permission =>
        permission.is_allowed === true
    );
}

/* =========================================================
   CHARGEMENT DU REGISTRE
========================================================= */

async function loadEntries() {
    elements.loadingState.classList.remove("hidden");
    elements.emptyState.classList.add("hidden");
    elements.table.classList.add("hidden");

    const { data, error } = await supabaseClient
        .from(TABLE_NAME)
        .select("*")
        .order("created_at", { ascending: false });

    elements.loadingState.classList.add("hidden");

    if (error) {
        console.error("Erreur de chargement :", error);
        showToast("Impossible de charger le registre.");
        return;
    }

    state.entries = data || [];

    updateStatistics();
    renderEntries();
}

function updateStatistics() {
    const total = state.entries.length;
    const active = state.entries.filter(entry => entry.statut === "active").length;
    const lifted = state.entries.filter(entry => entry.statut === "levee").length;

    elements.totalCount.textContent = total;
    elements.activeCount.textContent = active;
    elements.liftedCount.textContent = lifted;
}

function renderEntries() {
    const search = elements.searchInput.value.trim().toLowerCase();
    const status = elements.statusFilter.value;

    const filtered = state.entries.filter(entry => {
        const matchesSearch = [
            entry.pseudo_ig,
            entry.pseudo_discord,
            entry.motif,
            entry.responsable
        ].some(value => String(value || "").toLowerCase().includes(search));

        const matchesStatus = status === "all" || entry.statut === status;

        return matchesSearch && matchesStatus;
    });

    elements.tableBody.innerHTML = "";

    elements.resultCount.textContent =
        `${filtered.length} RÉSULTAT${filtered.length > 1 ? "S" : ""}`;

    if (!filtered.length) {
        elements.table.classList.add("hidden");
        elements.emptyState.classList.remove("hidden");
        return;
    }

    elements.emptyState.classList.add("hidden");
    elements.table.classList.remove("hidden");

    filtered.forEach(entry => {
        const row = document.createElement("tr");

        const statusLabel = entry.statut === "active"
            ? "ACTIVE"
            : "LEVÉE";

        const statusClass = entry.statut === "active"
            ? "active"
            : "levee";

        const actions = state.canManage
            ? `
                <div class="row-actions">
                    <button type="button" data-edit="${escapeHTML(entry.id)}">
                        MODIFIER
                    </button>
                    <button type="button" class="delete-button"
                        data-delete="${escapeHTML(entry.id)}">
                        SUPPRIMER
                    </button>
                </div>
            `
            : `<span class="muted">LECTURE</span>`;

        row.innerHTML = `
            <td class="entry-id">BL-${escapeHTML(String(entry.id).slice(0, 8))}</td>
            <td>${escapeHTML(entry.pseudo_ig)}</td>
            <td>${escapeHTML(entry.pseudo_discord || "—")}</td>
            <td class="entry-reason">${escapeHTML(entry.motif)}</td>
            <td>${escapeHTML(entry.responsable)}</td>
            <td>
                <span class="status-pill ${statusClass}">
                    ${statusLabel}
                </span>
            </td>
            <td>${formatDate(entry.created_at)}</td>
            <td>${actions}</td>
        `;

        elements.tableBody.appendChild(row);
    });
}

/* =========================================================
   FORMULAIRE : AJOUT ET MODIFICATION
========================================================= */

function openModal(entry = null) {
    if (!state.canManage) {
        showToast("Vous ne disposez pas de la permission nécessaire.");
        return;
    }

    elements.entryForm.reset();
    elements.formError.classList.add("hidden");
    elements.entryId.value = "";

    if (entry) {
        elements.modalTitle.textContent = "MODIFIER UNE ENTRÉE";
        elements.entryId.value = entry.id;
        elements.pseudoIg.value = entry.pseudo_ig || "";
        elements.pseudoDiscord.value = entry.pseudo_discord || "";
        elements.entryReason.value = entry.motif || "";
        elements.entryManager.value = entry.responsable || "";
        elements.entryStatus.value = entry.statut || "active";
    } else {
        elements.modalTitle.textContent = "NOUVELLE ENTRÉE";
        elements.entryManager.value =
            state.profile.display_name || "";
        elements.entryStatus.value = "active";
    }

    elements.modal.classList.remove("hidden");
    elements.modal.setAttribute("aria-hidden", "false");
}

function closeModal() {
    elements.modal.classList.add("hidden");
    elements.modal.setAttribute("aria-hidden", "true");
}

function showFormError(message) {
    elements.formError.textContent = message;
    elements.formError.classList.remove("hidden");
}

async function saveEntry(event) {
    event.preventDefault();

    if (!state.canManage) {
        showFormError("Permission insuffisante.");
        return;
    }

    const id = elements.entryId.value;

    const payload = {
        pseudo_ig: elements.pseudoIg.value.trim(),
        pseudo_discord: elements.pseudoDiscord.value.trim() || null,
        motif: elements.entryReason.value.trim(),
        responsable: elements.entryManager.value.trim(),
        statut: elements.entryStatus.value,
        updated_at: new Date().toISOString()
    };

    if (!payload.pseudo_ig || !payload.motif || !payload.responsable) {
        showFormError("Veuillez remplir tous les champs obligatoires.");
        return;
    }

    elements.saveButton.disabled = true;
    elements.saveButton.textContent = "ENREGISTREMENT...";

    let result;

    if (id) {
        result = await supabaseClient
            .from(TABLE_NAME)
            .update(payload)
            .eq("id", id);
    } else {
        result = await supabaseClient
            .from(TABLE_NAME)
            .insert({
                ...payload,
                created_by: state.user.id
            });
    }

    elements.saveButton.disabled = false;
    elements.saveButton.textContent = "ENREGISTRER";

    if (result.error) {
        console.error("Erreur enregistrement :", result.error);
        showFormError("Échec de l'enregistrement. Vérifiez les autorisations Supabase.");
        return;
    }

    closeModal();
    showToast(id ? "Entrée modifiée." : "Nouvelle entrée enregistrée.");

    await loadEntries();
}

/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteEntry(id) {
    if (!state.canManage) {
        showToast("Permission insuffisante.");
        return;
    }

    const confirmed = window.confirm(
        "Confirmer la suppression définitive de cette entrée ?"
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from(TABLE_NAME)
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Erreur suppression :", error);
        showToast("La suppression a échoué.");
        return;
    }

    showToast("Entrée supprimée.");
    await loadEntries();
}

/* =========================================================
   ÉVÉNEMENTS
========================================================= */

elements.addButton.addEventListener("click", () => openModal());

elements.refreshButton.addEventListener("click", async () => {
    await loadEntries();
    showToast("Registre actualisé.");
});

elements.searchInput.addEventListener("input", renderEntries);
elements.statusFilter.addEventListener("change", renderEntries);

elements.closeModal.addEventListener("click", closeModal);
elements.cancelModal.addEventListener("click", closeModal);

elements.modal.addEventListener("click", event => {
    if (event.target.hasAttribute("data-close-modal")) {
        closeModal();
    }
});

elements.entryForm.addEventListener("submit", saveEntry);

elements.tableBody.addEventListener("click", event => {
    const editButton = event.target.closest("[data-edit]");
    const deleteButton = event.target.closest("[data-delete]");

    if (editButton) {
        const entry = state.entries.find(item =>
            String(item.id) === editButton.dataset.edit
        );

        if (entry) openModal(entry);
    }

    if (deleteButton) {
        deleteEntry(deleteButton.dataset.delete);
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeModal();
});

/* =========================================================
   DÉMARRAGE
========================================================= */

async function initializeBlacklist() {
    try {
        const authenticated = await checkAuthentication();

        if (!authenticated) return;

        await loadEntries();
    } catch (error) {
        console.error("Initialisation Blacklist :", error);
        showAccessError(
            error.message || "Une erreur est survenue lors de l'initialisation."
        );
    }
}

initializeBlacklist();
