
/* =========================================================
   ZONE-431 — SANCTIONS
   Supabase / Auth / RLS / Administration
========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let currentUser = null;
let currentRole = null;
let currentStaff = null;
let canManage = false;
let canAccess = false;
let sanctions = [];
let editingSanction = false;

/* =========================================================
   DOM
========================================================= */

const elements = {
    loading: document.getElementById("loading-state"),
    accessError: document.getElementById("access-error"),
    accessErrorMessage: document.getElementById("access-error-message"),
    interface: document.getElementById("sanctions-interface"),

    staffName: document.getElementById("staff-name"),
    staffRole: document.getElementById("staff-role"),
    permissionBadge: document.getElementById("permission-badge"),

    statTotal: document.getElementById("stat-total"),
    statDefinitive: document.getElementById("stat-definitive"),
    statWarnings: document.getElementById("stat-warnings"),

    search: document.getElementById("search-input"),
    typeFilter: document.getElementById("type-filter"),
    refresh: document.getElementById("refresh-button"),
    add: document.getElementById("add-button"),

    tableBody: document.getElementById("sanctions-table-body"),
    resultCount: document.getElementById("result-count"),

    modal: document.getElementById("sanction-modal"),
    modalTitle: document.getElementById("modal-title"),
    modalBackdrop: document.getElementById("modal-backdrop"),
    closeModal: document.getElementById("close-modal"),
    cancelModal: document.getElementById("cancel-modal"),

    form: document.getElementById("sanction-form"),
    formError: document.getElementById("form-error"),
    saveButton: document.getElementById("save-sanction"),

    id: document.getElementById("sanction-id"),
    pseudoIg: document.getElementById("pseudo-ig"),
    pseudoDiscord: document.getElementById("pseudo-discord"),
    type: document.getElementById("sanction-type"),
    reason: document.getElementById("sanction-reason"),
    duration: document.getElementById("sanction-duration"),
    date: document.getElementById("sanction-date"),
    notes: document.getElementById("sanction-notes"),

    toast: document.getElementById("toast")
};

/* =========================================================
   UTILITAIRES
========================================================= */

function normalize(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function formatDate(value) {
    if (!value) return "Non renseignée";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Date invalide";
    }

    return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function toLocalDateTime(value = new Date()) {
    const date = new Date(value);
    const offset = date.getTimezoneOffset() * 60000;

    return new Date(date.getTime() - offset)
        .toISOString()
        .slice(0, 16);
}

function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.remove("hidden");

    window.clearTimeout(showToast.timeout);

    showToast.timeout = window.setTimeout(() => {
        elements.toast.classList.add("hidden");
    }, 3500);
}

function showFormError(message) {
    elements.formError.textContent = message;
    elements.formError.classList.remove("hidden");
}

function hideFormError() {
    elements.formError.textContent = "";
    elements.formError.classList.add("hidden");
}

function showAccessError(message) {
    elements.loading.classList.add("hidden");
    elements.interface.classList.add("hidden");
    elements.accessError.classList.remove("hidden");
    elements.accessErrorMessage.textContent = message;
}

function setLoading(loading) {
    elements.saveButton.disabled = loading;
    elements.saveButton.textContent = loading
        ? "ENREGISTREMENT..."
        : "ENREGISTRER";
}

/* =========================================================
   AUTHENTIFICATION
========================================================= */

async function initializeSanctions() {
    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        if (!data.session) {
            showAccessError(
                "Vous devez être connecté à votre compte Zone-431 pour consulter ce registre."
            );
            return;
        }

        currentUser = data.session.user;

        await verifyStaffAccess();

    } catch (error) {
        console.error("Erreur d'initialisation :", error);

        showAccessError(
            "Impossible de vérifier votre session. Veuillez vous reconnecter."
        );
    }
}

async function verifyStaffAccess() {
    const { data: access, error: accessError } = await supabaseClient.rpc(
        "has_staff_module_permission",
        { p_module_code: "sanctions", p_action: "access" }
    );

    if (accessError) throw accessError;

    if (access !== true) {
        showAccessError(
            "Votre compte ne dispose pas de la permission d'accès au module Sanctions."
        );
        return;
    }

    const { data: write, error: writeError } = await supabaseClient.rpc(
        "has_staff_module_permission",
        { p_module_code: "sanctions", p_action: "write" }
    );

    if (writeError) throw writeError;

    canAccess = true;
    canManage = write === true;

    const { data: role } = await supabaseClient.rpc("current_staff_role");
    currentRole = String(role || "ACCÈS INDIVIDUEL").trim().toUpperCase();

    await loadStaffIdentity();
    displayInterface();
    await loadSanctions();
}

async function loadStaffIdentity() {
    const { data, error } = await supabaseClient
        .from("staff_members")
        .select("pseudo_discord, pseudo_ig, role")
        .eq("auth_user_id", currentUser.id)
        .eq("active", true)
        .maybeSingle();

    if (error) {
        console.warn("Identité du personnel indisponible :", error);
    }

    currentStaff = data || {};

    elements.staffName.textContent =
        currentStaff.pseudo_discord ||
        currentStaff.pseudo_ig ||
        currentUser.email ||
        "Personnel connecté";

    elements.staffRole.textContent = currentRole;

    elements.permissionBadge.textContent = canManage
        ? "GESTION COMPLÈTE"
        : "CONSULTATION UNIQUEMENT";

    elements.permissionBadge.classList.add(
        canManage ? "manage" : "read"
    );
}

function displayInterface() {
    elements.loading.classList.add("hidden");
    elements.accessError.classList.add("hidden");
    elements.interface.classList.remove("hidden");

    if (canManage) {
        elements.add.classList.remove("hidden");
    }
}

/* =========================================================
   CHARGEMENT DES SANCTIONS
========================================================= */

async function loadSanctions() {
    elements.refresh.disabled = true;
    elements.refresh.textContent = "CHARGEMENT...";

    try {
        const { data, error } = await supabaseClient
            .from("sanctions")
            .select("*")
            .order("date_sanction", { ascending: false });

        if (error) throw error;

        sanctions = data || [];

        updateStatistics();
        updateTypeFilter();
        renderSanctions();

    } catch (error) {
        console.error("Erreur de chargement :", error);

        elements.tableBody.replaceChildren();

        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.className = "empty-state";
        cell.textContent =
            "Impossible de charger le registre. Vérifiez les autorisations Supabase.";

        row.appendChild(cell);
        elements.tableBody.appendChild(row);

    } finally {
        elements.refresh.disabled = false;
        elements.refresh.textContent = "ACTUALISER";
    }
}

/* =========================================================
   STATISTIQUES
========================================================= */

function updateStatistics() {
    elements.statTotal.textContent = sanctions.length;

    const definitive = sanctions.filter(sanction =>
        normalize(sanction.type).includes("definitif") ||
        normalize(sanction.duree).includes("definitif")
    ).length;

    const warnings = sanctions.filter(sanction =>
        normalize(sanction.type).includes("avertissement")
    ).length;

    elements.statDefinitive.textContent = definitive;
    elements.statWarnings.textContent = warnings;
}

/* =========================================================
   FILTRE PAR TYPE
========================================================= */

function updateTypeFilter() {
    const selectedValue = elements.typeFilter.value;

    const types = [...new Set(
        sanctions
            .map(sanction => sanction.type)
            .filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "fr"));

    elements.typeFilter.replaceChildren();

    const allOption = document.createElement("option");
    allOption.value = "";
    allOption.textContent = "TOUS LES TYPES";
    elements.typeFilter.appendChild(allOption);

    types.forEach(type => {
        const option = document.createElement("option");
        option.value = type;
        option.textContent = type;
        elements.typeFilter.appendChild(option);
    });

    if (types.includes(selectedValue)) {
        elements.typeFilter.value = selectedValue;
    }
}

/* =========================================================
   AFFICHAGE DU REGISTRE
========================================================= */

function renderSanctions() {
    const searchTerm = normalize(elements.search.value);
    const selectedType = elements.typeFilter.value;

    const filtered = sanctions.filter(sanction => {
        const searchable = [
            sanction.pseudo_ig,
            sanction.pseudo_discord,
            sanction.type,
            sanction.motif,
            sanction.duree,
            sanction.staff,
            sanction.notes,
            sanction.id
        ].map(normalize).join(" ");

        const matchesSearch =
            !searchTerm || searchable.includes(searchTerm);

        const matchesType =
            !selectedType || sanction.type === selectedType;

        return matchesSearch && matchesType;
    });

    elements.tableBody.replaceChildren();

    elements.resultCount.textContent =
        `${filtered.length} DOSSIER${filtered.length > 1 ? "S" : ""}`;

    if (filtered.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.className = "empty-state";

        const title = document.createElement("strong");
        title.textContent = "AUCUN DOSSIER TROUVÉ";

        const description = document.createElement("p");
        description.textContent =
            "Aucune sanction ne correspond à votre recherche.";

        cell.append(title, description);
        row.appendChild(cell);
        elements.tableBody.appendChild(row);

        return;
    }

    filtered.forEach(sanction => {
        elements.tableBody.appendChild(createSanctionRow(sanction));
    });
}

function createCell(text, className = "") {
    const cell = document.createElement("td");

    if (className) {
        cell.className = className;
    }

    cell.textContent = text || "—";

    return cell;
}

function createSanctionRow(sanction) {
    const row = document.createElement("tr");

    row.appendChild(createCell(`#${sanction.id}`, "entry-id"));

    const playerCell = document.createElement("td");
    playerCell.className = "entry-player";

    const roblox = document.createElement("strong");
    roblox.textContent = sanction.pseudo_ig || "Inconnu";

    const discord = document.createElement("small");
    discord.textContent = sanction.pseudo_discord || "Discord non renseigné";

    playerCell.append(roblox, discord);
    row.appendChild(playerCell);

    const typeCell = document.createElement("td");
    const typeBadge = document.createElement("span");

    typeBadge.className = "entry-type";

    const normalizedType = normalize(sanction.type);

    if (
        normalizedType.includes("ban") ||
        normalizedType.includes("definitif")
    ) {
        typeBadge.classList.add("danger");
    }

    typeBadge.textContent = sanction.type || "Non renseigné";
    typeCell.appendChild(typeBadge);
    row.appendChild(typeCell);

    row.appendChild(
        createCell(sanction.motif || "Non renseigné", "entry-reason")
    );

    row.appendChild(
        createCell(sanction.duree || "Non renseignée")
    );

    row.appendChild(
        createCell(sanction.staff || "Non renseigné")
    );

    row.appendChild(
        createCell(formatDate(sanction.date_sanction))
    );

    const actionsCell = document.createElement("td");
    actionsCell.className = "row-actions";

    if (canManage) {
        const editButton = document.createElement("button");
        editButton.type = "button";
        editButton.textContent = "MODIFIER";
        editButton.addEventListener("click", () => {
            openEditModal(sanction);
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.textContent = "SUPPRIMER";
        deleteButton.className = "delete-button";
        deleteButton.addEventListener("click", () => {
            deleteSanction(sanction);
        });

        actionsCell.append(editButton, deleteButton);
    } else {
        actionsCell.textContent = "CONSULTATION";
        actionsCell.classList.add("muted");
    }

    row.appendChild(actionsCell);

    return row;
}

/* =========================================================
   MODALE
========================================================= */

function openModal() {
    hideFormError();
    elements.modal.classList.remove("hidden");
}

function closeModal() {
    elements.modal.classList.add("hidden");
    elements.form.reset();
    elements.id.value = "";
    hideFormError();
    editingSanction = false;
}

function openCreateModal() {
    if (!canManage) return;

    editingSanction = false;

    elements.form.reset();
    elements.id.value = "";
    elements.modalTitle.textContent = "NOUVELLE SANCTION";
    elements.date.value = toLocalDateTime();

    openModal();
}

function openEditModal(sanction) {
    if (!canManage) return;

    editingSanction = true;

    elements.id.value = sanction.id;
    elements.pseudoIg.value = sanction.pseudo_ig || "";
    elements.pseudoDiscord.value = sanction.pseudo_discord || "";
    elements.type.value = sanction.type || "";
    elements.reason.value = sanction.motif || "";
    elements.duration.value = sanction.duree || "";
    elements.date.value = toLocalDateTime(
        sanction.date_sanction || sanction.created_at
    );
    elements.notes.value = sanction.notes || "";

    elements.modalTitle.textContent = `MODIFICATION DU DOSSIER #${sanction.id}`;

    openModal();
}

/* =========================================================
   CRÉATION / MODIFICATION
========================================================= */

async function saveSanction(event) {
    event.preventDefault();

    if (!canManage) {
        showFormError("Vous ne disposez pas des droits de gestion.");
        return;
    }

    hideFormError();

    const pseudoIg = elements.pseudoIg.value.trim();
    const pseudoDiscord = elements.pseudoDiscord.value.trim();
    const type = elements.type.value.trim();
    const reason = elements.reason.value.trim();
    const duration = elements.duration.value.trim();
    const dateValue = elements.date.value;
    const notes = elements.notes.value.trim();

    if (!pseudoIg || !pseudoDiscord || !type || !reason || !dateValue) {
        showFormError("Veuillez compléter tous les champs obligatoires.");
        return;
    }

    const parsedDate = new Date(dateValue);

    if (Number.isNaN(parsedDate.getTime())) {
        showFormError("La date indiquée est invalide.");
        return;
    }

    const payload = {
        pseudo_ig: pseudoIg,
        pseudo_discord: pseudoDiscord,
        type,
        motif: reason,
        duree: duration || null,
        date_sanction: parsedDate.toISOString(),
        notes: notes || null
    };

    setLoading(true);

    try {
        let result;

        if (editingSanction) {
            const id = Number(elements.id.value);

            result = await supabaseClient
                .from("sanctions")
                .update(payload)
                .eq("id", id);
        } else {
            payload.staff =
                currentStaff?.pseudo_discord ||
                currentStaff?.pseudo_ig ||
                currentUser.email ||
                "Personnel non identifié";

            result = await supabaseClient
                .from("sanctions")
                .insert(payload);
        }

        if (result.error) throw result.error;

        closeModal();

        showToast(
            editingSanction
                ? "Dossier disciplinaire modifié."
                : "Nouvelle sanction enregistrée."
        );

        await loadSanctions();

    } catch (error) {
        console.error("Erreur d'enregistrement :", error);

        showFormError(
            "L'enregistrement a échoué. Vérifiez vos droits et réessayez."
        );

    } finally {
        setLoading(false);
    }
}

/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteSanction(sanction) {
    if (!canManage) return;

    const confirmation = window.confirm(
        `Confirmer la suppression du dossier #${sanction.id} ?\n\n` +
        "Cette opération est définitive."
    );

    if (!confirmation) return;

    try {
        const { error } = await supabaseClient
            .from("sanctions")
            .delete()
            .eq("id", sanction.id);

        if (error) throw error;

        showToast("Dossier disciplinaire supprimé.");

        await loadSanctions();

    } catch (error) {
        console.error("Erreur de suppression :", error);

        showToast(
            "La suppression a échoué. Vérifiez vos autorisations."
        );
    }
}

/* =========================================================
   ÉVÉNEMENTS
========================================================= */

elements.search.addEventListener("input", renderSanctions);

elements.typeFilter.addEventListener("change", renderSanctions);

elements.refresh.addEventListener("click", loadSanctions);

elements.add.addEventListener("click", openCreateModal);

elements.form.addEventListener("submit", saveSanction);

elements.closeModal.addEventListener("click", closeModal);

elements.cancelModal.addEventListener("click", closeModal);

elements.modalBackdrop.addEventListener("click", closeModal);

document.addEventListener("keydown", event => {
    if (
        event.key === "Escape" &&
        !elements.modal.classList.contains("hidden")
    ) {
        closeModal();
    }
});

/* =========================================================
   DÉMARRAGE
========================================================= */

initializeSanctions();

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        window.location.href = "connexion.html";
    }
});
