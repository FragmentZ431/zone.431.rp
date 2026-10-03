const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let currentRole = null;
let allWhitelistEntries = [];
let editingWhitelistId = null;

const MANAGEMENT_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER MOD",
    "MANAGER ANIM"
];

const READ_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER MOD",
    "MANAGER ANIM",
    "MODÉRATION",
    "ANIMATION"
];

const CATEGORIES = [
    "Conseil O5",
    "Inspection Générale",
    "Comité D'Ethique",
    "A.S.I.A",
    "D.S.I",
    "Classe D",
    "IDC",
    "CMO",
    "Anderson Robotics",
    "Main Du Serpent",
    "UII"
];

/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeWhitelists();
});

async function initializeWhitelists() {
    try {
        await ensureAuthentication();
        await loadStaffRole();

        updateAccessInterface();

        if (!READ_ROLES.includes(currentRole)) {
            showAccessDenied();
            return;
        }

        await loadWhitelists();
        setupModalEvents();

    } catch (error) {
        console.error("Erreur initialisation whitelists :", error);
        showWhitelistError(error.message);
    }
}

/* =========================================================
   AUTHENTIFICATION
   ========================================================= */

async function ensureAuthentication() {
    const {
        data: {
            session
        },
        error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
        throw sessionError;
    }

    if (session) {
        return session;
    }

    const {
        data,
        error
    } = await supabaseClient.auth.signInAnonymously();

    if (error) {
        throw error;
    }

    return data.session;
}

/* =========================================================
   ROLE STAFF
   ========================================================= */

async function loadStaffRole() {
    const {
        data,
        error
    } = await supabaseClient.rpc("current_staff_role");

    if (error) {
        throw error;
    }

    currentRole = data || null;

    console.log("Rôle staff :", currentRole);
}

/* =========================================================
   INTERFACE D'ACCÈS
   ========================================================= */

function updateAccessInterface() {
    const accessStatus = document.getElementById("accessStatus");
    const accessContent = accessStatus?.querySelector(
        ".access-status-content"
    );

    const indicator = accessStatus?.querySelector(
        ".access-status-indicator"
    );

    const title = accessStatus?.querySelector(
        ".access-status-title"
    );

    const description = accessStatus?.querySelector(
        ".access-status-description"
    );

    const createButton = document.getElementById(
        "createWhitelistButton"
    );

    if (!accessStatus || !accessContent) {
        return;
    }

    if (!READ_ROLES.includes(currentRole)) {
        showAccessDenied();
        return;
    }

    accessStatus.classList.add("access-ok");

    if (indicator) {
        indicator.style.display = "block";
    }

    if (title) {
        title.textContent = "ACCÈS AUTORISÉ";
    }

    if (description) {
        description.textContent =
            `NIVEAU D'ACCÈS : ${currentRole}`;
    }

    if (
        createButton &&
        MANAGEMENT_ROLES.includes(currentRole)
    ) {
        createButton.style.display = "inline-flex";

        createButton.addEventListener(
            "click",
            () => openWhitelistModal()
        );
    }
}

/* =========================================================
   ACCÈS REFUSÉ
   ========================================================= */

function showAccessDenied() {
    const accessStatus = document.getElementById(
        "accessStatus"
    );

    if (!accessStatus) {
        return;
    }

    accessStatus.classList.remove("access-ok");
    accessStatus.classList.add("access-denied");

    const title = accessStatus.querySelector(
        ".access-status-title"
    );

    const description = accessStatus.querySelector(
        ".access-status-description"
    );

    if (title) {
        title.textContent = "ACCÈS REFUSÉ";
    }

    if (description) {
        description.textContent =
            "Votre niveau de permission ne permet pas l'accès à ce registre.";
    }

    const createButton = document.getElementById(
        "createWhitelistButton"
    );

    if (createButton) {
        createButton.style.display = "none";
    }

    const list = document.getElementById(
        "whitelistList"
    );

    if (list) {
        list.innerHTML = "";
    }

    const loading = document.getElementById(
        "whitelistLoading"
    );

    if (loading) {
        loading.style.display = "none";
    }
}

/* =========================================================
   CHARGEMENT DES WHITELISTS
   ========================================================= */

async function loadWhitelists() {
    const loading = document.getElementById(
        "whitelistLoading"
    );

    const errorBox = document.getElementById(
        "whitelistError"
    );

    const emptyBox = document.getElementById(
        "whitelistEmpty"
    );

    if (loading) {
        loading.style.display = "flex";
    }

    if (errorBox) {
        errorBox.style.display = "none";
    }

    if (emptyBox) {
        emptyBox.style.display = "none";
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("whitelists")
        .select("*")
        .order("date_whitelist", {
            ascending: false
        });

    if (error) {
        throw error;
    }

    allWhitelistEntries = data || [];

    displayWhitelists();

    if (loading) {
        loading.style.display = "none";
    }
}

/* =========================================================
   AFFICHAGE
   ========================================================= */

function displayWhitelists(entries = allWhitelistEntries) {
    const list = document.getElementById(
        "whitelistList"
    );

    const emptyBox = document.getElementById(
        "whitelistEmpty"
    );

    const count = document.getElementById(
        "whitelistCount"
    );

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (count) {
        count.textContent = entries.length;
    }

    if (entries.length === 0) {
        if (emptyBox) {
            emptyBox.style.display = "flex";
        }

        return;
    }

    if (emptyBox) {
        emptyBox.style.display = "none";
    }

    entries.forEach(entry => {
        list.appendChild(
            createWhitelistCard(entry)
        );
    });
}

/* =========================================================
   CARTE WHITELIST
   ========================================================= */

function createWhitelistCard(entry) {
    const card = document.createElement("article");

    card.className = "whitelist-card";

    const category = escapeHTML(
        entry.categorie || "NON DÉFINIE"
    );

    const discord = escapeHTML(
        entry.pseudo_discord || "N/A"
    );

    const ig = escapeHTML(
        entry.pseudo_ig || "N/A"
    );

    const staff = escapeHTML(
        entry.staff || "N/A"
    );

    const notes = escapeHTML(
        entry.notes || "Aucune note."
    );

    const date = formatDate(
        entry.date_whitelist
    );

    const canManage =
        MANAGEMENT_ROLES.includes(currentRole);

    card.innerHTML = `
        <div class="whitelist-card-header">

            <div class="whitelist-card-category">
                ${category}
            </div>

            <div class="whitelist-card-id">
                WL-${String(entry.id).padStart(4, "0")}
            </div>

        </div>

        <div class="whitelist-card-body">

            <div class="whitelist-field">

                <span class="whitelist-field-label">
                    PSEUDO DISCORD
                </span>

                <span class="whitelist-field-value discord">
                    ${discord}
                </span>

            </div>

            <div class="whitelist-field">

                <span class="whitelist-field-label">
                    PSEUDO IG
                </span>

                <span class="whitelist-field-value">
                    ${ig}
                </span>

            </div>

            <div class="whitelist-field">

                <span class="whitelist-field-label">
                    STAFF RESPONSABLE
                </span>

                <span class="whitelist-field-value">
                    ${staff}
                </span>

            </div>

            <div class="whitelist-field">

                <span class="whitelist-field-label">
                    CATÉGORIE
                </span>

                <span class="whitelist-field-value">
                    ${category}
                </span>

            </div>

            <div class="whitelist-field full">

                <span class="whitelist-field-label">
                    NOTES
                </span>

                <span class="whitelist-field-value notes">
                    ${notes}
                </span>

            </div>

        </div>

        <div class="whitelist-card-footer">

            <div class="whitelist-card-date">
                ${date}
            </div>

            ${
                canManage
                    ? `
                        <div class="whitelist-card-actions">

                            <button
                                type="button"
                                class="card-action"
                                onclick="editWhitelist(${entry.id})"
                            >
                                MODIFIER
                            </button>

                            ${
                                currentRole === "ADMINISTRATEUR"
                                    ? `
                                        <button
                                            type="button"
                                            class="card-action delete"
                                            onclick="deleteWhitelist(${entry.id})"
                                        >
                                            SUPPRIMER
                                        </button>
                                    `
                                    : ""
                            }

                        </div>
                    `
                    : ""
            }

        </div>
    `;

    return card;
}

/* =========================================================
   RECHERCHE DISCORD UNIQUEMENT
   ========================================================= */

function searchWhitelists() {
    const input = document.getElementById(
        "searchInput"
    );

    if (!input) {
        return;
    }

    const search = input.value
        .trim()
        .toLowerCase();

    if (!search) {
        displayWhitelists();
        return;
    }

    const filtered =
        allWhitelistEntries.filter(entry => {

            const discord = String(
                entry.pseudo_discord || ""
            ).toLowerCase();

            return discord.includes(search);
        });

    displayWhitelists(filtered);
}

/* =========================================================
   EFFACER LA RECHERCHE
   ========================================================= */

function clearWhitelistSearch() {
    const input = document.getElementById(
        "searchInput"
    );

    if (input) {
        input.value = "";
        input.focus();
    }

    displayWhitelists();
}

/* =========================================================
   MODAL
   ========================================================= */

function setupModalEvents() {
    const modal = document.getElementById(
        "whitelistModal"
    );

    const closeButton = document.getElementById(
        "closeWhitelistModal"
    );

    const cancelButton = document.getElementById(
        "cancelWhitelistButton"
    );

    const form = document.getElementById(
        "whitelistForm"
    );

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            closeWhitelistModal
        );
    }

    if (cancelButton) {
        cancelButton.addEventListener(
            "click",
            closeWhitelistModal
        );
    }

    if (form) {
        form.addEventListener(
            "submit",
            saveWhitelist
        );
    }

    if (modal) {
        modal.addEventListener(
            "click",
            event => {

                if (
                    event.target === modal
                ) {
                    closeWhitelistModal();
                }

            }
        );
    }

    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {
                closeWhitelistModal();
            }

        }
    );
}

/* =========================================================
   OUVRIR MODAL
   ========================================================= */

function openWhitelistModal(entry = null) {
    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        return;
    }

    const modal = document.getElementById(
        "whitelistModal"
    );

    const title = document.getElementById(
        "modalTitle"
    );

    const form = document.getElementById(
        "whitelistForm"
    );

    if (!modal || !form) {
        return;
    }

    editingWhitelistId =
        entry ? entry.id : null;

    if (title) {
        title.textContent = entry
            ? "MODIFIER LA WHITELIST"
            : "NOUVELLE WHITELIST";
    }

    document.getElementById(
        "whitelistId"
    ).value = entry?.id || "";

    document.getElementById(
        "whitelistPseudoDiscord"
    ).value =
        entry?.pseudo_discord || "";

    document.getElementById(
        "whitelistPseudoIG"
    ).value =
        entry?.pseudo_ig || "";

    document.getElementById(
        "whitelistCategorie"
    ).value =
        entry?.categorie || "";

    document.getElementById(
        "whitelistStaff"
    ).value =
        entry?.staff || "";

    document.getElementById(
        "whitelistDate"
    ).value =
        toDateTimeLocal(
            entry?.date_whitelist
        );

    document.getElementById(
        "whitelistNotes"
    ).value =
        entry?.notes || "";

    modal.style.display = "flex";
}

/* =========================================================
   FERMER MODAL
   ========================================================= */

function closeWhitelistModal() {
    const modal = document.getElementById(
        "whitelistModal"
    );

    if (modal) {
        modal.style.display = "none";
    }

    editingWhitelistId = null;

    const form = document.getElementById(
        "whitelistForm"
    );

    if (form) {
        form.reset();
    }

    const id = document.getElementById(
        "whitelistId"
    );

    if (id) {
        id.value = "";
    }
}

/* =========================================================
   MODIFIER
   ========================================================= */

function editWhitelist(id) {
    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        return;
    }

    const entry =
        allWhitelistEntries.find(
            item => item.id === id
        );

    if (!entry) {
        return;
    }

    openWhitelistModal(entry);
}

/* =========================================================
   SAUVEGARDER
   ========================================================= */

async function saveWhitelist(event) {
    event.preventDefault();

    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        return;
    }

    const pseudoDiscord =
        document.getElementById(
            "whitelistPseudoDiscord"
        ).value.trim();

    const pseudoIG =
        document.getElementById(
            "whitelistPseudoIG"
        ).value.trim();

    const categorie =
        document.getElementById(
            "whitelistCategorie"
        ).value;

    const staff =
        document.getElementById(
            "whitelistStaff"
        ).value.trim();

    const dateValue =
        document.getElementById(
            "whitelistDate"
        ).value;

    const notes =
        document.getElementById(
            "whitelistNotes"
        ).value.trim();

    if (
        !pseudoDiscord ||
        !pseudoIG ||
        !categorie ||
        !staff
    ) {
        alert(
            "Veuillez remplir tous les champs obligatoires."
        );

        return;
    }

    if (!CATEGORIES.includes(categorie)) {
        alert(
            "La catégorie sélectionnée est invalide."
        );

        return;
    }

    const payload = {
        pseudo_discord: pseudoDiscord,
        pseudo_ig: pseudoIG,
        categorie: categorie,
        staff: staff,
        date_whitelist: dateValue
            ? new Date(dateValue).toISOString()
            : new Date().toISOString(),
        notes: notes || null
    };

    try {

        let error = null;

        if (editingWhitelistId) {

            const result =
                await supabaseClient
                    .from("whitelists")
                    .update(payload)
                    .eq(
                        "id",
                        editingWhitelistId
                    );

            error = result.error;

        } else {

            const result =
                await supabaseClient
                    .from("whitelists")
                    .insert([payload]);

            error = result.error;
        }

        if (error) {
            throw error;
        }

        closeWhitelistModal();

        await loadWhitelists();

    } catch (error) {

        console.error(
            "Erreur sauvegarde whitelist :",
            error
        );

        alert(
            "Impossible d'enregistrer la whitelist.\n\n" +
            error.message
        );
    }
}

/* =========================================================
   SUPPRIMER
   ========================================================= */

async function deleteWhitelist(id) {
    if (currentRole !== "ADMINISTRATEUR") {
        return;
    }

    const entry =
        allWhitelistEntries.find(
            item => item.id === id
        );

    if (!entry) {
        return;
    }

    const confirmed = confirm(
        `Supprimer définitivement la whitelist de "${entry.pseudo_discord}" ?`
    );

    if (!confirmed) {
        return;
    }

    try {

        const {
            error
        } = await supabaseClient
            .from("whitelists")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        await loadWhitelists();

    } catch (error) {

        console.error(
            "Erreur suppression whitelist :",
            error
        );

        alert(
            "Impossible de supprimer la whitelist.\n\n" +
            error.message
        );
    }
}

/* =========================================================
   ERREUR
   ========================================================= */

function showWhitelistError(message) {
    const loading = document.getElementById(
        "whitelistLoading"
    );

    const errorBox = document.getElementById(
        "whitelistError"
    );

    const errorMessage = document.getElementById(
        "whitelistErrorMessage"
    );

    if (loading) {
        loading.style.display = "none";
    }

    if (errorBox) {
        errorBox.style.display = "block";
    }

    if (errorMessage) {
        errorMessage.textContent =
            message || "Erreur inconnue.";
    }
}

/* =========================================================
   DATE
   ========================================================= */

function formatDate(dateValue) {
    if (!dateValue) {
        return "DATE INCONNUE";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "DATE INVALIDE";
    }

    return date.toLocaleString(
        "fr-FR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }
    );
}

function toDateTimeLocal(dateValue) {
    if (!dateValue) {
        return "";
    }

    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const pad = value =>
        String(value).padStart(2, "0");

    return (
        date.getFullYear() +
        "-" +
        pad(date.getMonth() + 1) +
        "-" +
        pad(date.getDate()) +
        "T" +
        pad(date.getHours()) +
        ":" +
        pad(date.getMinutes())
    );
}

/* =========================================================
   PROTECTION HTML
   ========================================================= */

function escapeHTML(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}