
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

const ADMIN_ROLE = "ADMINISTRATEUR";
const DEPARTMENT_PERMISSION = "department_documents.manage";

let currentUser = null;
let currentStaff = null;
let currentRole = null;

let documents = [];
let departments = [];
let assignedDepartments = [];
let manageableDepartments = [];

let isAdmin = false;
let canManageDocuments = false;
let currentDetailsDocument = null;

/* =========================================================
   ELEMENTS HTML
========================================================= */

const elements = {
    userName: document.getElementById("userName"),
    accessLabel: document.getElementById("accessLabel"),

    newDocumentBtn: document.getElementById("newDocumentBtn"),
    refreshBtn: document.getElementById("refreshBtn"),
    notificationSettingsBtn: document.getElementById("notificationSettingsBtn"),
    notificationSettingsModal: document.getElementById("notificationSettingsModal"),
    notificationSettingsForm: document.getElementById("notificationSettingsForm"),
    closeNotificationSettingsBtn: document.getElementById("closeNotificationSettingsBtn"),
    cancelNotificationSettingsBtn: document.getElementById("cancelNotificationSettingsBtn"),
    saveNotificationSettingsBtn: document.getElementById("saveNotificationSettingsBtn"),

    searchInput: document.getElementById("searchInput"),
    categoryFilter: document.getElementById("categoryFilter"),
    statusFilter: document.getElementById("statusFilter"),

    documentsGrid: document.getElementById("documentsGrid"),
    emptyState: document.getElementById("emptyState"),
    resultsCount: document.getElementById("resultsCount"),

    statTotal: document.getElementById("statTotal"),
    statPublished: document.getElementById("statPublished"),
    statDrafts: document.getElementById("statDrafts"),
    statLastUpdate: document.getElementById("statLastUpdate"),

    documentModal: document.getElementById("documentModal"),
    documentForm: document.getElementById("documentForm"),
    modalTitle: document.getElementById("modalTitle"),

    documentId: document.getElementById("documentId"),
    documentTitle: document.getElementById("documentTitle"),
    documentCategory: document.getElementById("documentCategory"),
    documentOrder: document.getElementById("documentOrder"),
    documentSummary: document.getElementById("documentSummary"),
    documentContent: document.getElementById("documentContent"),
    documentAccreditation: document.getElementById("documentAccreditation"),
    documentGlobal: document.getElementById("documentGlobal"),
    documentPublished: document.getElementById("documentPublished"),

    globalVisibilityWrapper: document.getElementById("globalVisibilityWrapper"),
    departmentHelp: document.getElementById("departmentHelp"),
    departmentChoices: document.getElementById("departmentChoices"),

    saveDocumentBtn: document.getElementById("saveDocumentBtn"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    cancelModalBtn: document.getElementById("cancelModalBtn"),

    detailsModal: document.getElementById("detailsModal"),
    detailsTitle: document.getElementById("detailsTitle"),
    detailsCategory: document.getElementById("detailsCategory"),
    detailsStatus: document.getElementById("detailsStatus"),
    detailsUpdated: document.getElementById("detailsUpdated"),
    detailsAccreditation: document.getElementById("detailsAccreditation"),
    detailsSummary: document.getElementById("detailsSummary"),
    detailsDepartments: document.getElementById("detailsDepartments"),
    detailsContent: document.getElementById("detailsContent"),

    copyDetailsBtn: document.getElementById("copyDetailsBtn"),
    editDetailsBtn: document.getElementById("editDetailsBtn"),
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

function normalizeText(value) {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
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

function formatShortDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
        return "—";
    }

    return new Intl.DateTimeFormat("fr-FR", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    }).format(date);
}

function getDocumentDate(doc) {
    return doc.updated_at || doc.created_at;
}

function setModalVisible(modal, visible) {
    modal.hidden = !visible;
    document.body.style.overflow = visible ? "hidden" : "";
}

function slugify(value) {
    return normalizeText(value)
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

function createActionButton(label, className, callback) {
    const button = document.createElement("button");

    button.type = "button";
    button.className = `table-action ${className || ""}`.trim();
    button.textContent = label;

    button.addEventListener("click", callback);

    return button;
}

function getDepartmentCodes(doc) {
    return (doc.departments || [])
        .map(item => item.department_code)
        .filter(Boolean);
}

function isDocumentManageable(doc) {
    if (isAdmin) return true;

    if (doc.is_global) return false;

    const codes = getDepartmentCodes(doc);

    return codes.length > 0 &&
        codes.every(code => manageableDepartments.includes(code));
}

/* =========================================================
   AUTHENTIFICATION
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

        const { data: access, error: accessError } = await supabaseClient.rpc(
            "has_staff_module_permission",
            { p_module_code: "documentation", p_action: "access" }
        );

        if (accessError) throw accessError;

        if (access !== true) {
            showAccessDenied();
            return;
        }

        const { data: roleData } = await supabaseClient.rpc("current_staff_role");
        currentRole = roleData || "ACCÈS INDIVIDUEL";
        isAdmin = currentRole === ADMIN_ROLE;

        const { data: staffData } = await supabaseClient
            .from("staff_members")
            .select("pseudo_discord,pseudo_ig,role,active")
            .eq("auth_user_id", currentUser.id)
            .eq("active", true)
            .maybeSingle();

        currentStaff = staffData || {};

        if (elements.userName) {
            elements.userName.textContent =
                currentStaff.pseudo_discord ||
                currentStaff.pseudo_ig ||
                currentUser.user_metadata?.discord ||
                currentUser.email ||
                "Agent autorisé";
        }

        await loadDepartments();

        canManageDocuments =
            isAdmin ||
            manageableDepartments.length > 0;

        elements.accessLabel.textContent = isAdmin
            ? "ACCÈS ADMINISTRATEUR"
            : canManageDocuments
                ? "GESTION AUTORISÉE"
                : "CONSULTATION UNIQUEMENT";

        elements.newDocumentBtn.hidden = !canManageDocuments;
        elements.notificationSettingsBtn.hidden = !isAdmin;

        setupEvents();
        await loadDocuments();

    } catch (error) {
        console.error("Initialisation du module Documentation :", error);

        showToast(
            error.message || "Impossible d'initialiser le module.",
            "error"
        );

        setLoading("Impossible d'initialiser la documentation.");
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
        background:#080e17;
        color:#e5edf5;
        font-family:Arial,sans-serif;
        text-align:center;
    `;

    title.textContent = "ACCÈS REFUSÉ";

    message.textContent =
        "Votre compte ne dispose pas d'un accès STAFF actif.";

    link.href = "staff.html";
    link.textContent = "Retour à l'accueil STAFF";
    link.style.color = "#72b5df";

    section.append(title, message, link);
    main.appendChild(section);
    document.body.appendChild(main);
}

/* =========================================================
   DÉPARTEMENTS ET AUTORISATIONS
========================================================= */

async function loadDepartments() {
    const { data, error } = await supabaseClient
        .from("rp_departments")
        .select("code")
        .order("code", { ascending: true });

    if (error) throw error;

    departments = data || [];

    if (isAdmin) {
        assignedDepartments = departments.map(item => item.code);
        manageableDepartments = departments.map(item => item.code);
        return;
    }

    const { data: assignments, error: assignmentsError } = await supabaseClient
        .from("rp_member_department_assignments")
        .select("department_code,assignment_type")
        .eq("user_id", currentUser.id)
        .in("assignment_type", ["primary", "additional"]);

    if (assignmentsError) throw assignmentsError;

    const knownDepartmentCodes = new Set(
        departments.map(item => item.code)
    );

    assignedDepartments = [...new Set(
        (assignments || [])
            .map(item => item.department_code)
            .filter(code => code && knownDepartmentCodes.has(code))
    )];

    const permissions = await Promise.all(
        assignedDepartments.map(async code => {
            const { data: allowed, error: permissionError } =
                await supabaseClient.rpc("has_rp_permission", {
                    p_permission_code: DEPARTMENT_PERMISSION,
                    p_department_code: code
                });

            if (permissionError) {
                console.error(
                    `Vérification de la permission ${code} :`,
                    permissionError
                );

                return { code, allowed: false };
            }

            return {
                code,
                allowed: allowed === true
            };
        })
    );

    manageableDepartments = permissions
        .filter(item => item.allowed)
        .map(item => item.code);
}

/* =========================================================
   CHARGEMENT DES DOCUMENTS
========================================================= */

async function loadDocuments() {
    setLoading();

    try {
        const { data, error } = await supabaseClient
            .from("member_documents")
            .select(`
                id,
                title,
                slug,
                category,
                summary,
                content,
                sort_order,
                is_published,
                created_by,
                updated_by,
                created_at,
                updated_at,
                is_global,
                required_accreditation
            `)
            .order("sort_order", { ascending: true })
            .order("updated_at", { ascending: false });

        if (error) throw error;

        documents = data || [];

        if (documents.length > 0) {
            const ids = documents.map(doc => doc.id);

            const { data: links, error: linksError } =
                await supabaseClient
                    .from("member_document_departments")
                    .select("document_id,department_code")
                    .in("document_id", ids);

            if (linksError) throw linksError;

            const linksByDocument = new Map();

            (links || []).forEach(link => {
                if (!linksByDocument.has(link.document_id)) {
                    linksByDocument.set(link.document_id, []);
                }

                linksByDocument
                    .get(link.document_id)
                    .push(link);
            });

            documents = documents.map(doc => ({
                ...doc,
                departments: linksByDocument.get(doc.id) || []
            }));
        }

        updateCategoryFilter();
        updateStatistics();
        renderDocuments();

    } catch (error) {
        console.error("Chargement des documents :", error);

        setLoading("Erreur lors du chargement du registre.");

        showToast(
            error.message || "Impossible de récupérer les documents.",
            "error"
        );
    }
}

function setLoading(message = "Chargement de la documentation...") {
    elements.documentsGrid.replaceChildren();

    const container = document.createElement("div");
    const indicator = document.createElement("span");
    const paragraph = document.createElement("p");

    container.className = "loading-state";
    indicator.className = "loading-indicator";
    paragraph.textContent = message;

    container.append(indicator, paragraph);
    elements.documentsGrid.appendChild(container);

    elements.resultsCount.textContent = "Chargement...";
    elements.emptyState.hidden = true;
}

/* =========================================================
   STATISTIQUES
========================================================= */

function updateStatistics() {
    elements.statTotal.textContent = documents.length;

    const published = documents.filter(
        doc => doc.is_published
    ).length;

    elements.statPublished.textContent = published;
    elements.statDrafts.textContent = documents.length - published;

    if (documents.length === 0) {
        elements.statLastUpdate.textContent = "—";
        return;
    }

    const latest = [...documents].sort((a, b) => {
        return new Date(getDocumentDate(b)) -
            new Date(getDocumentDate(a));
    })[0];

    elements.statLastUpdate.textContent =
        formatShortDate(getDocumentDate(latest));
}

/* =========================================================
   FILTRES
========================================================= */

function updateCategoryFilter() {
    const selected = elements.categoryFilter.value;

    const categories = [
        ...new Set(
            documents
                .map(doc => doc.category)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b, "fr"));

    elements.categoryFilter.replaceChildren();

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = "Toutes les catégories";

    elements.categoryFilter.appendChild(defaultOption);

    categories.forEach(category => {
        const option = document.createElement("option");

        option.value = category;
        option.textContent = category;

        elements.categoryFilter.appendChild(option);
    });

    elements.categoryFilter.value = categories.includes(selected)
        ? selected
        : "";
}

function getFilteredDocuments() {
    const search = normalizeText(elements.searchInput.value);
    const category = elements.categoryFilter.value;
    const status = elements.statusFilter.value;

    return documents.filter(doc => {
        const searchableContent = [
            doc.title,
            doc.slug,
            doc.category,
            doc.summary,
            doc.content,
            ...getDepartmentCodes(doc)
        ].map(normalizeText).join(" ");

        const matchesSearch =
            !search || searchableContent.includes(search);

        const matchesCategory =
            !category || doc.category === category;

        const matchesStatus =
            !status ||
            (status === "published" && doc.is_published) ||
            (status === "draft" && !doc.is_published);

        return matchesSearch && matchesCategory && matchesStatus;
    });
}

/* =========================================================
   AFFICHAGE DES DOCUMENTS
========================================================= */

function renderDocuments() {
    const filtered = getFilteredDocuments();

    elements.documentsGrid.replaceChildren();
    elements.emptyState.hidden = filtered.length > 0;

    if (filtered.length === 0) {
        elements.resultsCount.textContent = "0 document affiché";
        return;
    }

    filtered.forEach(doc => {
        const card = document.createElement("article");
        card.className = "document-card";

        const top = document.createElement("div");
        top.className = "document-card-top";

        const titleContainer = document.createElement("div");

        const category = document.createElement("span");
        category.className = "document-category";
        category.textContent = doc.category || "Général";

        const title = document.createElement("h3");
        title.textContent = doc.title || "Document sans titre";

        titleContainer.append(category, title);

        const status = document.createElement("span");
        status.className = `document-status ${
            doc.is_published ? "published" : "draft"
        }`;
        status.textContent = doc.is_published
            ? "PUBLIÉ"
            : "BROUILLON";

        top.append(titleContainer, status);

        const summary = document.createElement("p");
        summary.className = "document-summary";
        summary.textContent =
            doc.summary || "Aucun résumé renseigné.";

        const meta = document.createElement("div");
        meta.className = "document-card-meta";

        if (doc.is_global) {
            const tag = document.createElement("span");
            tag.className = "department-tag";
            tag.textContent = "Général";
            meta.appendChild(tag);
        } else {
            getDepartmentCodes(doc).forEach(code => {
                const tag = document.createElement("span");
                tag.className = "department-tag";
                tag.textContent = code;
                meta.appendChild(tag);
            });
        }

        const accreditation = document.createElement("span");
        accreditation.className = "department-tag";
        accreditation.textContent = `ACCÈS : ${doc.required_accreditation || "ACC 0"}`;
        meta.appendChild(accreditation);

        const date = document.createElement("span");
        date.className = "document-date";
        date.textContent = formatShortDate(getDocumentDate(doc));

        meta.appendChild(date);

        const actions = document.createElement("div");
        actions.className = "document-actions";

        actions.appendChild(
            createActionButton("Consulter", "", () => {
                openDetails(doc);
            })
        );

        if (isDocumentManageable(doc)) {
            actions.appendChild(
                createActionButton("Modifier", "", () => {
                    openEditModal(doc);
                })
            );

            actions.appendChild(
                createActionButton(
                    doc.is_published ? "Dépublier" : "Publier",
                    doc.is_published ? "unpublish" : "publish",
                    () => togglePublication(doc)
                )
            );

            actions.appendChild(
                createActionButton("Supprimer", "danger", () => {
                    deleteDocument(doc);
                })
            );
        }

        card.append(top, summary, meta, actions);
        elements.documentsGrid.appendChild(card);
    });

    elements.resultsCount.textContent =
        `${filtered.length} document(s) affiché(s) sur ${documents.length}`;
}

/* =========================================================
   CONSULTATION
========================================================= */

function openDetails(doc) {
    currentDetailsDocument = doc;

    elements.detailsTitle.textContent =
        doc.title || "Document sans titre";

    elements.detailsCategory.textContent =
        doc.category || "Général";

    elements.detailsStatus.textContent =
        doc.is_published ? "Publié" : "Brouillon";

    elements.detailsUpdated.textContent =
        `Mis à jour : ${formatTimestamp(getDocumentDate(doc))}`;
    elements.detailsAccreditation.textContent =
        `ACCRÉDITATION REQUISE : ${doc.required_accreditation || "ACC 0"}`;

    elements.detailsSummary.textContent =
        doc.summary || "Aucun résumé renseigné.";

    elements.detailsContent.textContent =
        doc.content || "Aucun contenu.";

    elements.detailsDepartments.replaceChildren();

    if (doc.is_global) {
        const tag = document.createElement("span");
        tag.className = "department-tag";
        tag.textContent = "Document général";
        elements.detailsDepartments.appendChild(tag);
    } else {
        getDepartmentCodes(doc).forEach(code => {
            const tag = document.createElement("span");
            tag.className = "department-tag";
            tag.textContent = code;
            elements.detailsDepartments.appendChild(tag);
        });
    }

    elements.editDetailsBtn.hidden =
        !isDocumentManageable(doc);

    setModalVisible(elements.detailsModal, true);
}

/* =========================================================
   COPIE DU CONTENU
========================================================= */

async function copyDocumentContent(content) {
    try {
        await navigator.clipboard.writeText(String(content || ""));

        showToast("Le contenu a été copié.", "success");

    } catch (error) {
        console.error("Copie du document :", error);

        showToast(
            "La copie automatique est indisponible sur ce navigateur.",
            "error"
        );
    }
}

/* =========================================================
   SÉLECTION DES DÉPARTEMENTS
========================================================= */

function renderDepartmentChoices(selectedCodes = []) {
    elements.departmentChoices.replaceChildren();

    const availableDepartments = isAdmin
        ? departments
        : departments.filter(department =>
            manageableDepartments.includes(department.code)
        );

    if (availableDepartments.length === 0) {
        const message = document.createElement("span");
        message.className = "muted-text";
        message.textContent = assignedDepartments.length > 0
            ? "Vous êtes affecté à un département, mais vous ne disposez pas de la permission nécessaire pour gérer ses documents."
            : "Aucun département ne vous est attribué.";

        elements.departmentChoices.appendChild(message);
        return;
    }

    availableDepartments.forEach(department => {
        const label = document.createElement("label");
        label.className = "department-option";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "documentDepartments";
        checkbox.value = department.code;
        checkbox.checked = selectedCodes.includes(department.code);

        const text = document.createElement("span");
        text.textContent = department.code;

        label.append(checkbox, text);
        elements.departmentChoices.appendChild(label);
    });
}

function getSelectedDepartments() {
    return [
        ...elements.departmentChoices.querySelectorAll(
            'input[name="documentDepartments"]:checked'
        )
    ].map(input => input.value);
}

/* =========================================================
   CRÉATION
========================================================= */

function openCreateModal() {
    if (!canManageDocuments) return;

    elements.documentForm.reset();

    elements.documentId.value = "";
    elements.documentOrder.value = "0";
    elements.documentAccreditation.value = "ACC 0";
    elements.documentGlobal.checked = false;
    elements.documentPublished.checked = false;

    elements.modalTitle.textContent = "Nouveau document";
    elements.saveDocumentBtn.textContent = "Enregistrer";

    elements.globalVisibilityWrapper.hidden = !isAdmin;
    elements.documentGlobal.disabled = !isAdmin;

    renderDepartmentChoices();

    updateVisibilityControls();

    setModalVisible(elements.documentModal, true);
}

/* =========================================================
   MODIFICATION
========================================================= */

function openEditModal(doc) {
    if (!isDocumentManageable(doc)) {
        showToast(
            "Vous ne disposez pas des droits nécessaires.",
            "error"
        );
        return;
    }

    elements.documentForm.reset();

    elements.documentId.value = doc.id;
    elements.documentTitle.value = doc.title || "";
    elements.documentCategory.value =
        doc.category || "Général";
    elements.documentOrder.value =
        doc.sort_order ?? 0;
    elements.documentSummary.value =
        doc.summary || "";
    elements.documentContent.value =
        doc.content || "";
    elements.documentAccreditation.value = doc.required_accreditation || "ACC 0";
    elements.documentGlobal.checked =
        isAdmin && doc.is_global;
    elements.documentPublished.checked =
        doc.is_published;

    elements.modalTitle.textContent = "Modifier le document";
    elements.saveDocumentBtn.textContent = "Enregistrer les modifications";

    elements.globalVisibilityWrapper.hidden = !isAdmin;
    elements.documentGlobal.disabled = !isAdmin;

    renderDepartmentChoices(getDepartmentCodes(doc));

    updateVisibilityControls();

    setModalVisible(elements.detailsModal, false);
    setModalVisible(elements.documentModal, true);
}

function updateVisibilityControls() {
    const isGlobal = isAdmin && elements.documentGlobal.checked;

    elements.departmentChoices.hidden = isGlobal;
    elements.departmentHelp.hidden = isGlobal;

    if (isGlobal) {
        elements.departmentHelp.textContent =
            "Ce document sera accessible à tous les membres autorisés.";
    } else {
        elements.departmentHelp.textContent =
            "Sélectionnez le ou les départements concernés.";
    }
}

/* =========================================================
   FERMETURE DE LA MODALE
========================================================= */

function closeDocumentModal() {
    setModalVisible(elements.documentModal, false);
    elements.documentForm.reset();
}

/* =========================================================
   ENREGISTREMENT ET ASSOCIATION DES DÉPARTEMENTS
========================================================= */

async function synchronizeDepartments(documentId, selectedDepartments) {
    const { error: deleteError } = await supabaseClient
        .from("member_document_departments")
        .delete()
        .eq("document_id", documentId);

    if (deleteError) throw deleteError;

    if (selectedDepartments.length === 0) return;

    const links = selectedDepartments.map(code => ({
        document_id: documentId,
        department_code: code
    }));

    const { error: insertError } = await supabaseClient
        .from("member_document_departments")
        .insert(links);

    if (insertError) throw insertError;
}

async function dispatchSiteNotification(eventName, sourceId) {
    try {
        const { data, error } = await supabaseClient.functions.invoke(
            "publish-site-notification",
            { body: { event: eventName, sourceId } }
        );

        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        return data;
    } catch (error) {
        console.warn("[ZONE-431] Notification non envoyée :", error);
        return null;
    }
}

async function saveDocument(event) {
    event.preventDefault();

    if (!canManageDocuments) {
        showToast(
            "Vous ne disposez pas des droits nécessaires.",
            "error"
        );
        return;
    }

    const documentId = elements.documentId.value;
    const previousDocument = documents.find(doc => doc.id === documentId) || null;
    const wasPublished = previousDocument?.is_published === true;

    const title = elements.documentTitle.value.trim();
    const category = elements.documentCategory.value;
    const summary = elements.documentSummary.value.trim();
    const content = elements.documentContent.value.trim();
    const requiredAccreditation = elements.documentAccreditation.value;

    const isGlobal = isAdmin && elements.documentGlobal.checked;
    const selectedDepartments = isGlobal
        ? []
        : getSelectedDepartments();

    if (!["ACC 0", "ACC 1", "ACC 2", "ACC 3", "ACC 4", "ACC 5", "O5"].includes(requiredAccreditation)) {
        showToast("Sélectionnez une accréditation valide.", "error");
        return;
    }

    if (!title || !content) {
        showToast(
            "Le titre et le contenu sont obligatoires.",
            "error"
        );
        return;
    }

    if (!isGlobal && selectedDepartments.length === 0) {
        showToast(
            "Sélectionnez au moins un département.",
            "error"
        );
        return;
    }

    if (
        !isAdmin &&
        selectedDepartments.some(code =>
            !manageableDepartments.includes(code)
        )
    ) {
        showToast(
            "Vous ne pouvez gérer que les documents de vos départements autorisés.",
            "error"
        );
        return;
    }

    const payload = {
        title,
        slug: `${slugify(title)}-${Date.now()}`,
        category,
        summary: summary || null,
        content,
        sort_order: Math.max(0, Number(elements.documentOrder.value) || 0),
        is_published: elements.documentPublished.checked,
        is_global: isGlobal,
        required_accreditation: requiredAccreditation,
        updated_by: currentUser.id,
        updated_at: new Date().toISOString()
    };

    elements.saveDocumentBtn.disabled = true;
    elements.saveDocumentBtn.textContent = "Enregistrement...";

    try {
        let savedDocumentId = documentId;

        if (documentId) {
            const { error } = await supabaseClient
                .from("member_documents")
                .update(payload)
                .eq("id", documentId);

            if (error) throw error;

        } else {
            payload.created_by = currentUser.id;

            const { data, error } = await supabaseClient
                .from("member_documents")
                .insert(payload)
                .select("id")
                .single();

            if (error) throw error;

            savedDocumentId = data.id;
        }

        await synchronizeDepartments(
            savedDocumentId,
            selectedDepartments
        );

        if (payload.is_published) {
            const notificationEvent = !documentId || !wasPublished
                ? "document_published"
                : "document_updated";

            await dispatchSiteNotification(notificationEvent, savedDocumentId);
        }

        closeDocumentModal();

        showToast(
            documentId
                ? "Le document a été modifié."
                : "Le document a été créé.",
            "success"
        );

        await loadDocuments();

    } catch (error) {
        console.error("Enregistrement du document :", error);

        showToast(
            error.message ||
                "Impossible d'enregistrer le document. Vérifiez vos autorisations et les départements sélectionnés.",
            "error"
        );

        await loadDocuments();

    } finally {
        elements.saveDocumentBtn.disabled = false;

        elements.saveDocumentBtn.textContent = documentId
            ? "Enregistrer les modifications"
            : "Enregistrer";
    }
}

/* =========================================================
   PUBLICATION / DÉPUBLICATION
========================================================= */

async function togglePublication(doc) {
    if (!isDocumentManageable(doc)) {
        showToast(
            "Vous ne disposez pas des droits nécessaires.",
            "error"
        );
        return;
    }

    const nextState = !doc.is_published;
    const action = nextState ? "publier" : "dépublier";

    const confirmed = window.confirm(
        `Confirmer la volonté de ${action} le document "${doc.title}" ?`
    );

    if (!confirmed) return;

    try {
        const { error } = await supabaseClient
            .from("member_documents")
            .update({
                is_published: nextState,
                updated_by: currentUser.id,
                updated_at: new Date().toISOString()
            })
            .eq("id", doc.id);

        if (error) throw error;

        if (nextState) {
            await dispatchSiteNotification("document_published", doc.id);
        }

        showToast(
            nextState
                ? "Le document a été publié."
                : "Le document a été dépublié.",
            "success"
        );

        await loadDocuments();

        if (
            currentDetailsDocument &&
            currentDetailsDocument.id === doc.id
        ) {
            closeDetailsModal();
        }

    } catch (error) {
        console.error("Publication du document :", error);

        showToast(
            error.message || "Impossible de modifier la publication.",
            "error"
        );
    }
}

/* =========================================================
   SUPPRESSION
========================================================= */

async function deleteDocument(doc) {
    if (!isDocumentManageable(doc)) return;

    const confirmed = window.confirm(
        `Confirmer la suppression du document "${doc.title}" ?\n\nCette action est définitive.`
    );

    if (!confirmed) return;

    try {
        const { error: linksError } = await supabaseClient
            .from("member_document_departments")
            .delete()
            .eq("document_id", doc.id);

        if (linksError) throw linksError;

        const { error } = await supabaseClient
            .from("member_documents")
            .delete()
            .eq("id", doc.id);

        if (error) throw error;

        showToast("Le document a été supprimé.", "success");

        if (
            currentDetailsDocument &&
            currentDetailsDocument.id === doc.id
        ) {
            closeDetailsModal();
        }

        await loadDocuments();

    } catch (error) {
        console.error("Suppression du document :", error);

        showToast(
            error.message || "Impossible de supprimer le document.",
            "error"
        );
    }
}

/* =========================================================
   FERMETURE DE LA CONSULTATION
========================================================= */

function closeDetailsModal() {
    currentDetailsDocument = null;

    setModalVisible(elements.detailsModal, false);
}


/* =========================================================
   MODÈLES DES NOTIFICATIONS DISCORD
========================================================= */

const notificationTemplateFields = [
    {
        key: "document_published",
        content: "templateDocumentPublished",
        enabled: "templateDocumentPublishedEnabled"
    },
    {
        key: "document_updated",
        content: "templateDocumentUpdated",
        enabled: "templateDocumentUpdatedEnabled"
    },
    {
        key: "training_published",
        content: "templateTrainingPublished",
        enabled: "templateTrainingPublishedEnabled"
    },
    {
        key: "training_updated",
        content: "templateTrainingUpdated",
        enabled: "templateTrainingUpdatedEnabled"
    }
];

async function openNotificationSettings() {
    if (!isAdmin) return;

    elements.notificationSettingsBtn.disabled = true;

    try {
        const { data, error } = await supabaseClient
            .from("site_notification_templates")
            .select("event_key,discord_content,enabled")
            .order("event_key", { ascending: true });

        if (error) throw error;

        const templates = new Map(
            (data || []).map(row => [row.event_key, row])
        );

        notificationTemplateFields.forEach(field => {
            const row = templates.get(field.key);
            const content = document.getElementById(field.content);
            const enabled = document.getElementById(field.enabled);

            if (!row || !content || !enabled) {
                throw new Error("Un modèle de notification est manquant : " + field.key);
            }

            content.value = row.discord_content || "";
            enabled.checked = row.enabled === true;
        });

        setModalVisible(elements.notificationSettingsModal, true);
    } catch (error) {
        console.error("Chargement des modèles Discord :", error);
        showToast(
            error.message || "Impossible de charger les modèles Discord.",
            "error"
        );
    } finally {
        elements.notificationSettingsBtn.disabled = false;
    }
}

function closeNotificationSettings() {
    setModalVisible(elements.notificationSettingsModal, false);
}

async function saveNotificationSettings(event) {
    event.preventDefault();

    if (!isAdmin) {
        showToast("Seuls les administrateurs peuvent modifier ces modèles.", "error");
        return;
    }

    const entries = notificationTemplateFields.map(field => ({
        key: field.key,
        content: document.getElementById(field.content).value.trim(),
        enabled: document.getElementById(field.enabled).checked
    }));

    for (const entry of entries) {
        if (entry.enabled && !entry.content) {
            showToast("Un message activé ne peut pas être vide.", "error");
            return;
        }

        if (entry.content.length > 1900) {
            showToast("Un message dépasse la limite de 1 900 caractères.", "error");
            return;
        }
    }

    elements.saveNotificationSettingsBtn.disabled = true;
    elements.saveNotificationSettingsBtn.textContent = "Enregistrement...";

    try {
        for (const entry of entries) {
            const { data, error } = await supabaseClient
                .from("site_notification_templates")
                .update({
                    discord_content: entry.content,
                    enabled: entry.enabled,
                    updated_at: new Date().toISOString(),
                    updated_by: currentUser.id
                })
                .eq("event_key", entry.key)
                .select("event_key")
                .single();

            if (error) throw error;
            if (!data) throw new Error("Le modèle n'a pas été enregistré : " + entry.key);
        }

        showToast("Les messages Discord ont été enregistrés.", "success");
        closeNotificationSettings();
    } catch (error) {
        console.error("Enregistrement des modèles Discord :", error);
        showToast(
            error.message || "Impossible d'enregistrer les messages Discord.",
            "error"
        );
    } finally {
        elements.saveNotificationSettingsBtn.disabled = false;
        elements.saveNotificationSettingsBtn.textContent = "Enregistrer les messages";
    }
}

/* =========================================================
   ÉVÈNEMENTS
========================================================= */

function setupEvents() {
    if (isAdmin && elements.notificationSettingsBtn) {
        elements.notificationSettingsBtn.addEventListener("click", openNotificationSettings);
        elements.closeNotificationSettingsBtn.addEventListener("click", closeNotificationSettings);
        elements.cancelNotificationSettingsBtn.addEventListener("click", closeNotificationSettings);
        elements.notificationSettingsForm.addEventListener("submit", saveNotificationSettings);
        elements.notificationSettingsModal.addEventListener("click", event => {
            if (event.target === elements.notificationSettingsModal) {
                closeNotificationSettings();
            }
        });
    }

    elements.newDocumentBtn.addEventListener(
        "click",
        openCreateModal
    );

    elements.refreshBtn.addEventListener(
        "click",
        loadDocuments
    );

    elements.searchInput.addEventListener(
        "input",
        renderDocuments
    );

    elements.categoryFilter.addEventListener(
        "change",
        renderDocuments
    );

    elements.statusFilter.addEventListener(
        "change",
        renderDocuments
    );

    elements.documentForm.addEventListener(
        "submit",
        saveDocument
    );

    elements.documentGlobal.addEventListener(
        "change",
        updateVisibilityControls
    );

    elements.closeModalBtn.addEventListener(
        "click",
        closeDocumentModal
    );

    elements.cancelModalBtn.addEventListener(
        "click",
        closeDocumentModal
    );

    elements.closeDetailsBtn.addEventListener(
        "click",
        closeDetailsModal
    );

    elements.closeDetailsFooterBtn.addEventListener(
        "click",
        closeDetailsModal
    );

    elements.copyDetailsBtn.addEventListener(
        "click",
        () => {
            if (currentDetailsDocument) {
                copyDocumentContent(currentDetailsDocument.content);
            }
        }
    );

    elements.editDetailsBtn.addEventListener(
        "click",
        () => {
            if (
                currentDetailsDocument &&
                isDocumentManageable(currentDetailsDocument)
            ) {
                openEditModal(currentDetailsDocument);
            }
        }
    );

    elements.documentModal.addEventListener("click", event => {
        if (event.target === elements.documentModal) {
            closeDocumentModal();
        }
    });

    elements.detailsModal.addEventListener("click", event => {
        if (event.target === elements.detailsModal) {
            closeDetailsModal();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key !== "Escape") return;

        if (!elements.notificationSettingsModal.hidden) {
            closeNotificationSettings();
        }

        if (!elements.documentModal.hidden) {
            closeDocumentModal();
        }

        if (!elements.detailsModal.hidden) {
            closeDetailsModal();
        }
    });
}

/* =========================================================
   SURVEILLANCE DE SESSION
========================================================= */

supabaseClient.auth.onAuthStateChange(event => {
    if (event === "SIGNED_OUT") {
        window.location.replace("connexion.html");
    }
});

/* =========================================================
   DÉMARRAGE
========================================================= */

initialize();
