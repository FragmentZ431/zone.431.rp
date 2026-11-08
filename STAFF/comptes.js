
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
    const [departmentResult, nodeResult] = await Promise.all([
        db.from("rp_departments")
            .select("code,name,description")
            .order("code"),

        db.from("rp_organization_nodes")
            .select("code,parent_code,root_department_code,node_type,title,sort_order")
            .order("sort_order")
    ]);

    if (departmentResult.error) throw departmentResult.error;
    if (nodeResult.error) throw nodeResult.error;

    departments = departmentResult.data || [];
    nodes = nodeResult.data || [];

    renderDepartmentSelection();
    renderNodeSelection();
}

/* =========================================================
   CHARGEMENT DES COMPTES ET DES NOMS RP
   ========================================================= */

async function loadAccounts() {
    /*
     * La liste des comptes continue de provenir de la RPC
     * existante. Les noms RP sont chargés séparément depuis
     * rp_member_profiles pour ne pas modifier cette RPC.
     */
    const [membersResult, profilesResult] = await Promise.all([
        db.rpc("admin_list_rp_members"),

        db.from("rp_member_profiles")
            .select("user_id,rp_name")
    ]);

    if (membersResult.error) throw membersResult.error;
    if (profilesResult.error) throw profilesResult.error;

    const rpNames = new Map(
        (profilesResult.data || []).map(profile => [
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
        editButton.addEventListener("click", () => openAccountEditor(account));

        actions.appendChild(editButton);
        card.append(main, actions);
        container.appendChild(card);
    });
}

/* =========================================================
   SÉLECTION DES DÉPARTEMENTS
   ========================================================= */

function renderDepartmentSelection() {
    const container = $("departmentsSelection");
    container.replaceChildren();

    if (!departments.length) {
        const empty = document.createElement("p");
        empty.className = "loading";
        empty.textContent = "Aucun département disponible dans le catalogue DPT.";
        container.appendChild(empty);
        return;
    }

    departments.forEach(department => {
        const label = document.createElement("label");
        label.className = "selection-item";

        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = "departmentAccess";
        checkbox.value = department.code;

        const content = document.createElement("span");

        const title = document.createElement("strong");
        title.textContent = `${department.code} — ${department.name}`;

        const description = document.createElement("small");
        description.textContent = department.description || "Aucune description.";

        content.append(title, description);
        label.append(checkbox, content);
        container.appendChild(label);
    });
}

/* =========================================================
   ARBORESCENCE ORGANISATIONNELLE
   Départements + structures indépendantes
   ========================================================= */

function getNodeSortValue(node) {
    return Number(node.sort_order) || 0;
}

function sortNodes(list) {
    return [...list].sort((a, b) =>
        getNodeSortValue(a) - getNodeSortValue(b) ||
        String(a.code).localeCompare(String(b.code), "fr")
    );
}

function createNodeOption(node, selectedCodes, depth = 0) {
    const label = document.createElement("label");
    label.className = "node-option";
    label.style.paddingLeft = `${8 + depth * 17}px`;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "organizationAccess";
    checkbox.value = node.code;
    checkbox.checked = selectedCodes.has(node.code);
    checkbox.addEventListener("change", updateSelectionSummary);

    const content = document.createElement("span");
    content.className = "node-option-content";

    const title = document.createElement("strong");
    title.textContent = `${node.code} — ${node.title}`;

    const type = document.createElement("small");
    type.textContent = node.node_type || "Élément organisationnel";

    content.append(title, type);
    label.append(checkbox, content);

    return label;
}

function appendNodeBranch(
    node,
    childrenByParent,
    selectedCodes,
    visited,
    container,
    depth = 0
) {
    if (visited.has(node.code)) return;

    visited.add(node.code);

    container.appendChild(
        createNodeOption(node, selectedCodes, depth)
    );

    const children = childrenByParent.get(node.code) || [];

    children.forEach(child => {
        appendNodeBranch(
            child,
            childrenByParent,
            selectedCodes,
            visited,
            container,
            depth + 1
        );
    });
}

function renderNodeGroup(groupTitle, groupNodes, selectedCodes) {
    const group = document.createElement("section");
    group.className = "node-department-group";

    const heading = document.createElement("div");
    heading.className = "node-group-heading";
    heading.textContent = groupTitle;

    const tree = document.createElement("div");
    tree.className = "node-tree";

    const sorted = sortNodes(groupNodes);
    const groupCodes = new Set(sorted.map(node => node.code));

    const childrenByParent = new Map();

    sorted.forEach(node => {
        const parentCode = node.parent_code;

        if (!parentCode || !groupCodes.has(parentCode)) return;

        if (!childrenByParent.has(parentCode)) {
            childrenByParent.set(parentCode, []);
        }

        childrenByParent.get(parentCode).push(node);
    });

    for (const [parentCode, children] of childrenByParent.entries()) {
        childrenByParent.set(parentCode, sortNodes(children));
    }

    const visited = new Set();

    const roots = sorted.filter(node =>
        !node.parent_code || !groupCodes.has(node.parent_code)
    );

    roots.forEach(root => {
        appendNodeBranch(
            root,
            childrenByParent,
            selectedCodes,
            visited,
            tree,
            0
        );
    });

    sorted.forEach(node => {
        if (visited.has(node.code)) return;

        appendNodeBranch(
            node,
            childrenByParent,
            selectedCodes,
            visited,
            tree,
            0
        );
    });

    if (!tree.children.length) {
        const empty = document.createElement("p");
        empty.className = "loading";
        empty.textContent = "Aucun élément organisationnel disponible.";
        tree.appendChild(empty);
    }

    group.append(heading, tree);

    return group;
}

function renderNodeSelection() {
    const container = $("nodesSelection");

    const selectedCodes = new Set(
        selectedAccount?.organization_nodes?.map(node => node.code) || []
    );

    container.replaceChildren();

    if (!nodes.length) {
        const empty = document.createElement("p");
        empty.className = "loading";
        empty.textContent = "Aucun élément organisationnel disponible.";
        container.appendChild(empty);
        updateSelectionSummary();
        return;
    }

    const knownDepartmentCodes = new Set(
        departments.map(department => department.code)
    );

    departments.forEach(department => {
        const departmentNodes = nodes.filter(node =>
            node.root_department_code === department.code
        );

        container.appendChild(
            renderNodeGroup(
                `${department.code} — ${department.name}`,
                departmentNodes,
                selectedCodes
            )
        );
    });

    const independentNodes = nodes.filter(node =>
        !node.root_department_code ||
        !knownDepartmentCodes.has(node.root_department_code)
    );

    if (independentNodes.length) {
        container.appendChild(
            renderNodeGroup(
                "STRUCTURES INDÉPENDANTES",
                independentNodes,
                selectedCodes
            )
        );
    }

    updateSelectionSummary();
    filterNodes();
}

/* =========================================================
   RÉCAPITULATIF DES AFFECTATIONS
   ========================================================= */

function updateSelectionSummary() {
    const departmentCount = document.querySelectorAll(
        'input[name="departmentAccess"]:checked'
    ).length;

    const nodeCount = document.querySelectorAll(
        'input[name="organizationAccess"]:checked'
    ).length;

    $("selectionSummary").textContent =
        `${departmentCount} département(s) sélectionné(s) · ${nodeCount} élément(s) organisationnel(s) sélectionné(s).`;
}

/* =========================================================
   RECHERCHE DANS LES STRUCTURES
   ========================================================= */

function filterNodes() {
    const query = $("searchNodes").value.trim().toLowerCase();

    document.querySelectorAll(".node-department-group").forEach(group => {
        let visibleCount = 0;

        group.querySelectorAll(".node-option").forEach(option => {
            const matches = option.textContent.toLowerCase().includes(query);
            option.hidden = !matches;

            if (matches) visibleCount++;
        });

        group.hidden = query.length > 0 && visibleCount === 0;
    });
}

/* =========================================================
   OUVERTURE DU DOSSIER D'UN COMPTE
   ========================================================= */

function openAccountEditor(account) {
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
    $("accountGrade").value = account.grade || "";

    document.querySelectorAll('input[name="departmentAccess"]').forEach(input => {
        input.checked = account.department_codes.includes(input.value);
    });

    $("searchNodes").value = "";
    renderNodeSelection();

    $("accountModal").showModal();
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
        const grade = $("accountGrade").value.trim();

        if (rpName.length > 100) {
            throw new Error("Le nom RP ne peut pas dépasser 100 caractères.");
        }

        const departmentCodes = [
            ...document.querySelectorAll('input[name="departmentAccess"]:checked')
        ].map(input => input.value);

        const nodeCodes = [
            ...document.querySelectorAll('input[name="organizationAccess"]:checked')
        ].map(input => input.value);

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
            p_grade: grade,
            p_department_codes: departmentCodes,
            p_node_codes: nodeCodes
        });

        if (error) throw error;

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
   RÉINITIALISATION DE LA SÉLECTION
   ========================================================= */

function clearNodeSelection() {
    document.querySelectorAll('input[name="organizationAccess"]').forEach(input => {
        input.checked = false;
    });

    updateSelectionSummary();
}

function closeAccountModal() {
    $("accountModal").close();
    selectedAccount = null;
}

/* =========================================================
   ACTUALISATION
   ========================================================= */

async function refreshAll() {
    $("refreshButton").disabled = true;
    $("refreshButton").textContent = "ACTUALISATION...";

    try {
        await loadCatalog();
        await loadAccounts();
        await loadGlobalLogoutState();

        showMessage("Les données ont été actualisées.");
    } catch (error) {
        console.error("[ZONE-431] Actualisation impossible :", error);
        showMessage(error.message || "Impossible d'actualiser les données.", true);
    } finally {
        $("refreshButton").disabled = false;
        $("refreshButton").textContent = "ACTUALISER";
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

        $("searchNodes").addEventListener("input", filterNodes);
        $("clearNodesButton").addEventListener("click", clearNodeSelection);

        $("departmentsSelection").addEventListener("change", updateSelectionSummary);

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
