
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

const ALLOWED_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER MOD",
    "MANAGER ANIM",
    "ANIMATION"
];

const ADMIN_ROLE = "ADMINISTRATEUR";

let currentUser = null;
let currentStaff = null;
let currentRole = null;
let reports = [];
let isAdmin = false;

/* =========================================================
   ELEMENTS HTML
========================================================= */

const elements = {
    userName: document.getElementById("userName"),
    userRole: document.getElementById("userRole"),
    accessLabel: document.getElementById("accessLabel"),

    newReportBtn: document.getElementById("newReportBtn"),
    refreshBtn: document.getElementById("refreshBtn"),

    searchInput: document.getElementById("searchInput"),
    statusFilter: document.getElementById("statusFilter"),

    tableBody: document.getElementById("reportsTableBody"),
    emptyState: document.getElementById("emptyState"),
    resultsCount: document.getElementById("resultsCount"),

    statTotal: document.getElementById("statTotal"),
    statParticipants: document.getElementById("statParticipants"),
    statIncidents: document.getElementById("statIncidents"),

    reportModal: document.getElementById("reportModal"),
    reportForm: document.getElementById("reportForm"),
    modalTitle: document.getElementById("modalTitle"),

    reportId: document.getElementById("reportId"),
    eventName: document.getElementById("eventName"),
    eventDate: document.getElementById("eventDate"),
    eventResponsible: document.getElementById("eventResponsible"),
    eventParticipants: document.getElementById("eventParticipants"),
    eventStatus: document.getElementById("eventStatus"),
    eventSummary: document.getElementById("eventSummary"),
    eventProgress: document.getElementById("eventProgress"),
    eventIncidents: document.getElementById("eventIncidents"),
    eventComments: document.getElementById("eventComments"),

    saveReportBtn: document.getElementById("saveReportBtn"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    cancelModalBtn: document.getElementById("cancelModalBtn"),

    detailsModal: document.getElementById("detailsModal"),
    detailsTitle: document.getElementById("detailsTitle"),
    detailsContent: document.getElementById("detailsContent"),
    detailsReference: document.getElementById("detailsReference"),
    closeDetailsBtn: document.getElementById("closeDetailsBtn"),
    closeDetailsFooterBtn: document.getElementById("closeDetailsFooterBtn"),

    toastContainer: document.getElementById("toastContainer")
};

/* =========================================================
   OUTILS
========================================================= */

function showToast(message, type = "success") {
    const toast = document.createElement("div");

    toast.className = `toast ${type}`;
    toast.textContent = message;

    elements.toastContainer.appendChild(toast);

    window.setTimeout(() => {
        toast.remove();
    }, 4000);
}

function formatDate(value) {
    if (!value) return "Non renseignée";

    const date = new Date(`${value}T00:00:00`);

    if (Number.isNaN(date.getTime())) {
        return "Date invalide";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    }).format(date);
}

function formatTimestamp(value) {
    if (!value) return "Non renseignée";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "Non renseignée";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "short",
        timeStyle: "short"
    }).format(date);
}

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function createCell(value, className = "") {
    const cell = document.createElement("td");

    if (className) {
        cell.className = className;
    }

    cell.textContent =
        value === null || value === undefined || value === ""
            ? "—"
            : String(value);

    return cell;
}

function createActionButton(label, className, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `table-action ${className || ""}`.trim();
    button.textContent = label;

    button.addEventListener("click", callback);

    return button;
}

function setLoading(message = "Chargement du registre...") {
    elements.tableBody.replaceChildren();

    const row = document.createElement("tr");
    const cell = document.createElement("td");

    cell.colSpan = 6;
    cell.className = "loading-cell";
    cell.textContent = message;

    row.appendChild(cell);
    elements.tableBody.appendChild(row);

    elements.resultsCount.textContent = "Chargement...";
    elements.emptyState.hidden = true;
}

function setModalVisible(modal, visible) {
    modal.hidden = !visible;
    document.body.style.overflow = visible ? "hidden" : "";
}

function closeAllModals() {
    setModalVisible(elements.reportModal, false);
    setModalVisible(elements.detailsModal, false);
}

/* =========================================================
   AUTHENTIFICATION ET AUTORISATIONS
========================================================= */

async function initialize() {
    try {
        const { data, error } = await supabaseClient.auth.getSession();

        if (error) throw error;

        const session = data.session;

        if (!session) {
            window.location.replace("connexion.html");
            return;
        }

        currentUser = session.user;

        const { data: roleData, error: roleError } =
            await supabaseClient.rpc("current_staff_role");

        if (roleError) throw roleError;

        currentRole = roleData;

        if (!ALLOWED_ROLES.includes(currentRole)) {
            showAccessDenied();
            return;
        }

        const { data: staffData, error: staffError } =
            await supabaseClient
                .from("staff_members")
                .select("pseudo_discord,pseudo_ig,role,active")
                .eq("auth_user_id", currentUser.id)
                .eq("active", true)
                .maybeSingle();

        if (staffError) throw staffError;

        if (!staffData) {
            throw new Error(
                "Aucun profil STAFF actif n'est associé à cette session."
            );
        }

        currentStaff = staffData;
        isAdmin = currentRole === ADMIN_ROLE;

        elements.userName.textContent =
            currentStaff.pseudo_discord ||
            currentStaff.pseudo_ig ||
            "Agent STAFF";

        elements.userRole.textContent = currentRole;

        elements.accessLabel.textContent = isAdmin
            ? "ACCÈS ADMINISTRATEUR"
            : "CONSULTATION UNIQUEMENT";

        elements.newReportBtn.hidden = !isAdmin;

        setupEvents();

        await loadReports();

    } catch (error) {
        console.error("Initialisation du module :", error);

        showToast(
            error.message || "Impossible d'initialiser le module.",
            "error"
        );

        setLoading("Impossible d'initialiser le registre.");
    }
}

function showAccessDenied() {
    document.body.innerHTML = "";

    const main = document.createElement("main");
    const section = document.createElement("section");
    const title = document.createElement("h1");
    const message = document.createElement("p");
    const link = document.createElement("a");

    main.style.cssText = `
        min-height:100vh;
        display:grid;
        place-items:center;
        padding:30px;
        background:#081321;
        color:#e5edf5;
        font-family:Arial,sans-serif;
        text-align:center;
    `;

    title.textContent = "ACCÈS REFUSÉ";
    message.textContent =
        "Votre fonction ne dispose pas des autorisations nécessaires.";

    link.href = "staff.html";
    link.textContent = "Retour à l'accueil STAFF";
    link.style.color = "#79b6df";

    section.append(title, message, link);
    main.appendChild(section);
    document.body.appendChild(main);
}

/* =========================================================
   CHARGEMENT DES RAPPORTS
========================================================= */

async function loadReports() {
    setLoading();

    try {
        const { data, error } = await supabaseClient
            .from("event_reports")
            .select("*")
            .order("date_event", {
                ascending: false,
                nullsFirst: false
            })
            .order("created_at", {
                ascending: false
            });

        if (error) throw error;

        reports = data || [];

        updateStatistics();
        renderReports();

    } catch (error) {
        console.error("Chargement des rapports :", error);

        setLoading("Erreur lors du chargement des rapports.");

        showToast(
            error.message || "Impossible de récupérer les rapports.",
            "error"
        );
    }
}

/* =========================================================
   STATISTIQUES
========================================================= */

function updateStatistics() {
    const total = reports.length;

    const participants = reports.reduce((sum, report) => {
        return sum + (Number(report.participants) || 0);
    }, 0);

    const incidents = reports.filter(report => {
        const value = normalizeText(report.incidents);

        return value.length > 0
            && value !== "aucun"
            && value !== "aucun incident"
            && value !== "aucun incident signale";
    }).length;

    elements.statTotal.textContent = total;
    elements.statParticipants.textContent = participants;
    elements.statIncidents.textContent = incidents;
}

/* =========================================================
   RECHERCHE ET FILTRES
========================================================= */

function getFilteredReports() {
    const search = normalizeText(elements.searchInput.value);
    const selectedStatus = normalizeText(elements.statusFilter.value);

    return reports.filter(report => {
        const searchableContent = [
            report.nom,
            report.responsable,
            report.resume,
            report.deroulement,
            report.incidents,
            report.commentaires,
            report.statut,
            report.id
        ].map(normalizeText).join(" ");

        const matchesSearch =
            !search || searchableContent.includes(search);

        const matchesStatus =
            !selectedStatus ||
            normalizeText(report.statut) === selectedStatus;

        return matchesSearch && matchesStatus;
    });
}

function getStatusClass(status) {
    const normalized = normalizeText(status);

    if (normalized === "termine") return "termine";
    if (normalized === "en cours") return "en-cours";
    if (normalized === "annule") return "annule";

    return "";
}

/* =========================================================
   AFFICHAGE DU TABLEAU
========================================================= */

function renderReports() {
    const filteredReports = getFilteredReports();

    elements.tableBody.replaceChildren();

    elements.emptyState.hidden = filteredReports.length > 0;

    if (filteredReports.length === 0) {
        elements.resultsCount.textContent = "0 rapport affiché";
        return;
    }

    filteredReports.forEach(report => {
        const row = document.createElement("tr");

        const nameCell = document.createElement("td");

        const name = document.createElement("span");
        name.className = "event-name";
        name.textContent = report.nom || "Évènement sans nom";

        const reference = document.createElement("span");
        reference.className = "event-id";
        reference.textContent = `RAPPORT #${report.id}`;

        nameCell.append(name, reference);

        const dateCell = createCell(formatDate(report.date_event));
        const responsibleCell = createCell(report.responsable);
        const participantsCell = createCell(
            Number(report.participants) || 0
        );

        const statusCell = document.createElement("td");
        const statusPill = document.createElement("span");

        statusPill.className =
            `status-pill ${getStatusClass(report.statut)}`;

        statusPill.textContent = report.statut || "Non renseigné";

        statusCell.appendChild(statusPill);

        const actionsCell = document.createElement("td");
        const actions = document.createElement("div");

        actions.className = "row-actions";

        actions.appendChild(
            createActionButton("Consulter", "", () => {
                openDetails(report);
            })
        );

        if (isAdmin) {
            actions.appendChild(
                createActionButton("Modifier", "", () => {
                    openEditModal(report);
                })
            );

            actions.appendChild(
                createActionButton("Supprimer", "danger", () => {
                    deleteReport(report);
                })
            );
        }

        actionsCell.appendChild(actions);

        row.append(
            nameCell,
            dateCell,
            responsibleCell,
            participantsCell,
            statusCell,
            actionsCell
        );

        elements.tableBody.appendChild(row);
    });

    elements.resultsCount.textContent =
        `${filteredReports.length} rapport(s) affiché(s) sur ${reports.length}`;
}

/* =========================================================
   FICHE DÉTAILLÉE
========================================================= */

function createDetailSection(title, content) {
    const section = document.createElement("section");
    const heading = document.createElement("h3");
    const paragraph = document.createElement("p");

    section.className = "detail-section";

    heading.textContent = title;
    paragraph.textContent =
        content || "Aucune information renseignée.";

    section.append(heading, paragraph);

    return section;
}

function createMetaItem(label, value) {
    const item = document.createElement("div");
    const title = document.createElement("span");
    const content = document.createElement("strong");

    item.className = "detail-meta-item";

    title.textContent = label;
    content.textContent = value || "Non renseigné";

    item.append(title, content);

    return item;
}

function openDetails(report) {
    elements.detailsTitle.textContent =
        report.nom || "Fiche de compte rendu";

    elements.detailsContent.replaceChildren();

    const metadata = document.createElement("div");
    metadata.className = "detail-meta";

    metadata.append(
        createMetaItem(
            "Date de l'évènement",
            formatDate(report.date_event)
        ),
        createMetaItem(
            "Responsable",
            report.responsable
        ),
        createMetaItem(
            "Participants",
            String(Number(report.participants) || 0)
        ),
        createMetaItem(
            "Statut",
            report.statut
        ),
        createMetaItem(
            "Date d'enregistrement",
            formatTimestamp(report.created_at)
        )
    );

    elements.detailsContent.appendChild(metadata);

    elements.detailsContent.append(
        createDetailSection("Résumé", report.resume),
        createDetailSection("Déroulement", report.deroulement),
        createDetailSection("Incidents signalés", report.incidents),
        createDetailSection(
            "Commentaires complémentaires",
            report.commentaires
        )
    );

    elements.detailsReference.textContent =
        `RÉFÉRENCE : RAPPORT #${report.id}`;

    setModalVisible(elements.detailsModal, true);
}

/* =========================================================
   CRÉATION D'UN RAPPORT
========================================================= */

function openCreateModal() {
    if (!isAdmin) return;

    elements.reportForm.reset();

    elements.reportId.value = "";
    elements.eventParticipants.value = "0";
    elements.eventStatus.value = "TERMINE";

    elements.eventResponsible.value =
        currentStaff?.pseudo_discord ||
        currentStaff?.pseudo_ig ||
        "";

    elements.modalTitle.textContent = "Nouveau rapport";
    elements.saveReportBtn.textContent = "Enregistrer le rapport";

    setModalVisible(elements.reportModal, true);
}

/* =========================================================
   MODIFICATION D'UN RAPPORT
========================================================= */

function openEditModal(report) {
    if (!isAdmin) return;

    elements.reportForm.reset();

    elements.reportId.value = report.id;
    elements.eventName.value = report.nom || "";
    elements.eventDate.value = report.date_event || "";
    elements.eventResponsible.value = report.responsable || "";
    elements.eventParticipants.value = Number(report.participants) || 0;
    elements.eventStatus.value = report.statut || "TERMINE";
    elements.eventSummary.value = report.resume || "";
    elements.eventProgress.value = report.deroulement || "";
    elements.eventIncidents.value = report.incidents || "";
    elements.eventComments.value = report.commentaires || "";

    elements.modalTitle.textContent = "Modifier le rapport";
    elements.saveReportBtn.textContent = "Enregistrer les modifications";

    setModalVisible(elements.reportModal, true);
}

function closeReportModal() {
    setModalVisible(elements.reportModal, false);
    elements.reportForm.reset();
}



async function saveReport(event) {
    event.preventDefault();

    if (!isAdmin) {
        showToast(
            "Vous ne disposez pas des droits nécessaires.",
            "error"
        );
        return;
    }

    const reportId = elements.reportId.value;

    const nom = elements.eventName.value.trim();
    const responsable = elements.eventResponsible.value.trim();
    const participants = Number(elements.eventParticipants.value);

    if (!nom || !responsable) {
        showToast(
            "Le nom et le responsable sont obligatoires.",
            "error"
        );
        return;
    }

    if (!Number.isInteger(participants) || participants < 0) {
        showToast(
            "Le nombre de participants est invalide.",
            "error"
        );
        return;
    }

    const payload = {
        nom: nom,
        date_event: elements.eventDate.value || null,
        responsable: responsable,
        participants: participants,
        statut: elements.eventStatus.value,
        resume: elements.eventSummary.value.trim() || null,
        deroulement: elements.eventProgress.value.trim() || null,
        incidents: elements.eventIncidents.value.trim() || null,
        commentaires: elements.eventComments.value.trim() || null
    };

    elements.saveReportBtn.disabled = true;
    elements.saveReportBtn.textContent = "Enregistrement...";

    try {
        let result;

        if (reportId) {
            result = await supabaseClient
                .from("event_reports")
                .update(payload)
                .eq("id", Number(reportId))
                .select()
                .single();
        } else {
            result = await supabaseClient
                .from("event_reports")
                .insert(payload)
                .select()
                .single();
        }

        if (result.error) throw result.error;

        closeReportModal();

        showToast(
            reportId
                ? "Le rapport a été modifié."
                : "Le rapport a été enregistré.",
            "success"
        );

        await loadReports();

    } catch (error) {
        console.error("Enregistrement du rapport :", error);

        showToast(
            error.message || "Impossible d'enregistrer le rapport.",
            "error"
        );

    } finally {
        elements.saveReportBtn.disabled = false;

        elements.saveReportBtn.textContent = reportId
            ? "Enregistrer les modifications"
            : "Enregistrer le rapport";
    }
}


/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteReport(report) {
    if (!isAdmin) return;

    const confirmed = window.confirm(
        `Confirmer la suppression du rapport "${report.nom}" (#${report.id}) ?\n\nCette action est définitive.`
    );

    if (!confirmed) return;

    try {
        const { error } = await supabaseClient
            .from("event_reports")
            .delete()
            .eq("id", report.id);

        if (error) throw error;

        showToast("Le rapport a été supprimé.", "success");

        await loadReports();

    } catch (error) {
        console.error("Suppression du rapport :", error);

        showToast(
            error.message || "Impossible de supprimer le rapport.",
            "error"
        );
    }
}

/* =========================================================
   FERMETURE DES MODALES
========================================================= */

function closeDetailsModal() {
    setModalVisible(elements.detailsModal, false);
}

function handleEscape(event) {
    if (event.key !== "Escape") return;

    if (!elements.reportModal.hidden) {
        closeReportModal();
    }

    if (!elements.detailsModal.hidden) {
        closeDetailsModal();
    }
}

/* =========================================================
   ÉVÈNEMENTS
========================================================= */

function setupEvents() {
    elements.newReportBtn.addEventListener(
        "click",
        openCreateModal
    );

    elements.refreshBtn.addEventListener(
        "click",
        loadReports
    );

    elements.searchInput.addEventListener(
        "input",
        renderReports
    );

    elements.statusFilter.addEventListener(
        "change",
        renderReports
    );

    elements.reportForm.addEventListener(
        "submit",
        saveReport
    );

    elements.closeModalBtn.addEventListener(
        "click",
        closeReportModal
    );

    elements.cancelModalBtn.addEventListener(
        "click",
        closeReportModal
    );

    elements.closeDetailsBtn.addEventListener(
        "click",
        closeDetailsModal
    );

    elements.closeDetailsFooterBtn.addEventListener(
        "click",
        closeDetailsModal
    );

    elements.reportModal.addEventListener("click", event => {
        if (event.target === elements.reportModal) {
            closeReportModal();
        }
    });

    elements.detailsModal.addEventListener("click", event => {
        if (event.target === elements.detailsModal) {
            closeDetailsModal();
        }
    });

    document.addEventListener("keydown", handleEscape);
}

/* =========================================================
   SURVEILLANCE DE SESSION
========================================================= */

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "SIGNED_OUT" || !session) {
        window.location.replace("connexion.html");
    }
});

/* =========================================================
   DÉMARRAGE
========================================================= */

initialize();
