const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
);

let currentRole = null;
let allEventRequests = [];
let editingEventRequestId = null;

const CREATE_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER ANIM",
    "ANIMATION"
];

const MANAGEMENT_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER ANIM"
];

const DELETE_ROLES = [
    "ADMINISTRATEUR"
];

const READ_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER ANIM",
    "ANIMATION"
];

document.addEventListener("DOMContentLoaded", () => {
    initializeEventRequests();
});


/* =========================================================
   INITIALISATION
========================================================= */

async function initializeEventRequests() {
    try {
        await ensureAuthentication();
        await loadStaffRole();

        updateAccessInterface();

        if (!READ_ROLES.includes(currentRole)) {
            showAccessDenied();
            return;
        }

        await loadEventRequests();
        setupModalEvents();

    } catch (error) {
        console.error("Erreur initialisation demandes événements :", error);
        showError("Impossible d'initialiser le module.");
    }
}


/* =========================================================
   AUTHENTIFICATION
========================================================= */

async function ensureAuthentication() {
    const {
        data: { session },
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
}


/* =========================================================
   INTERFACE DES DROITS
========================================================= */

function updateAccessInterface() {
    const accessStatus = document.getElementById("accessStatus");
    const accessDescription = document.getElementById("accessDescription");
    const accessRole = document.getElementById("accessRole");
    const createButton = document.getElementById("createEventRequestButton");

    if (!accessStatus || !accessDescription || !accessRole) {
        return;
    }

    accessRole.textContent = currentRole || "ACCÈS INCONNU";

    if (CREATE_ROLES.includes(currentRole)) {
        accessStatus.textContent = "ACCÈS AUTORISÉ";
        accessStatus.className = "access-ok";

        if (currentRole === "ANIMATION") {
            accessDescription.textContent =
                "Rédaction et transmission des demandes d'évènements.";
        } else {
            accessDescription.textContent =
                "Rédaction et gestion des demandes d'évènements.";
        }

        if (createButton) {
            createButton.classList.remove("hidden");
        }

    } else {
        accessStatus.textContent = "ACCÈS REFUSÉ";
        accessStatus.className = "access-denied";

        accessDescription.textContent =
            "Votre grade ne dispose pas d'un accès à ce registre.";

        if (createButton) {
            createButton.classList.add("hidden");
        }
    }

    if (createButton && CREATE_ROLES.includes(currentRole)) {
        createButton.onclick = () => openCreateModal();
    }
}


/* =========================================================
   ACCÈS REFUSÉ
========================================================= */

function showAccessDenied() {
    const loading = document.getElementById("eventRequestLoading");
    const empty = document.getElementById("eventRequestEmpty");
    const error = document.getElementById("eventRequestError");

    if (loading) {
        loading.classList.add("hidden");
    }

    if (empty) {
        empty.classList.add("hidden");
    }

    if (error) {
        error.classList.remove("hidden");
    }

    const errorMessage =
        document.getElementById("eventRequestErrorMessage");

    if (errorMessage) {
        errorMessage.textContent =
            "Votre grade ne dispose pas des autorisations nécessaires pour consulter les demandes d'évènements.";
    }
}


/* =========================================================
   CHARGEMENT
========================================================= */

async function loadEventRequests() {
    const loading = document.getElementById("eventRequestLoading");
    const error = document.getElementById("eventRequestError");

    if (loading) {
        loading.classList.remove("hidden");
    }

    if (error) {
        error.classList.add("hidden");
    }

    const {
        data,
        error: requestError
    } = await supabaseClient
        .from("event_requests")
        .select("*")
        .order("created_at", {
            ascending: false
        });

    if (requestError) {
        console.error("Erreur chargement demandes :", requestError);
        showError("Impossible de charger les demandes d'évènements.");
        return;
    }

    allEventRequests = data || [];

    if (loading) {
        loading.classList.add("hidden");
    }

    displayEventRequests(allEventRequests);
}


/* =========================================================
   AFFICHAGE
========================================================= */

function displayEventRequests(requests) {
    const list = document.getElementById("eventRequestList");
    const empty = document.getElementById("eventRequestEmpty");
    const count = document.getElementById("eventRequestCount");

    if (!list) {
        return;
    }

    list.innerHTML = "";

    if (count) {
        count.textContent = requests.length;
    }

    if (requests.length === 0) {
        if (empty) {
            empty.classList.remove("hidden");
        }

        return;
    }

    if (empty) {
        empty.classList.add("hidden");
    }

    requests.forEach(request => {
        list.appendChild(createEventRequestCard(request));
    });
}


/* =========================================================
   CARTE
========================================================= */

function createEventRequestCard(request) {
    const card = document.createElement("article");

    card.className = "event-request-card";

    const status = String(
        request.statut || "EN ATTENTE"
    ).toUpperCase();

    const statusClass =
        status === "ACCEPTÉE"
            ? "accepted"
            : status === "REFUSÉE"
                ? "refused"
                : "pending";

    const date = request.date_event
        ? formatEventDate(request.date_event)
        : "DATE NON DÉFINIE";

    const createdDate = request.created_at
        ? formatDateTime(request.created_at)
        : "DATE INCONNUE";

    let actions = "";

    if (MANAGEMENT_ROLES.includes(currentRole)) {
        if (status === "EN ATTENTE") {
            actions += `
                <button
                    type="button"
                    class="request-action accept"
                    onclick="acceptEventRequest(${request.id})"
                >
                    ACCEPTER
                </button>

                <button
                    type="button"
                    class="request-action refuse"
                    onclick="refuseEventRequest(${request.id})"
                >
                    REFUSER
                </button>
            `;
        }

        actions += `
            <button
                type="button"
                class="request-action"
                onclick="openEditModal(${request.id})"
            >
                MODIFIER
            </button>
        `;
    }

    if (DELETE_ROLES.includes(currentRole)) {
        actions += `
            <button
                type="button"
                class="request-action delete"
                onclick="deleteEventRequest(${request.id})"
            >
                SUPPRIMER
            </button>
        `;
    }

    const description = request.description
        ? escapeHTML(request.description)
        : "Aucune description fournie.";

    const refusalReason = request.motif_refus
        ? `
            <div class="request-refusal">
                <strong>MOTIF DU REFUS</strong>
                ${escapeHTML(request.motif_refus)}
            </div>
        `
        : "";

    card.innerHTML = `
        <div class="request-card-header">

            <div class="request-card-main">

                <div class="request-code">
                    DEMANDE // REQ-${request.id}
                </div>

                <h3>
                    ${escapeHTML(request.nom || "ÉVÈNEMENT SANS NOM")}
                </h3>

            </div>

            <div class="request-date">
                ${date}
            </div>

        </div>

        <div class="request-status ${statusClass}">
            ${escapeHTML(status)}
        </div>

        <div class="request-meta">

            <div class="request-meta-item">
                <strong>RESPONSABLE :</strong>
                ${escapeHTML(request.responsable || "NON RENSEIGNÉ")}
            </div>

            <div class="request-meta-item">
                <strong>PARTICIPANTS :</strong>
                ${Number.isFinite(Number(request.participants))
                    ? Number(request.participants)
                    : 0}
            </div>

            <div class="request-meta-item">
                <strong>RÉDIGÉ PAR :</strong>
                ${escapeHTML(request.redige_par || "NON RENSEIGNÉ")}
            </div>

            <div class="request-meta-item">
                <strong>CRÉÉ LE :</strong>
                ${createdDate}
            </div>

        </div>

        <div class="request-description">
            ${description}
        </div>

        ${refusalReason}

        ${
            actions
                ? `
                    <div class="request-actions">
                        ${actions}
                    </div>
                `
                : ""
        }
    `;

    return card;
}


/* =========================================================
   RECHERCHE
========================================================= */

function searchEventRequests() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");

    const search = String(
        searchInput?.value || ""
    )
        .trim()
        .toLowerCase();

    const selectedStatus = String(
        statusFilter?.value || ""
    )
        .trim()
        .toUpperCase();

    const filtered = allEventRequests.filter(request => {
        const nom = String(
            request.nom || ""
        ).toLowerCase();

        const responsable = String(
            request.responsable || ""
        ).toLowerCase();

        const description = String(
            request.description || ""
        ).toLowerCase();

        const redigePar = String(
            request.redige_par || ""
        ).toLowerCase();

        const statut = String(
            request.statut || ""
        ).toUpperCase();

        const matchesSearch =
            !search ||
            nom.includes(search) ||
            responsable.includes(search) ||
            description.includes(search) ||
            redigePar.includes(search) ||
            statut.toLowerCase().includes(search);

        const matchesStatus =
            !selectedStatus ||
            statut === selectedStatus;

        return matchesSearch && matchesStatus;
    });

    displayEventRequests(filtered);
}


function clearEventRequestSearch() {
    const searchInput = document.getElementById("searchInput");
    const statusFilter = document.getElementById("statusFilter");

    if (searchInput) {
        searchInput.value = "";
    }

    if (statusFilter) {
        statusFilter.value = "";
    }

    displayEventRequests(allEventRequests);
}


/* =========================================================
   MODAL
========================================================= */

function setupModalEvents() {
    const modal = document.getElementById("eventRequestModal");
    const background = modal?.querySelector(".modal-background");
    const closeButton = modal?.querySelector(".modal-close");
    const cancelButton = modal?.querySelector(".cancel-button");
    const form = document.getElementById("eventRequestForm");

    if (background) {
        background.addEventListener("click", closeEventRequestModal);
    }

    if (closeButton) {
        closeButton.addEventListener(
            "click",
            closeEventRequestModal
        );
    }

    if (cancelButton) {
        cancelButton.addEventListener(
            "click",
            closeEventRequestModal
        );
    }

    if (form) {
        form.addEventListener(
            "submit",
            saveEventRequest
        );
    }

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closeEventRequestModal();
        }
    });
}


function openCreateModal() {
    if (!CREATE_ROLES.includes(currentRole)) {
        return;
    }

    editingEventRequestId = null;

    const modal = document.getElementById("eventRequestModal");
    const form = document.getElementById("eventRequestForm");

    if (!modal || !form) {
        return;
    }

    form.reset();

    document.getElementById("eventRequestId").value = "";

    document.getElementById("eventRequestStatut").value =
        "EN ATTENTE";

    document.getElementById("eventRequestParticipants").value =
        "0";

    document.getElementById("eventRequestRedigePar").value =
        "";

    clearFormError();

    const title = modal.querySelector(".modal-header h2");

    if (title) {
        title.textContent = "NOUVELLE DEMANDE";
    }

    modal.classList.remove("hidden");
}


function openEditModal(id) {
    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        return;
    }

    const request = allEventRequests.find(
        entry => Number(entry.id) === Number(id)
    );

    if (!request) {
        return;
    }

    editingEventRequestId = request.id;

    const modal = document.getElementById("eventRequestModal");

    if (!modal) {
        return;
    }

    document.getElementById("eventRequestId").value =
        request.id;

    document.getElementById("eventRequestNom").value =
        request.nom || "";

    document.getElementById("eventRequestDate").value =
        request.date_event || "";

    document.getElementById("eventRequestResponsable").value =
        request.responsable || "";

    document.getElementById("eventRequestParticipants").value =
        Number.isFinite(Number(request.participants))
            ? Number(request.participants)
            : 0;

    document.getElementById("eventRequestStatut").value =
        request.statut || "EN ATTENTE";

    document.getElementById("eventRequestDescription").value =
        request.description || "";

    document.getElementById("eventRequestMotifRefus").value =
        request.motif_refus || "";

    document.getElementById("eventRequestRedigePar").value =
        request.redige_par || "";

    clearFormError();

    const title = modal.querySelector(".modal-header h2");

    if (title) {
        title.textContent = "MODIFIER LA DEMANDE";
    }

    modal.classList.remove("hidden");
}


function closeEventRequestModal() {
    const modal = document.getElementById("eventRequestModal");

    if (!modal) {
        return;
    }

    modal.classList.add("hidden");

    editingEventRequestId = null;

    clearFormError();
}


/* =========================================================
   ENREGISTREMENT
========================================================= */

async function saveEventRequest(event) {
    event.preventDefault();

    if (!CREATE_ROLES.includes(currentRole)) {
        showFormError(
            "Votre grade ne permet pas de rédiger une demande."
        );

        return;
    }

    const nom =
        document.getElementById("eventRequestNom").value.trim();

    const dateEvent =
        document.getElementById("eventRequestDate").value || null;

    const responsable =
        document
            .getElementById("eventRequestResponsable")
            .value
            .trim() || null;

    const participantsValue =
        document
            .getElementById("eventRequestParticipants")
            .value;

    const participants =
        Math.max(
            0,
            parseInt(participantsValue, 10) || 0
        );

    const statut =
        document
            .getElementById("eventRequestStatut")
            .value;

    const description =
        document
            .getElementById("eventRequestDescription")
            .value
            .trim() || null;

    const motifRefus =
        document
            .getElementById("eventRequestMotifRefus")
            .value
            .trim() || null;

    const redigePar =
        document
            .getElementById("eventRequestRedigePar")
            .value
            .trim() || null;

    if (!nom) {
        showFormError(
            "Le nom de l'évènement est obligatoire."
        );

        return;
    }

    if (participants < 0) {
        showFormError(
            "Le nombre de participants est invalide."
        );

        return;
    }

    if (
        currentRole === "ANIMATION" &&
        editingEventRequestId !== null
    ) {
        showFormError(
            "Le grade ANIMATION ne peut pas modifier une demande existante."
        );

        return;
    }

    if (
        statut === "REFUSÉE" &&
        !motifRefus
    ) {
        showFormError(
            "Un motif de refus est obligatoire pour refuser une demande."
        );

        return;
    }

    const payload = {
        nom,
        date_event: dateEvent,
        responsable,
        participants,
        statut,
        description,
        motif_refus:
            statut === "REFUSÉE"
                ? motifRefus
                : null,
        redige_par: redigePar
    };

    const saveButton =
        document.querySelector(
            "#eventRequestForm .save-button"
        );

    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = "ENREGISTREMENT...";
    }

    try {
        let result;

        if (editingEventRequestId === null) {
            result = await supabaseClient
                .from("event_requests")
                .insert(payload);

        } else {
            if (!MANAGEMENT_ROLES.includes(currentRole)) {
                throw new Error(
                    "Autorisation insuffisante."
                );
            }

            result = await supabaseClient
                .from("event_requests")
                .update(payload)
                .eq("id", editingEventRequestId);
        }

        if (result.error) {
            throw result.error;
        }

        closeEventRequestModal();

        await loadEventRequests();

    } catch (error) {
        console.error(
            "Erreur enregistrement demande :",
            error
        );

        showFormError(
            error.message ||
            "Impossible d'enregistrer la demande."
        );

    } finally {
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = "ENREGISTRER";
        }
    }
}


/* =========================================================
   ACCEPTATION
========================================================= */

async function acceptEventRequest(id) {
    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        return;
    }

    const request = allEventRequests.find(
        entry => Number(entry.id) === Number(id)
    );

    if (!request) {
        return;
    }

    if (
        !confirm(
            `Accepter la demande « ${request.nom} » ?`
        )
    ) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("event_requests")
            .update({
                statut: "ACCEPTÉE",
                motif_refus: null
            })
            .eq("id", id);

        if (error) {
            throw error;
        }

        await loadEventRequests();

    } catch (error) {
        console.error(
            "Erreur acceptation demande :",
            error
        );

        showError(
            "Impossible d'accepter cette demande."
        );
    }
}


/* =========================================================
   REFUS
========================================================= */

async function refuseEventRequest(id) {
    if (!MANAGEMENT_ROLES.includes(currentRole)) {
        return;
    }

    const request = allEventRequests.find(
        entry => Number(entry.id) === Number(id)
    );

    if (!request) {
        return;
    }

    const motif = prompt(
        `Motif du refus pour « ${request.nom} » :`
    );

    if (motif === null) {
        return;
    }

    const cleanMotif = motif.trim();

    if (!cleanMotif) {
        showError(
            "Un motif de refus est obligatoire."
        );

        return;
    }

    try {
        const { error } = await supabaseClient
            .from("event_requests")
            .update({
                statut: "REFUSÉE",
                motif_refus: cleanMotif
            })
            .eq("id", id);

        if (error) {
            throw error;
        }

        await loadEventRequests();

    } catch (error) {
        console.error(
            "Erreur refus demande :",
            error
        );

        showError(
            "Impossible de refuser cette demande."
        );
    }
}


/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteEventRequest(id) {
    if (!DELETE_ROLES.includes(currentRole)) {
        return;
    }

    const request = allEventRequests.find(
        entry => Number(entry.id) === Number(id)
    );

    if (!request) {
        return;
    }

    if (
        !confirm(
            `Supprimer définitivement la demande « ${request.nom} » ?`
        )
    ) {
        return;
    }

    try {
        const { error } = await supabaseClient
            .from("event_requests")
            .delete()
            .eq("id", id);

        if (error) {
            throw error;
        }

        await loadEventRequests();

    } catch (error) {
        console.error(
            "Erreur suppression demande :",
            error
        );

        showError(
            "Impossible de supprimer cette demande."
        );
    }
}


/* =========================================================
   ERREURS
========================================================= */

function showError(message) {
    const errorBox =
        document.getElementById("eventRequestError");

    const errorMessage =
        document.getElementById(
            "eventRequestErrorMessage"
        );

    const loading =
        document.getElementById(
            "eventRequestLoading"
        );

    if (loading) {
        loading.classList.add("hidden");
    }

    if (error) {
        error.classList.remove("hidden");
    }

    if (errorMessage) {
        errorMessage.textContent = message;
    }
}


function showFormError(message) {
    const error =
        document.getElementById("eventRequestFormError");

    if (!error) {
        return;
    }

    error.textContent = message;
    error.classList.remove("hidden");
}


function clearFormError() {
    const error =
        document.getElementById("eventRequestFormError");

    if (!error) {
        return;
    }

    error.textContent = "";
    error.classList.add("hidden");
}


/* =========================================================
   DATES
========================================================= */

function formatEventDate(dateString) {
    if (!dateString) {
        return "DATE NON DÉFINIE";
    }

    const parts = String(dateString).split("-");

    if (parts.length !== 3) {
        return escapeHTML(dateString);
    }

    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}


function formatDateTime(dateString) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
        return "DATE INCONNUE";
    }

    return new Intl.DateTimeFormat(
        "fr-FR",
        {
            dateStyle: "short",
            timeStyle: "short"
        }
    ).format(date);
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