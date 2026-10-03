const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let currentRole = null;
let allBlacklistEntries = [];
let editingBlacklistId = null;

const MANAGEMENT_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER MOD",
    "MANAGER ANIM"
];

const READ_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER MOD",
    "MANAGER ANIM",
    "MODÉRATION"
];

document.addEventListener("DOMContentLoaded", () => {
    initializeBlacklist();
});


/* =========================================================
   INITIALISATION
   ========================================================= */

async function initializeBlacklist() {
    try {
        await ensureAuthentication();
        await loadStaffRole();
        updateAccessInterface();

        if (!READ_ROLES.includes(currentRole)) {
            showAccessDenied();
            return;
        }

        await loadBlacklist();

        setupModalEvents();

    } catch (error) {
        console.error("Erreur initialisation blacklist :", error);
        showBlacklistError(
            "Impossible d'initialiser le système de blacklist."
        );
    }
}


/* =========================================================
   AUTHENTIFICATION
   ========================================================= */

async function ensureAuthentication() {
    const {
        data: sessionData,
        error: sessionError
    } = await supabaseClient.auth.getSession();

    if (sessionError) {
        throw sessionError;
    }

    if (sessionData.session) {
        return;
    }

    const {
        error
    } = await supabaseClient.auth.signInAnonymously();

    if (error) {
        throw error;
    }
}


/* =========================================================
   RÔLE STAFF
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

    console.log("Rôle blacklist :", currentRole);
}


/* =========================================================
   INTERFACE D'ACCÈS
   ========================================================= */

function updateAccessInterface() {
    const accessPanel = document.getElementById("accessStatus");
    const createButton = document.getElementById(
        "createBlacklistButton"
    );

    if (!accessPanel) {
        return;
    }

    const content = accessPanel.querySelector(
        ".access-status-content"
    );

    if (READ_ROLES.includes(currentRole)) {
        accessPanel.classList.add("access-ok");

        if (content) {
            content.innerHTML = `
                <strong>ACCÈS AUTORISÉ</strong>
                <span>Niveau d'accès : ${escapeHTML(currentRole)}</span>
            `;
        }
    } else {
        accessPanel.classList.add("access-denied");

        if (content) {
            content.innerHTML = `
                <strong>ACCÈS REFUSÉ</strong>
                <span>Votre grade ne permet pas l'accès à cette base.</span>
            `;
        }
    }

    if (
        createButton &&
        MANAGEMENT_ROLES.includes(currentRole)
    ) {
        createButton.style.display = "inline-flex";
        createButton.addEventListener(
            "click",
            () => openBlacklistModal()
        );
    }
}


/* =========================================================
   ACCÈS REFUSÉ
   ========================================================= */

function showAccessDenied() {
    const list = document.getElementById("blacklistList");
    const empty = document.getElementById("blacklistEmpty");
    const loading = document.getElementById("blacklistLoading");

    if (loading) {
        loading.style.display = "none";
    }

    if (empty) {
        empty.style.display = "none";
    }

    if (list) {
        list.innerHTML = `
            <div class="blacklist-state blacklist-state-error">
                <div class="state-symbol">!</div>

                <strong>ACCÈS REFUSÉ</strong>

                <span>
                    Votre grade ne possède pas les autorisations
                    nécessaires pour consulter cette base.
                </span>
            </div>
        `;
    }
}


/* =========================================================
   CHARGEMENT BLACKLIST
   ========================================================= */

async function loadBlacklist() {
    const loading = document.getElementById("blacklistLoading");
    const errorBox = document.getElementById("blacklistError");

    if (loading) {
        loading.style.display = "flex";
    }

    if (errorBox) {
        errorBox.style.display = "none";
    }

    const {
        data,
        error
    } = await supabaseClient
        .from("blacklist")
        .select("*")
        .order("date_blacklist", {
            ascending: false
        });

    if (error) {
        console.error("Erreur chargement blacklist :", error);
        showBlacklistError(
            "Impossible de récupérer les données de la blacklist."
        );
        return;
    }

    allBlacklistEntries = data || [];

    displayBlacklist(allBlacklistEntries);
}


/* =========================================================
   AFFICHAGE
   ========================================================= */

function displayBlacklist(entries) {
    const list = document.getElementById("blacklistList");
    const loading = document.getElementById("blacklistLoading");
    const empty = document.getElementById("blacklistEmpty");
    const errorBox = document.getElementById("blacklistError");
    const count = document.getElementById("blacklistCount");

    if (loading) {
        loading.style.display = "none";
    }

    if (errorBox) {
        errorBox.style.display = "none";
    }

    if (count) {
        count.textContent = entries.length;
    }

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (entries.length === 0) {
        if (empty) {
            empty.style.display = "flex";
        }

        return;
    }

    if (empty) {
        empty.style.display = "none";
    }

    entries.forEach(entry => {
        list.appendChild(
            createBlacklistCard(entry)
        );
    });
}


/* =========================================================
   CARTE BLACKLIST
   ========================================================= */

function createBlacklistCard(entry) {
    const card = document.createElement("article");

    card.className = "blacklist-card";

    const date = formatDate(entry.date_blacklist);

    const canEdit = MANAGEMENT_ROLES.includes(currentRole);
    const canDelete = currentRole === "ADMINISTRATEUR";

    const notesHTML = entry.notes
        ? `
            <div class="blacklist-field">
                <span class="blacklist-field-label">
                    NOTES
                </span>

                <div class="blacklist-notes">
                    ${escapeHTML(entry.notes)}
                </div>
            </div>
        `
        : "";

    const actionsHTML =
        canEdit || canDelete
            ? `
                <div class="blacklist-card-actions">

                    ${
                        canEdit
                            ? `
                                <button
                                    type="button"
                                    class="blacklist-edit-button"
                                    onclick="editBlacklist(${entry.id})"
                                >
                                    MODIFIER
                                </button>
                            `
                            : ""
                    }

                    ${
                        canDelete
                            ? `
                                <button
                                    type="button"
                                    class="blacklist-delete-button"
                                    onclick="deleteBlacklist(${entry.id})"
                                >
                                    SUPPRIMER
                                </button>
                            `
                            : ""
                    }

                </div>
            `
            : "";

    card.innerHTML = `
        <div class="blacklist-card-header">

            <div class="blacklist-identity">

                <span class="blacklist-discord">
                    ${escapeHTML(entry.pseudo_discord)}
                </span>

                <span class="blacklist-ig">
                    IG : ${escapeHTML(entry.pseudo_ig)}
                </span>

            </div>

            <div class="blacklist-badges">

                <span class="blacklist-badge blacklist-badge-discord">
                    DISCORD
                </span>

                <span class="blacklist-badge blacklist-badge-duration">
                    ${escapeHTML(entry.duree)}
                </span>

            </div>

        </div>


        <div class="blacklist-card-content">

            <div class="blacklist-field">

                <span class="blacklist-field-label">
                    MOTIF
                </span>

                <div class="blacklist-field-value blacklist-motif">
                    ${escapeHTML(entry.motif)}
                </div>

            </div>


            ${notesHTML}

        </div>


        <div class="blacklist-card-footer">

            <div class="blacklist-meta">

                <span class="blacklist-staff">
                    RÉDACTEUR :
                    ${escapeHTML(entry.staff)}
                </span>

                <span class="blacklist-date">
                    ${date}
                </span>

            </div>

            ${actionsHTML}

        </div>
    `;

    return card;
}


/* =========================================================
   RECHERCHE
   ========================================================= */

function searchBlacklist() {
    const input = document.getElementById("searchInput");

    if (!input) {
        return;
    }

    const search = input.value
        .trim()
        .toLowerCase();

    if (!search) {
        displayBlacklist(allBlacklistEntries);
        return;
    }

    const filtered = allBlacklistEntries.filter(entry => {

        const discord = String(
            entry.pseudo_discord || ""
        ).toLowerCase();

        return discord.includes(search);
    });

    displayBlacklist(filtered);
}


function clearBlacklistSearch() {
    const input = document.getElementById("searchInput");

    if (!input) {
        return;
    }

    input.value = "";

    displayBlacklist(allBlacklistEntries);

    input.focus();
}


/* =========================================================
   MODAL
   ========================================================= */

function setupModalEvents() {
    const modal = document.getElementById("blacklistModal");
    const closeButton = document.getElementById(
        "closeBlacklistModal"
    );
    const cancelButton = document.getElementById(
        "cancelBlacklistButton"
    );
    const form = document.getElementById("blacklistForm");

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            closeBlacklistModal
        );
    }

    if (cancelButton) {
        cancelButton.addEventListener(
            "click",
            closeBlacklistModal
        );
    }

    if (modal) {
        modal.addEventListener("click", event => {
            if (event.target === modal) {
                closeBlacklistModal();
            }
        });
    }

    if (form) {
        form.addEventListener(
            "submit",
            saveBlacklist
        );
    }

    document.addEventListener("keydown", event => {
        if (
            event.key === "Escape" &&
            modal &&
            modal.style.display !== "none"
        ) {
            closeBlacklistModal();
        }
    });
}


function openBlacklistModal(entry = null) {
    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        return;
    }

    const modal = document.getElementById("blacklistModal");
    const title = document.getElementById(
        "blacklistModalTitle"
    );

    const idInput = document.getElementById(
        "blacklistId"
    );

    const discordInput = document.getElementById(
        "blacklistPseudoDiscord"
    );

    const igInput = document.getElementById(
        "blacklistPseudoIG"
    );

    const motifInput = document.getElementById(
        "blacklistMotif"
    );

    const dureeInput = document.getElementById(
        "blacklistDuree"
    );

    const staffInput = document.getElementById(
        "blacklistStaff"
    );

    const dateInput = document.getElementById(
        "blacklistDate"
    );

    const notesInput = document.getElementById(
        "blacklistNotes"
    );

    editingBlacklistId = entry
        ? entry.id
        : null;

    if (entry) {
        title.textContent = "MODIFIER UNE ENTRÉE";

        idInput.value = entry.id || "";

        discordInput.value =
            entry.pseudo_discord || "";

        igInput.value =
            entry.pseudo_ig || "";

        motifInput.value =
            entry.motif || "";

        dureeInput.value =
            entry.duree || "";

        staffInput.value =
            entry.staff || "";

        dateInput.value =
            formatDateForInput(
                entry.date_blacklist
            );

        notesInput.value =
            entry.notes || "";

    } else {
        title.textContent = "AJOUTER UNE ENTRÉE";

        idInput.value = "";

        discordInput.value = "";
        igInput.value = "";
        motifInput.value = "";
        dureeInput.value = "";

        staffInput.value = "";

        dateInput.value =
            formatDateForInput(
                new Date().toISOString()
            );

        notesInput.value = "";
    }

    modal.style.display = "flex";

    setTimeout(() => {
        discordInput.focus();
    }, 50);
}


function closeBlacklistModal() {
    const modal = document.getElementById(
        "blacklistModal"
    );

    const form = document.getElementById(
        "blacklistForm"
    );

    if (modal) {
        modal.style.display = "none";
    }

    if (form) {
        form.reset();
    }

    editingBlacklistId = null;
}


/* =========================================================
   MODIFICATION
   ========================================================= */

async function editBlacklist(id) {
    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        return;
    }

    const entry = allBlacklistEntries.find(
        item => Number(item.id) === Number(id)
    );

    if (!entry) {
        alert("Entrée blacklist introuvable.");
        return;
    }

    openBlacklistModal(entry);
}


/* =========================================================
   CRÉATION / MODIFICATION
   ========================================================= */

async function saveBlacklist(event) {
    event.preventDefault();

    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        alert(
            "Vous ne disposez pas des autorisations nécessaires."
        );
        return;
    }

    const discord = document.getElementById(
        "blacklistPseudoDiscord"
    ).value.trim();

    const ig = document.getElementById(
        "blacklistPseudoIG"
    ).value.trim();

    const motif = document.getElementById(
        "blacklistMotif"
    ).value.trim();

    const duree = document.getElementById(
        "blacklistDuree"
    ).value.trim();

    const staff = document.getElementById(
        "blacklistStaff"
    ).value.trim();

    const dateInput = document.getElementById(
        "blacklistDate"
    ).value;

    const notes = document.getElementById(
        "blacklistNotes"
    ).value.trim();

    if (
        !discord ||
        !ig ||
        !motif ||
        !duree ||
        !staff
    ) {
        alert(
            "Veuillez remplir tous les champs obligatoires."
        );
        return;
    }

    const saveButton = document.getElementById(
        "saveBlacklistButton"
    );

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "ENREGISTREMENT...";
    }

    try {
        const payload = {
            pseudo_discord: discord,
            pseudo_ig: ig,
            motif: motif,
            duree: duree,
            staff: staff,
            notes: notes || null
        };

        if (dateInput) {
            payload.date_blacklist =
                new Date(dateInput).toISOString();
        }

        let error = null;

        if (editingBlacklistId) {

            const result = await supabaseClient
                .from("blacklist")
                .update(payload)
                .eq("id", editingBlacklistId);

            error = result.error;

        } else {

            const result = await supabaseClient
                .from("blacklist")
                .insert(payload);

            error = result.error;
        }

        if (error) {
            throw error;
        }

        closeBlacklistModal();

        await loadBlacklist();

    } catch (error) {

        console.error(
            "Erreur enregistrement blacklist :",
            error
        );

        alert(
            "Impossible d'enregistrer cette entrée."
        );

    } finally {

        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "ENREGISTRER";
        }
    }
}


/* =========================================================
   SUPPRESSION
   ========================================================= */

async function deleteBlacklist(id) {
    if (currentRole !== "ADMINISTRATEUR") {
        alert(
            "Seul un ADMINISTRATEUR peut supprimer une entrée."
        );
        return;
    }

    const entry = allBlacklistEntries.find(
        item => Number(item.id) === Number(id)
    );

    if (!entry) {
        alert("Entrée blacklist introuvable.");
        return;
    }

    const confirmed = confirm(
        `Supprimer définitivement l'entrée de ${entry.pseudo_discord} ?`
    );

    if (!confirmed) {
        return;
    }

    try {

        const {
            error
        } = await supabaseClient
            .from("blacklist")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        await loadBlacklist();

    } catch (error) {

        console.error(
            "Erreur suppression blacklist :",
            error
        );

        alert(
            "Impossible de supprimer cette entrée."
        );
    }
}


/* =========================================================
   ERREUR
   ========================================================= */

function showBlacklistError(message) {
    const loading = document.getElementById(
        "blacklistLoading"
    );

    const empty = document.getElementById(
        "blacklistEmpty"
    );

    const list = document.getElementById(
        "blacklistList"
    );

    const errorBox = document.getElementById(
        "blacklistError"
    );

    const errorMessage = document.getElementById(
        "blacklistErrorMessage"
    );

    if (loading) {
        loading.style.display = "none";
    }

    if (empty) {
        empty.style.display = "none";
    }

    if (list) {
        list.innerHTML = "";
    }

    if (errorMessage) {
        errorMessage.textContent = message;
    }

    if (errorBox) {
        errorBox.style.display = "flex";
    }
}


/* =========================================================
   DATES
   ========================================================= */

function formatDate(value) {
    if (!value) {
        return "DATE INCONNUE";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "DATE INVALIDE";
    }

    return date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}


function formatDateForInput(value) {
    if (!value) {
        return "";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const year = date.getFullYear();

    const month = String(
        date.getMonth() + 1
    ).padStart(2, "0");

    const day = String(
        date.getDate()
    ).padStart(2, "0");

    const hours = String(
        date.getHours()
    ).padStart(2, "0");

    const minutes = String(
        date.getMinutes()
    ).padStart(2, "0");

    return `${year}-${month}-${day}T${hours}:${minutes}`;
}


/* =========================================================
   SÉCURITÉ HTML
   ========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}