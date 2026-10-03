/* =========================================================
   ZONE-431 // RECENSEMENT
   ========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);


/* =========================================================
   CONFIGURATION
   ========================================================= */

const ADMIN_ROLE = "ADMINISTRATEUR";

const READ_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER MOD",
    "MANAGER ANIM"
];

const GRADES = [
    "Admin",
    "Manager Anim",
    "Manager Mod",
    "Animateur",
    "Modérateur",
    "Animateur Test",
    "Modérateur Test"
];


/* =========================================================
   VARIABLES
   ========================================================= */

let currentRole = null;
let allRecensementEntries = [];
let editingRecensementId = null;


/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeRecensement();
});


async function initializeRecensement() {

    try {

        await ensureAuthentication();
        await loadStaffRole();

        updateAccessInterface();

        if (!READ_ROLES.includes(currentRole)) {
            showAccessDenied();
            return;
        }

        await loadRecensement();

        setupModalEvents();
        setupSearchEvents();

    } catch (error) {

        console.error("Erreur initialisation recensement :", error);

        showRecensementError(
            "Impossible d'initialiser le registre."
        );
    }
}


/* =========================================================
   AUTHENTIFICATION
   ========================================================= */

async function ensureAuthentication() {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();

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
   RÔLE STAFF
   ========================================================= */

async function loadStaffRole() {

    const {
        data: {
            session
        }
    } = await supabaseClient.auth.getSession();

    if (!session) {
        throw new Error("Session introuvable.");
    }

    const {
        data,
        error
    } = await supabaseClient.rpc("current_staff_role");

    if (error) {
        throw error;
    }

    currentRole = data || null;

    sessionStorage.setItem(
        "zone431_role",
        currentRole || ""
    );
}


/* =========================================================
   INTERFACE D'ACCÈS
   ========================================================= */

function updateAccessInterface() {

    const accessStatus =
        document.getElementById("accessStatus");

    const accessDescription =
        document.getElementById("accessDescription");

    const accessRole =
        document.getElementById("accessRole");

    const createButton =
        document.getElementById("createRecensementButton");


    if (!READ_ROLES.includes(currentRole)) {

        accessStatus.textContent = "ACCÈS REFUSÉ";
        accessStatus.style.color = "var(--red-light)";

        accessDescription.textContent =
            "Votre grade ne possède pas les autorisations nécessaires.";

        accessRole.textContent =
            currentRole || "NON AUTORISÉ";

        createButton.classList.add("hidden");

        return;
    }


    accessStatus.textContent = "ACCÈS AUTORISÉ";
    accessStatus.style.color = "var(--green)";

    accessRole.textContent = currentRole;


    if (currentRole === ADMIN_ROLE) {

        accessDescription.textContent =
            "Accès complet au registre : lecture, création, modification et suppression.";

        createButton.classList.remove("hidden");

        createButton.onclick = () => {
            openRecensementModal();
        };

    } else {

        accessDescription.textContent =
            "Accès en lecture seule au registre du personnel.";

        createButton.classList.add("hidden");
    }
}


/* =========================================================
   ACCÈS REFUSÉ
   ========================================================= */

function showAccessDenied() {

    const loading =
        document.getElementById("recensementLoading");

    const empty =
        document.getElementById("recensementEmpty");

    const error =
        document.getElementById("recensementError");

    const errorMessage =
        document.getElementById("recensementErrorMessage");

    loading.classList.add("hidden");
    empty.classList.add("hidden");

    error.classList.remove("hidden");

    errorMessage.textContent =
        "Votre grade ne possède pas l'autorisation d'accéder au recensement.";
}


/* =========================================================
   CHARGEMENT DU RECENSEMENT
   ========================================================= */

async function loadRecensement() {

    const loading =
        document.getElementById("recensementLoading");

    const empty =
        document.getElementById("recensementEmpty");

    const error =
        document.getElementById("recensementError");

    loading.classList.remove("hidden");
    empty.classList.add("hidden");
    error.classList.add("hidden");

    const {
        data,
        error: queryError
    } = await supabaseClient
        .from("recensement")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (queryError) {
        throw queryError;
    }

    allRecensementEntries = data || [];

    loading.classList.add("hidden");

    displayRecensement(allRecensementEntries);
}


/* =========================================================
   AFFICHAGE
   ========================================================= */

function displayRecensement(entries) {

    const list =
        document.getElementById("recensementList");

    const empty =
        document.getElementById("recensementEmpty");

    const count =
        document.getElementById("recensementCount");


    list.innerHTML = "";

    count.textContent = entries.length;


    if (!entries.length) {

        empty.classList.remove("hidden");

        return;
    }

    empty.classList.add("hidden");


    entries.forEach(entry => {

        list.appendChild(
            createRecensementCard(entry)
        );

    });
}


/* =========================================================
   CARTE
   ========================================================= */

function createRecensementCard(entry) {

    const card =
        document.createElement("article");

    card.className = "recensement-card";

    const canManage =
        currentRole === ADMIN_ROLE;


    card.innerHTML = `

        <div class="card-header">

            <div class="card-identity">

                <div class="card-discord">
                    ${escapeHTML(entry.pseudo_discord)}
                </div>

                <div class="card-ig">
                    ${escapeHTML(entry.pseudo_ig)}
                </div>

            </div>

            <div class="card-grade">
                ${escapeHTML(entry.grade)}
            </div>

        </div>


        <div class="card-body">

            <div class="card-field">

                <div class="card-field-label">
                    PSEUDO DISCORD
                </div>

                <div class="card-field-value">
                    ${escapeHTML(entry.pseudo_discord)}
                </div>

            </div>


            <div class="card-field">

                <div class="card-field-label">
                    PSEUDO IG
                </div>

                <div class="card-field-value">
                    ${escapeHTML(entry.pseudo_ig)}
                </div>

            </div>


            <div class="card-field">

                <div class="card-field-label">
                    GRADE
                </div>

                <div class="card-field-value">
                    ${escapeHTML(entry.grade)}
                </div>

            </div>


            <div class="card-field">

                <div class="card-field-label">
                    ID RECENSEMENT
                </div>

                <div class="card-field-value card-id">
                    REC-${String(entry.id).padStart(4, "0")}
                </div>

            </div>

        </div>


        ${
            canManage
                ? `
                    <div class="card-actions">

                        <button
                            type="button"
                            class="card-action edit"
                            data-action="edit"
                            data-id="${entry.id}"
                        >
                            MODIFIER
                        </button>

                        <button
                            type="button"
                            class="card-action delete"
                            data-action="delete"
                            data-id="${entry.id}"
                        >
                            SUPPRIMER
                        </button>

                    </div>
                `
                : ""
        }

    `;


    if (canManage) {

        const editButton =
            card.querySelector('[data-action="edit"]');

        const deleteButton =
            card.querySelector('[data-action="delete"]');


        editButton.addEventListener("click", () => {

            const id =
                Number(editButton.dataset.id);

            openRecensementModal(id);

        });


        deleteButton.addEventListener("click", () => {

            const id =
                Number(deleteButton.dataset.id);

            deleteRecensement(id);

        });

    }


    return card;
}


/* =========================================================
   RECHERCHE
   ========================================================= */

function setupSearchEvents() {

    const searchInput =
        document.getElementById("searchInput");

    const gradeFilter =
        document.getElementById("gradeFilter");

    const clearButton =
        document.getElementById("clearSearchButton");


    searchInput.addEventListener(
        "input",
        applyRecensementFilters
    );

    gradeFilter.addEventListener(
        "change",
        applyRecensementFilters
    );

    clearButton.addEventListener(
        "click",
        clearRecensementSearch
    );
}


function applyRecensementFilters() {

    const searchInput =
        document.getElementById("searchInput");

    const gradeFilter =
        document.getElementById("gradeFilter");


    const search =
        searchInput.value
            .trim()
            .toLowerCase();

    const grade =
        gradeFilter.value;


    const filtered =
        allRecensementEntries.filter(entry => {

            const discord =
                String(
                    entry.pseudo_discord || ""
                ).toLowerCase();

            const ig =
                String(
                    entry.pseudo_ig || ""
                ).toLowerCase();


            const matchesSearch =
                !search ||
                discord.includes(search) ||
                ig.includes(search);


            const matchesGrade =
                !grade ||
                entry.grade === grade;


            return (
                matchesSearch &&
                matchesGrade
            );
        });


    displayRecensement(filtered);
}


function clearRecensementSearch() {

    document.getElementById(
        "searchInput"
    ).value = "";

    document.getElementById(
        "gradeFilter"
    ).value = "";

    displayRecensement(
        allRecensementEntries
    );
}


/* =========================================================
   MODAL
   ========================================================= */

function setupModalEvents() {

    const modal =
        document.getElementById("recensementModal");

    const closeButton =
        modal.querySelector(".modal-close");

    const cancelButton =
        modal.querySelector(".cancel-button");

    const background =
        modal.querySelector(".modal-background");

    const form =
        document.getElementById("recensementForm");


    closeButton.addEventListener(
        "click",
        closeRecensementModal
    );

    cancelButton.addEventListener(
        "click",
        closeRecensementModal
    );

    background.addEventListener(
        "click",
        closeRecensementModal
    );

    form.addEventListener(
        "submit",
        saveRecensement
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape" &&
                !modal.classList.contains("hidden")
            ) {
                closeRecensementModal();
            }

        }
    );
}


/* =========================================================
   OUVERTURE MODAL
   ========================================================= */

function openRecensementModal(id = null) {

    if (currentRole !== ADMIN_ROLE) {
        return;
    }

    const modal =
        document.getElementById("recensementModal");

    const form =
        document.getElementById("recensementForm");

    const title =
        modal.querySelector(".modal-header h2");

    const formError =
        document.getElementById("recensementFormError");


    form.reset();

    formError.classList.add("hidden");
    formError.textContent = "";

    editingRecensementId = id;


    if (id !== null) {

        const entry =
            allRecensementEntries.find(
                item => Number(item.id) === Number(id)
            );

        if (!entry) {
            return;
        }


        title.textContent =
            "MODIFIER L'ENREGISTREMENT";


        document.getElementById(
            "recensementId"
        ).value = entry.id;


        document.getElementById(
            "recensementPseudoDiscord"
        ).value = entry.pseudo_discord || "";


        document.getElementById(
            "recensementPseudoIG"
        ).value = entry.pseudo_ig || "";


        document.getElementById(
            "recensementGrade"
        ).value = entry.grade || "";

    } else {

        title.textContent =
            "NOUVEL ENREGISTREMENT";

        document.getElementById(
            "recensementId"
        ).value = "";

    }


    modal.classList.remove("hidden");
}


/* =========================================================
   FERMETURE MODAL
   ========================================================= */

function closeRecensementModal() {

    const modal =
        document.getElementById("recensementModal");

    modal.classList.add("hidden");

    editingRecensementId = null;

    document.getElementById(
        "recensementFormError"
    ).classList.add("hidden");
}


/* =========================================================
   SAUVEGARDE
   ========================================================= */

async function saveRecensement(event) {

    event.preventDefault();


    if (currentRole !== ADMIN_ROLE) {
        return;
    }


    const formError =
        document.getElementById("recensementFormError");

    formError.classList.add("hidden");
    formError.textContent = "";


    const pseudoDiscord =
        document.getElementById(
            "recensementPseudoDiscord"
        ).value.trim();

    const pseudoIG =
        document.getElementById(
            "recensementPseudoIG"
        ).value.trim();

    const grade =
        document.getElementById(
            "recensementGrade"
        ).value;


    if (!pseudoDiscord) {

        showFormError(
            "Le pseudo Discord est obligatoire."
        );

        return;
    }


    if (!pseudoIG) {

        showFormError(
            "Le pseudo IG est obligatoire."
        );

        return;
    }


    if (!GRADES.includes(grade)) {

        showFormError(
            "Le grade sélectionné est invalide."
        );

        return;
    }


    const payload = {
        pseudo_discord: pseudoDiscord,
        pseudo_ig: pseudoIG,
        grade: grade
    };


    try {

        if (editingRecensementId !== null) {

            const {
                error
            } = await supabaseClient
                .from("recensement")
                .update(payload)
                .eq(
                    "id",
                    editingRecensementId
                );

            if (error) {
                throw error;
            }

        } else {

            const {
                error
            } = await supabaseClient
                .from("recensement")
                .insert(payload);

            if (error) {
                throw error;
            }
        }


        closeRecensementModal();

        await loadRecensement();

    } catch (error) {

        console.error(
            "Erreur sauvegarde recensement :",
            error
        );

        showFormError(
            "Impossible d'enregistrer cette entrée."
        );
    }
}


/* =========================================================
   SUPPRESSION
   ========================================================= */

async function deleteRecensement(id) {

    if (currentRole !== ADMIN_ROLE) {
        return;
    }


    const entry =
        allRecensementEntries.find(
            item => Number(item.id) === Number(id)
        );


    if (!entry) {
        return;
    }


    const confirmed =
        window.confirm(
            `Supprimer le recensement de "${entry.pseudo_discord}" ?`
        );


    if (!confirmed) {
        return;
    }


    try {

        const {
            error
        } = await supabaseClient
            .from("recensement")
            .delete()
            .eq("id", id);


        if (error) {
            throw error;
        }


        await loadRecensement();

    } catch (error) {

        console.error(
            "Erreur suppression recensement :",
            error
        );

        showRecensementError(
            "Impossible de supprimer cet enregistrement."
        );
    }
}


/* =========================================================
   ERREURS
   ========================================================= */

function showFormError(message) {

    const formError =
        document.getElementById(
            "recensementFormError"
        );

    formError.textContent = message;
    formError.classList.remove("hidden");
}


function showRecensementError(message) {

    const loading =
        document.getElementById(
            "recensementLoading"
        );

    const empty =
        document.getElementById(
            "recensementEmpty"
        );

    const error =
        document.getElementById(
            "recensementError"
        );

    const errorMessage =
        document.getElementById(
            "recensementErrorMessage"
        );


    loading.classList.add("hidden");
    empty.classList.add("hidden");

    errorMessage.textContent = message;

    error.classList.remove("hidden");
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