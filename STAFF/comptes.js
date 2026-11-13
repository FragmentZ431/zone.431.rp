
/* =========================================================
   ZONE-431 — GESTION DES COMPTES RP
   Administration des demandes et des affectations
   ========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let accounts = [];
let departments = [];
let nodes = [];
let selectedAccount = null;

const $ = id => document.getElementById(id);

const STATUS_LABELS = {
    pending: "EN ATTENTE",
    authorized: "AUTORISÉ",
    suspended: "SUSPENDU",
    rejected: "REFUSÉ"
};

function showMessage(message, isError = false) {
    const element = $("globalMessage");
    element.textContent = message;
    element.style.color = isError ? "#ef858c" : "#83b895";
}

function setConnectionStatus(message, isError = false) {
    const element = $("connectionStatus");
    element.textContent = message;
    element.classList.toggle("error", isError);
}

function formatDate(value) {
    if (!value) return "—";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    return new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

function normalizeStatus(value) {
    const status = String(value || "pending").toLowerCase();
    return Object.hasOwn(STATUS_LABELS, status) ? status : "pending";
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

/*
 * Vérification de la session côté serveur.
 * L'accès administrateur est ensuite vérifié par les RPC
 * admin_list_rp_members et admin_save_rp_member.
 */

async function validateSession() {
    const { data: sessionData, error: sessionError } =
        await db.auth.getSession();

    if (sessionError || !sessionData.session) {
        window.location.href = "../connexion.html";
        return false;
    }

    const { data: userData, error: userError } =
        await db.auth.getUser();

    if (userError || !userData.user) {
        window.location.href = "../connexion.html";
        return false;
    }

    currentUser = userData.user;

    return true;
}


/* =========================================================
   CHARGEMENT DU CATALOGUE DPT
   ========================================================= */

async function loadCatalog() {
    const { data, error } = await db.rpc("admin_get_rp_department_catalog");
    if (error) throw error;

    departments = Array.isArray(data?.departments) ? data.departments : [];
    nodes = Array.isArray(data?.nodes) ? data.nodes : [];

    if (!departments.length) {
        throw new Error("Le catalogue des départements est vide ou inaccessible.");
    }

    renderDepartmentSelection();
}

/* =========================================================
   CHARGEMENT DES COMPTES ET DES NOMS RP
   ========================================================= */

async function loadAccounts() {
    /*
     * Les données administratives sont chargées par RPC sécurisées :
     * cela évite que les règles RLS de lecture directe masquent
     * les profils RP ou leurs noms dans la liste.
     */
    const [membersResult, namesResult] = await Promise.all([
        db.rpc("admin_list_rp_members"),
        db.rpc("admin_list_rp_member_names")
    ]);

    if (membersResult.error) throw membersResult.error;
    if (namesResult.error) throw namesResult.error;

    const rpNames = new Map(
        (namesResult.data || []).map(profile => [
            profile.user_id,
            profile.rp_name || ""
        ])
    );

    accounts = (membersResult.data || []).map(account => ({
        ...account,
        rp_name: rpNames.get(account.user_id) || "",
        status: normalizeStatus(account.status),
        department_codes: Array.isArray(account.department_codes)
            ? account.department_codes
            : [],
        organization_nodes: Array.isArray(account.organization_nodes)
            ? account.organization_nodes
            : []
    }));

    renderAccounts();
    updateStatistics();
}

async function loadGlobalLogoutState() {
    const { data, error } = await db.rpc("admin_get_global_logout_state");

    if (error) {
        $("globalLogoutInfo").textContent =
            "État du contrôle indisponible.";
        $("globalLogoutButton").disabled = true;
        return;
    }

    $("globalLogoutInfo").textContent = data
        ? `Dernière déconnexion générale : ${formatDate(data)}`
        : "Aucune déconnexion générale enregistrée.";

    $("globalLogoutButton").disabled = false;
}

/* =========================================================
   STATISTIQUES
   ========================================================= */

function updateStatistics() {
    const total = accounts.length;
    const pending = accounts.filter(a => a.status === "pending").length;
    const authorized = accounts.filter(a => a.status === "authorized").length;
    const restricted = accounts.filter(a =>
        a.status === "suspended" || a.status === "rejected"
    ).length;

    $("totalAccounts").textContent = total;
    $("pendingAccounts").textContent = pending;
    $("authorizedAccounts").textContent = authorized;
    $("restrictedAccounts").textContent = restricted;
}

/* =========================================================
   RECHERCHE DES COMPTES
   ========================================================= */

function getAccountSearchText(account) {
    return [
        account.rp_name,
        account.email,
        account.display_name,
        account.discord_username,
        account.roblox_username,
        account.grade,
        account.personnel_id
    ].join(" ").toLowerCase();
}

function renderAccounts() {
    const container = $("accountsContainer");
    const query = $("searchAccounts").value.trim().toLowerCase();
    const filter = $("statusFilter").value;

    const filtered = accounts.filter(account => {
        const matchesQuery = getAccountSearchText(account).includes(query);
        const matchesStatus = filter === "all" || account.status === filter;

        return matchesQuery && matchesStatus;
    });

    container.replaceChildren();

    $("accountCountLabel").textContent =
        `${filtered.length} COMPTE${filtered.length > 1 ? "S" : ""}`;

    if (!filtered.length) {
        const empty = document.createElement("p");
        empty.className = "loading";
        empty.textContent = "Aucun compte ne correspond à cette recherche.";
        container.appendChild(empty);
        return;
    }

    filtered.forEach(account => {
        const card = document.createElement("article");
        card.className = "account-card";

        const main = document.createElement("div");
        main.className = "account-main";

        const email = document.createElement("strong");
        email.className = "account-email";
        email.textContent = account.email || "Adresse email indisponible";

        const identifiers = document.createElement("div");
        identifiers.className = "account-identifiers";

        const rpName = document.createElement("span");
        rpName.textContent = `NOM RP : ${account.rp_name || "NON ATTRIBUÉ"}`;

        const roblox = document.createElement("span");
        roblox.textContent = `ROBLOX : ${account.roblox_username || "Non renseigné"}`;

        const discord = document.createElement("span");
        discord.textContent = `DISCORD : ${account.discord_username || "Non renseigné"}`;

        identifiers.append(rpName, roblox, discord);

        const meta = document.createElement("div");
        meta.className = "account-meta";

        const status = document.createElement("span");
        status.className = `status ${account.status}`;
        status.textContent = STATUS_LABELS[account.status];

        const grade = document.createElement("span");
        grade.className = "account-grade";
        grade.textContent = account.grade
            ? `GRADE : ${account.grade}`
            : "GRADE NON ATTRIBUÉ";

        meta.append(status, grade);
        main.append(email, identifiers, meta);

        const actions = document.createElement("div");
        actions.className = "account-actions";

        const editButton = document.createElement("button");
        editButton.className = "edit-button";
        editButton.type = "button";
        editButton.textContent = "GÉRER LE COMPTE";
        editButton.addEventListener("click", async () => {
            try {
                await openAccountEditor(account);
            } catch (error) {
                console.error("[ZONE-431] Ouverture du dossier impossible :", error);
                showMessage(error.message || "Impossible de charger les affectations du compte.", true);
            }
        });

        actions.appendChild(editButton);
        card.append(main, actions);
        container.appendChild(card);
    });
}

/* =========================================================
   AFFECTATIONS : DÉPARTEMENT PRINCIPAL ET ADDITIONNELS
   ========================================================= */

function sortNodes(list) {
    return [...list].sort((a, b) =>
        (Number(a.sort_order) || 0) - (Number(b.sort_order) || 0) ||
        String(a.code).localeCompare(String(b.code), "fr")
    );
}

function getSpecialDepartments() {
    return ["FIM", "GDI"].map(code => {
        const node = nodes.find(item => item.code === code);
        return { code, name: node?.title || code };
    });
}
function getDepartmentChoices(includeSpecial = false) {
    const choices = [...departments];
    if (includeSpecial) choices.push(...getSpecialDepartments());
    return choices.sort((a, b) => a.code.localeCompare(b.code, "fr"));
}
function getDivisionsForDepartment(code) {
    if (!code) return [];
    return sortNodes(nodes.filter(node => node.code !== code &&
        (node.root_department_code === code || node.parent_code === code)));
}
function fillSelect(select, options, placeholder, selectedValue = "") {
    select.replaceChildren();
    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = placeholder;
    select.appendChild(empty);
    options.forEach(option => {
        const item = document.createElement("option");
        item.value = option.code;
        item.textContent = `${option.code} — ${option.name || option.title}`;
        select.appendChild(item);
    });
    select.value = selectedValue || "";
}
function renderPrimaryDepartmentOptions(selectedDepartment = "", selectedDivision = "") {
    const departmentSelect = $("primaryDepartment");
    const divisionSelect = $("primaryDivision");
    fillSelect(departmentSelect, getDepartmentChoices(false), "Sélectionner le département", selectedDepartment);
    fillSelect(divisionSelect, getDivisionsForDepartment(departmentSelect.value), "Aucune division", selectedDivision);
    departmentSelect.onchange = () => {
        fillSelect(divisionSelect, getDivisionsForDepartment(departmentSelect.value), "Aucune division");
        updateSelectionSummary();
    };
}
function createSecondaryAssignment(data = {}) {
    const row = document.createElement("div");
    row.className = "secondary-assignment-row";
    const departmentLabel = document.createElement("label");
    departmentLabel.textContent = "Département secondaire";
    const departmentSelect = document.createElement("select");
    departmentSelect.className = "secondary-department";
    departmentSelect.required = true;
    fillSelect(departmentSelect, getDepartmentChoices(true), "Sélectionner un département", data.department_code || "");
    departmentLabel.appendChild(departmentSelect);

    const divisionLabel = document.createElement("label");
    divisionLabel.textContent = "Division (facultatif)";
    const divisionSelect = document.createElement("select");
    divisionSelect.className = "secondary-division";
    fillSelect(divisionSelect, getDivisionsForDepartment(departmentSelect.value), "Aucune division", data.division_code || "");
    divisionLabel.appendChild(divisionSelect);

    const rpNameLabel = document.createElement("label");
    rpNameLabel.textContent = "Nom RP dans ce département (obligatoire)";
    const rpNameInput = document.createElement("input");
    rpNameInput.className = "secondary-rp-name";
    rpNameInput.type = "text";
    rpNameInput.maxLength = 100;
    rpNameInput.required = true;
    rpNameInput.placeholder = "Nom RP pour ce département";
    rpNameInput.value = data.rp_name || "";
    rpNameLabel.appendChild(rpNameInput);

    const gradeLabel = document.createElement("label");
    gradeLabel.textContent = "Grade (obligatoire)";
    const gradeInput = document.createElement("input");
    gradeInput.className = "secondary-grade";
    gradeInput.type = "text";
    gradeInput.maxLength = 120;
    gradeInput.required = true;
    gradeInput.placeholder = "Grade dans ce département";
    gradeInput.value = data.grade || "";
    gradeLabel.appendChild(gradeInput);

    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-secondary-button";
    removeButton.textContent = "SUPPRIMER";
    removeButton.addEventListener("click", () => { row.remove(); updateSelectionSummary(); });
    departmentSelect.addEventListener("change", () => {
        fillSelect(divisionSelect, getDivisionsForDepartment(departmentSelect.value), "Aucune division");
    });
    row.append(departmentLabel, divisionLabel, rpNameLabel, gradeLabel, removeButton);

    const container = $("secondaryAssignments");
    if (!container) {
        throw new Error("La zone des départements additionnels est introuvable.");
    }

    container.style.display = "grid";
    container.appendChild(row);
    updateSelectionSummary();
    row.scrollIntoView({ behavior: "smooth", block: "nearest" });
}
function renderDepartmentSelection() {
    renderPrimaryDepartmentOptions();
    $("secondaryAssignments").replaceChildren();
    updateSelectionSummary();
}
function updateSelectionSummary() {
    const primary = $("primaryDepartment")?.selectedOptions[0]?.textContent || "Aucun";
    const count = document.querySelectorAll(".secondary-assignment-row").length;
    $("selectionSummary").textContent = `Principal : ${primary} · ${count} département(s) additionnel(s).`;
}

/* =========================================================
   OUVERTURE DU DOSSIER D'UN COMPTE
   ========================================================= */

async function openAccountEditor(account) {
    selectedAccount = account;

    $("accountUserId").value = account.user_id;
    $("modalTitle").textContent = account.status === "pending"
        ? "Traiter une demande d'accès"
        : "Gérer le compte";

    $("accountEmail").textContent = account.email || "—";
    $("accountRoblox").textContent = account.roblox_username || "Non renseigné";
    $("accountDiscord").textContent = account.discord_username || "Non renseigné";
    $("accountCreatedAt").textContent = formatDate(account.created_at);

    $("accountRpName").value = account.rp_name || "";
    $("accountStatus").value = account.status;

    renderPrimaryDepartmentOptions(account.department || account.department_codes?.[0] || "");
    $("primaryGrade").value = account.grade || "";
    $("secondaryAssignments").replaceChildren();

    const addSecondaryButton = $("addSecondaryButton");
    addSecondaryButton.onclick = event => {
        event.preventDefault();
        event.stopPropagation();

        try {
            createSecondaryAssignment();
        } catch (error) {
            console.error("[ZONE-431] Ajout du département additionnel impossible :", error);
            showMessage(error.message || "Impossible d'ajouter le département.", true);
        }
    };

    const { data: assignmentData, error: assignmentError } = await db.rpc(
        "admin_get_member_department_assignments",
        { p_user_id: account.user_id }
    );
    if (assignmentError) throw assignmentError;
    const assignments = Array.isArray(assignmentData) ? assignmentData : [];
    const primary = assignments.find(item => item.assignment_type === "primary");
    if (primary) {
        renderPrimaryDepartmentOptions(primary.department_code, primary.division_code || "");
        $("primaryGrade").value = primary.grade || "";
    }
    assignments.filter(item => item.assignment_type === "secondary")
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .forEach(item => createSecondaryAssignment(item));

    $("accountModal").showModal();
}

/* =========================================================
   FERMETURE DU DOSSIER COMPTE
   ========================================================= */

function closeAccountModal(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const modal = $("accountModal");
    if (modal?.open) modal.close();

    selectedAccount = null;
    $("secondaryAssignments")?.replaceChildren();
    $("selectionSummary").textContent = "Aucun rattachement sélectionné.";
}

/* =========================================================
   ENREGISTREMENT DU NOM RP
   ========================================================= */

async function saveRpName(userId, rpName) {
    const { error } = await db.rpc("admin_set_rp_member_name", {
        p_user_id: userId,
        p_rp_name: rpName
    });

    if (error) throw error;
}

/* =========================================================
   ENREGISTREMENT DU DOSSIER ET DES AFFECTATIONS
   ========================================================= */

async function saveAccount(event) {
    event.preventDefault();

    if (!selectedAccount) return;

    const saveButton = $("saveButton");
    saveButton.disabled = true;
    saveButton.textContent = "ENREGISTREMENT...";

    try {
        const sessionValid = await validateSession();

        if (!sessionValid) return;

        const userId = $("accountUserId").value;
        const rpName = $("accountRpName").value.trim();
        const status = $("accountStatus").value;

        if (rpName.length > 100) {
            throw new Error("Le nom RP ne peut pas dépasser 100 caractères.");
        }

        const primaryDepartment = $("primaryDepartment").value;
        const primaryDivision = $("primaryDivision").value || null;
        const primaryGrade = $("primaryGrade").value.trim();
        if (!primaryDepartment) throw new Error("Le département principal est obligatoire.");

        const secondaryAssignments = [...document.querySelectorAll(".secondary-assignment-row")].map(row => ({
            department_code: row.querySelector(".secondary-department").value,
            division_code: row.querySelector(".secondary-division").value || null,
            grade: row.querySelector(".secondary-grade").value.trim(),
            rp_name: row.querySelector(".secondary-rp-name").value.trim()
        }));
        if (secondaryAssignments.some(item => !item.department_code || !item.grade || !item.rp_name)) {
            throw new Error("Chaque département additionnel doit avoir un département, un nom RP et un grade.");
        }
        if (secondaryAssignments.some(item => item.rp_name.length > 100)) {
            throw new Error("Le nom RP d'un département additionnel ne peut pas dépasser 100 caractères.");
        }
        const departmentCodes = [
            primaryDepartment,
            ...secondaryAssignments
                .map(item => item.department_code)
                .filter(code => departments.some(department => department.code === code))
        ];
        const nodeCodes = [
            ...(primaryDivision ? [primaryDivision] : []),
            ...secondaryAssignments
                .map(item => item.department_code)
                .filter(code => code === "FIM" || code === "GDI"),
            ...secondaryAssignments.map(item => item.division_code).filter(Boolean)
        ];

        /*
         * Enregistrement du nom RP via la nouvelle fonction
         * dédiée. Cette opération ne modifie ni les accès,
         * ni le statut, ni les affectations du membre.
         */
        await saveRpName(userId, rpName);

        /*
         * Conservation de la fonction historique pour
         * le statut, le grade et les affectations.
         */
        const { error } = await db.rpc("admin_save_rp_member", {
            p_user_id: userId,
            p_status: status,
            p_grade: primaryGrade,
            p_department_codes: departmentCodes,
            p_node_codes: nodeCodes
        });

        if (error) throw error;

        const { error: assignmentSaveError } = await db.rpc("admin_save_member_department_assignments", {
            p_user_id: userId,
            p_primary_department_code: primaryDepartment,
            p_primary_division_code: primaryDivision,
            p_primary_grade: primaryGrade || null,
            p_secondary: secondaryAssignments
        });
        if (assignmentSaveError) throw assignmentSaveError;

        $("accountModal").close();
        showMessage("Le dossier du compte a été mis à jour.");

        selectedAccount = null;

        await loadAccounts();
    } catch (error) {
        console.error("[ZONE-431] Enregistrement impossible :", error);
        showMessage(error.message || "Impossible d'enregistrer ce compte.", true);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "ENREGISTRER";
    }
}

/* =========================================================
   DÉCONNEXION GÉNÉRALE
   ========================================================= */

async function performGlobalLogout() {
    const confirmed = window.confirm(
        "Confirmer la déconnexion générale ? Les membres devront se reconnecter."
    );

    if (!confirmed) return;

    const button = $("globalLogoutButton");
    button.disabled = true;
    button.textContent = "OPÉRATION EN COURS...";

    try {
        const sessionValid = await validateSession();

        if (!sessionValid) return;

        const { error } = await db.rpc("admin_global_logout");

        if (error) throw error;

        await db.auth.signOut({ scope: "local" });

        window.location.href = "../connexion.html";
    } catch (error) {
        console.error("[ZONE-431] Déconnexion générale impossible :", error);
        showMessage(error.message || "La déconnexion générale a échoué.", true);

        button.disabled = false;
        button.textContent = "DÉCONNEXION GÉNÉRALE";
    }
}

/* =========================================================
   ACTUALISATION MANUELLE
   ========================================================= */

async function refreshAll() {
    const button = $("refreshButton");
    if (button.disabled) return;

    button.disabled = true;
    const previousLabel = button.textContent;
    button.textContent = "ACTUALISATION...";

    try {
        await loadCatalog();
        await loadAccounts();
        await loadGlobalLogoutState();
        showMessage("Les données des comptes ont été actualisées.");
    } catch (error) {
        console.error("[ZONE-431] Actualisation impossible :", error);
        showMessage(error.message || "Impossible d'actualiser les données.", true);
    } finally {
        button.disabled = false;
        button.textContent = previousLabel || "ACTUALISER";
    }
}

/* =========================================================
   INITIALISATION
   ========================================================= */

async function initialize() {
    try {
        const valid = await validateSession();
        if (!valid) return;

        setConnectionStatus("SESSION VALIDÉE");

        $("permissionMessage").textContent =
            "Session validée. Vérification des autorisations administrateur effectuée par les fonctions sécurisées Supabase.";

        await loadCatalog();
        await loadAccounts();
        await loadGlobalLogoutState();

        $("accountForm").addEventListener("submit", saveAccount);

        $("closeModal").addEventListener("click", closeAccountModal);
        $("cancelButton").addEventListener("click", closeAccountModal);

        $("refreshButton").addEventListener("click", refreshAll);

        $("searchAccounts").addEventListener("input", renderAccounts);
        $("statusFilter").addEventListener("change", renderAccounts);

        $("primaryDepartment").addEventListener("change", updateSelectionSummary);

        $("globalLogoutButton").addEventListener("click", performGlobalLogout);

        console.info("[ZONE-431] Gestion des comptes initialisée.");
    } catch (error) {
        console.error("[ZONE-431] Initialisation impossible :", error);

        setConnectionStatus("ACCÈS REFUSÉ", true);

        $("permissionMessage").textContent =
            "Impossible de vérifier les autorisations ou de charger les données.";

        showMessage(error.message || "Une erreur est survenue.", true);
    }
}

document.addEventListener("DOMContentLoaded", initialize);
