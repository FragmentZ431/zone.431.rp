const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";

const SUPABASE_KEY =
    "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );


let currentRole = null;
let allEventReports = [];
let editingEventReportId = null;


const CREATE_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER ANIM",
    "ANIMATION"
];


const EDIT_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER ANIM"
];


const DELETE_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER ANIM"
];


const READ_ROLES = [
    "ADMINISTRATEUR",
    "MANAGER ANIM",
    "MANAGER MOD",
    "ANIMATION",
    "MODÉRATION"
];


document.addEventListener(
    "DOMContentLoaded",
    initializeEventReports
);


async function initializeEventReports() {

    try {

        await ensureAuthentication();

        await loadStaffRole();

        updateAccessInterface();

        if (!READ_ROLES.includes(currentRole)) {
            showAccessDenied();
            return;
        }

        await loadEventReports();

        setupModalEvents();

    } catch (error) {

        console.error(
            "Erreur initialisation rapports évènements :",
            error
        );

        showError(
            "Impossible d'initialiser le registre."
        );

    }

}


async function ensureAuthentication() {

    const {
        data: sessionData,
        error: sessionError
    } = await supabaseClient.auth.getSession();


    if (sessionError) {
        throw sessionError;
    }


    if (sessionData.session) {
        return sessionData.session;
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


async function loadStaffRole() {

    const {
        data,
        error
    } = await supabaseClient.rpc(
        "current_staff_role"
    );


    if (error) {
        throw error;
    }


    currentRole = data || null;

}


function updateAccessInterface() {

    const accessStatus =
        document.getElementById("accessStatus");

    const accessDescription =
        document.getElementById("accessDescription");

    const accessRole =
        document.getElementById("accessRole");

    const createButton =
        document.getElementById(
            "createEventReportButton"
        );


    if (!currentRole) {

        accessStatus.textContent =
            "ACCÈS REFUSÉ";

        accessDescription.textContent =
            "Aucun rôle staff actif n'a été détecté.";

        accessRole.textContent =
            "NO ACCESS";

        createButton.classList.add(
            "hidden"
        );

        return;

    }


    accessStatus.textContent =
        "ACCÈS AUTORISÉ";

    accessDescription.textContent =
        "Niveau d'autorisation reconnu.";

    accessRole.textContent =
        currentRole;


    if (CREATE_ROLES.includes(currentRole)) {

        createButton.classList.remove(
            "hidden"
        );

        createButton.onclick =
            () => openCreateEventReportModal();

    } else {

        createButton.classList.add(
            "hidden"
        );

    }

}


function showAccessDenied() {

    const list =
        document.getElementById(
            "eventReportList"
        );

    const loading =
        document.getElementById(
            "eventReportLoading"
        );

    const empty =
        document.getElementById(
            "eventReportEmpty"
        );


    loading.classList.add("hidden");

    empty.classList.add("hidden");

    list.innerHTML = `
        <div class="error-state">
            <strong>ACCÈS REFUSÉ</strong>
            <span>
                Votre grade ne dispose pas des autorisations nécessaires pour consulter les rapports d'évènements.
            </span>
        </div>
    `;

}


async function loadEventReports() {

    const loading =
        document.getElementById(
            "eventReportLoading"
        );

    const errorBox =
        document.getElementById(
            "eventReportError"
        );

    const empty =
        document.getElementById(
            "eventReportEmpty"
        );


    loading.classList.remove("hidden");
    errorBox.classList.add("hidden");
    empty.classList.add("hidden");


    const {
        data,
        error
    } = await supabaseClient
        .from("event_reports")
        .select("*")
        .order(
            "date_event",
            {
                ascending: false,
                nullsFirst: false
            }
        );


    loading.classList.add("hidden");


    if (error) {

        console.error(
            "Erreur chargement rapports :",
            error
        );

        showError(
            "Impossible de récupérer les rapports."
        );

        return;
    }


    allEventReports = data || [];

    displayEventReports(
        allEventReports
    );

}


function displayEventReports(
    reports
) {

    const list =
        document.getElementById(
            "eventReportList"
        );

    const empty =
        document.getElementById(
            "eventReportEmpty"
        );

    const count =
        document.getElementById(
            "eventReportCount"
        );


    list.innerHTML = "";

    count.textContent =
        reports.length;


    if (!reports.length) {

        empty.classList.remove(
            "hidden"
        );

        return;

    }


    empty.classList.add(
        "hidden"
    );


    reports.forEach(
        report => {

            list.appendChild(
                createEventReportCard(
                    report
                )
            );

        }
    );

}


function createEventReportCard(
    report
) {

    const card =
        document.createElement(
            "article"
        );

    card.className =
        "event-report-card";


    const date =
        formatDate(
            report.date_event
        );


    const status =
        report.statut ||
        "TERMINE";


    const participants =
        Number.isFinite(
            Number(report.participants)
        )
            ? Number(report.participants)
            : 0;


    let actions = "";


    if (
        EDIT_ROLES.includes(
            currentRole
        )
    ) {

        actions += `
            <button
                type="button"
                class="report-action"
                onclick="editEventReport(${report.id})"
            >
                MODIFIER
            </button>
        `;

    }


    if (
        DELETE_ROLES.includes(
            currentRole
        )
    ) {

        actions += `
            <button
                type="button"
                class="report-action delete"
                onclick="deleteEventReport(${report.id})"
            >
                SUPPRIMER
            </button>
        `;

    }


    const resume =
        report.resume ||
        "Aucun résumé renseigné.";


    card.innerHTML = `
        <div class="report-card-header">

            <div class="report-card-main">

                <span class="report-code">
                    RAPPORT #${report.id}
                </span>

                <h3>
                    ${escapeHTML(
                        report.nom ||
                        "Évènement sans nom"
                    )}
                </h3>

            </div>

            <span class="report-date">
                ${date}
            </span>

        </div>


        <div class="report-meta">

            <span class="report-meta-item">
                <strong>RESPONSABLE :</strong>
                ${escapeHTML(
                    report.responsable ||
                    "NON RENSEIGNÉ"
                )}
            </span>

            <span class="report-meta-item">
                <strong>PARTICIPANTS :</strong>
                ${participants}
            </span>

        </div>


        <span class="report-status">
            ${escapeHTML(status)}
        </span>


        <div class="report-resume">
            ${escapeHTML(resume)}
        </div>


        ${
            actions
                ? `
                    <div class="report-actions">
                        ${actions}
                    </div>
                `
                : ""
        }
    `;


    return card;

}


function searchEventReports() {

    const input =
        document.getElementById(
            "searchInput"
        );


    const search =
        String(
            input.value || ""
        )
        .trim()
        .toLowerCase();


    if (!search) {

        displayEventReports(
            allEventReports
        );

        return;

    }


    const filtered =
        allEventReports.filter(
            report => {

                const values = [

                    report.nom,
                    report.responsable,
                    report.resume,
                    report.deroulement,
                    report.incidents,
                    report.commentaires,
                    report.statut

                ];


                return values.some(
                    value =>
                        String(
                            value || ""
                        )
                        .toLowerCase()
                        .includes(search)
                );

            }
        );


    displayEventReports(
        filtered
    );

}


function clearEventReportSearch() {

    const input =
        document.getElementById(
            "searchInput"
        );

    input.value = "";

    displayEventReports(
        allEventReports
    );

}


function setupModalEvents() {

    const form =
        document.getElementById(
            "eventReportForm"
        );


    form.addEventListener(
        "submit",
        saveEventReport
    );


    const modal =
        document.getElementById(
            "eventReportModal"
        );


    modal.addEventListener(
        "click",
        event => {

            if (
                event.target === modal
            ) {
                closeEventReportModal();
            }

        }
    );


    const search =
        document.getElementById(
            "searchInput"
        );


    search.addEventListener(
        "input",
        searchEventReports
    );


    document.addEventListener(
        "keydown",
        event => {

            if (
                event.key === "Escape"
            ) {

                closeEventReportModal();

            }

        }
    );

}


function openCreateEventReportModal() {

    if (
        !CREATE_ROLES.includes(
            currentRole
        )
    ) {
        return;
    }


    editingEventReportId = null;


    document.getElementById(
        "eventReportModalTitle"
    ).textContent =
        "NOUVEAU RAPPORT";


    document.getElementById(
        "eventReportForm"
    ).reset();


    document.getElementById(
        "eventReportId"
    ).value = "";


    document.getElementById(
        "eventReportParticipants"
    ).value = "0";


    document.getElementById(
        "eventReportStatut"
    ).value =
        "TERMINE";


    document.getElementById(
        "eventReportModal"
    ).classList.remove(
        "hidden"
    );

}


function closeEventReportModal() {

    document.getElementById(
        "eventReportModal"
    ).classList.add(
        "hidden"
    );

    document.getElementById(
        "eventReportFormError"
    ).classList.add(
        "hidden"
    );

}


function editEventReport(
    id
) {

    if (
        !EDIT_ROLES.includes(
            currentRole
        )
    ) {
        return;
    }


    const report =
        allEventReports.find(
            entry =>
                Number(entry.id) ===
                Number(id)
        );


    if (!report) {
        return;
    }


    editingEventReportId =
        report.id;


    document.getElementById(
        "eventReportModalTitle"
    ).textContent =
        "MODIFIER LE RAPPORT";


    document.getElementById(
        "eventReportId"
    ).value =
        report.id;


    document.getElementById(
        "eventReportNom"
    ).value =
        report.nom || "";


    document.getElementById(
        "eventReportDate"
    ).value =
        report.date_event || "";


    document.getElementById(
        "eventReportResponsable"
    ).value =
        report.responsable || "";


    document.getElementById(
        "eventReportParticipants"
    ).value =
        Number(report.participants) || 0;


    document.getElementById(
        "eventReportStatut"
    ).value =
        report.statut || "TERMINE";


    document.getElementById(
        "eventReportResume"
    ).value =
        report.resume || "";


    document.getElementById(
        "eventReportDeroulement"
    ).value =
        report.deroulement || "";


    document.getElementById(
        "eventReportIncidents"
    ).value =
        report.incidents || "";


    document.getElementById(
        "eventReportCommentaires"
    ).value =
        report.commentaires || "";


    document.getElementById(
        "eventReportModal"
    ).classList.remove(
        "hidden"
    );

}


async function saveEventReport(
    event
) {

    event.preventDefault();


    if (
        editingEventReportId &&
        !EDIT_ROLES.includes(
            currentRole
        )
    ) {
        showFormError(
            "Vous n'avez pas l'autorisation de modifier ce rapport."
        );

        return;
    }


    if (
        !editingEventReportId &&
        !CREATE_ROLES.includes(
            currentRole
        )
    ) {
        showFormError(
            "Vous n'avez pas l'autorisation de créer un rapport."
        );

        return;
    }


    const nom =
        document.getElementById(
            "eventReportNom"
        ).value.trim();


    if (!nom) {

        showFormError(
            "Le nom de l'évènement est obligatoire."
        );

        return;

    }


    const participants =
        Math.max(
            0,
            Math.min(
                9999,
                Number(
                    document.getElementById(
                        "eventReportParticipants"
                    ).value
                ) || 0
            )
        );


    const payload = {

        nom,

        date_event:
            document.getElementById(
                "eventReportDate"
            ).value || null,

        responsable:
            document.getElementById(
                "eventReportResponsable"
            ).value.trim() || null,

        participants,

        resume:
            document.getElementById(
                "eventReportResume"
            ).value.trim() || null,

        deroulement:
            document.getElementById(
                "eventReportDeroulement"
            ).value.trim() || null,

        incidents:
            document.getElementById(
                "eventReportIncidents"
            ).value.trim() || null,

        commentaires:
            document.getElementById(
                "eventReportCommentaires"
            ).value.trim() || null,

        statut:
            document.getElementById(
                "eventReportStatut"
            ).value || "TERMINE"

    };


    let result;


    if (editingEventReportId) {

        result =
            await supabaseClient
                .from("event_reports")
                .update(payload)
                .eq(
                    "id",
                    editingEventReportId
                );

    } else {

        result =
            await supabaseClient
                .from("event_reports")
                .insert(
                    payload
                );

    }


    if (result.error) {

        console.error(
            "Erreur sauvegarde rapport :",
            result.error
        );

        showFormError(
            "Impossible d'enregistrer le rapport."
        );

        return;

    }


    closeEventReportModal();

    await loadEventReports();

}


async function deleteEventReport(
    id
) {

    if (
        !DELETE_ROLES.includes(
            currentRole
        )
    ) {
        return;
    }


    const confirmed =
        window.confirm(
            "Supprimer définitivement ce rapport d'évènement ?"
        );


    if (!confirmed) {
        return;
    }


    const {
        error
    } = await supabaseClient
        .from("event_reports")
        .delete()
        .eq(
            "id",
            id
        );


    if (error) {

        console.error(
            "Erreur suppression rapport :",
            error
        );

        showError(
            "Impossible de supprimer le rapport."
        );

        return;

    }


    await loadEventReports();

}


function showFormError(
    message
) {

    const box =
        document.getElementById(
            "eventReportFormError"
        );


    box.textContent =
        message;


    box.classList.remove(
        "hidden"
    );

}


function showError(
    message
) {

    const box =
        document.getElementById(
            "eventReportError"
        );

    const messageBox =
        document.getElementById(
            "eventReportErrorMessage"
        );


    messageBox.textContent =
        message;


    box.classList.remove(
        "hidden"
    );

}


function formatDate(
    value
) {

    if (!value) {
        return "DATE NON RENSEIGNÉE";
    }


    const date =
        new Date(
            value + (
                /^\d{4}-\d{2}-\d{2}$/.test(
                    value
                )
                    ? "T00:00:00"
                    : ""
            )
        );


    if (
        Number.isNaN(
            date.getTime()
        )
    ) {
        return "DATE INVALIDE";
    }


    return new Intl.DateTimeFormat(
        "fr-FR",
        {
            day: "2-digit",
            month: "2-digit",
            year: "numeric"
        }
    ).format(date);

}


function escapeHTML(
    value
) {

    return String(
        value ?? ""
    )
    .replaceAll(
        "&",
        "&amp;"
    )
    .replaceAll(
        "<",
        "&lt;"
    )
    .replaceAll(
        ">",
        "&gt;"
    )
    .replaceAll(
        '"',
        "&quot;"
    )
    .replaceAll(
        "'",
        "&#039;"
    );

}