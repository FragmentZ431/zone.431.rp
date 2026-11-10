
/* =========================================================
   ZONE-431 — GESTION DE L'ORGANISATION
   Administration STAFF + permissions départementales
   ========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = null;
let currentRole = null;
let isAdmin = false;
let canManageAllDepartments = false;
let departments = [];
let nodes = [];
let permissions = new Set();
let editingRecord = null;

const $ = id => document.getElementById(id);

function normalizeRole(value) {
    return String(value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
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

function showMessage(message, isError = false) {
    const element = $("globalMessage");
    element.textContent = message;
    element.style.color = isError ? "#ef858c" : "#83b895";
}

function canEditDepartment(code) {
    return isAdmin || canManageAllDepartments || permissions.has(code);
}


async function checkAccess() {
    try {
        const { data: sessionData, error: sessionError } =
            await db.auth.getSession();

        if (sessionError) throw sessionError;

        if (!sessionData.session) {
            console.error("[ZONE-431] Aucune session Supabase.");
            window.location.replace("../accueil.html");
            return false;
        }

        currentUser = sessionData.session.user;

        const { data: moduleAccess, error: moduleAccessError } = await db.rpc(
            "has_staff_module_permission",
            { p_module_code: "departments", p_action: "access" }
        );

        if (moduleAccessError) throw moduleAccessError;

        if (moduleAccess !== true) {
            console.error("[ZONE-431] Permission d'accès au module Départements refusée.");
            window.location.replace("../accueil.html");
            return false;
        }

        const { data: roleData } = await db.rpc("current_staff_role");

        let role = roleData;
        if (Array.isArray(role)) role = role[0];

        if (role && typeof role === "object") {
            role = role.role || role.current_staff_role || role.staff_role || null;
        }

        currentRole = normalizeRole(role);
        isAdmin = ["ADMIN", "ADMINISTRATEUR"].includes(currentRole);

        $("staffRole").textContent = currentRole || "ACCÈS INDIVIDUEL";

        console.info("[ZONE-431] Accès module Départements autorisé.");

        return true;

    } catch (error) {
        console.error("[ZONE-431] Échec de vérification :", error);
        showMessage(
            "Impossible de vérifier les autorisations : " + error.message,
            true
        );
        return false;
    }
}

async function loadPermissions() {
    permissions.clear();
    const { data: canWrite, error: writeError } = await db.rpc("has_staff_module_permission", {
        p_module_code: "departments",
        p_action: "write"
    });
    if (writeError) throw writeError;
    canManageAllDepartments = canWrite === true;
    if (isAdmin || canManageAllDepartments) return;
    for (const department of departments) {
        const { data, error } = await db.rpc("has_rp_permission", {
            p_permission_code: "department_info.manage",
            p_department_code: department.code
        });
        if (!error && data === true) permissions.add(department.code);
    }
}

async function loadOrganization() {
    const [departmentResult, nodeResult] = await Promise.all([
        db.from("rp_departments")
            .select("code,name,description,responsible,additional_info,updated_at")
            .order("code"),

        db.from("rp_organization_nodes")
            .select("code,parent_code,root_department_code,node_type,title,description,additional_info,sort_order,is_published,updated_at")
            .order("sort_order")
    ]);

    if (departmentResult.error) throw departmentResult.error;
    if (nodeResult.error) throw nodeResult.error;

    departments = departmentResult.data || [];
    nodes = nodeResult.data || [];

    await loadPermissions();
    renderOrganization();

    const editableCount = (isAdmin || canManageAllDepartments) ? "tous les éléments" : `${permissions.size} département(s)`;

    $("permissionMessage").textContent = isAdmin
        ? "Vous disposez des droits administrateur complets sur l'organisation."
        : `Consultation générale. Modification autorisée pour : ${editableCount}.`;

    $("addNodeButton").hidden = !isAdmin && permissions.size === 0;
}

function renderOrganization() {
    renderDepartments();
    renderNodes();
}

function createCard(code, title, description, canEdit, statusText = "") {
    const article = document.createElement("article");
    article.className = "organization-card";

    const main = document.createElement("div");
    main.className = "organization-card-main";

    const codeElement = document.createElement("span");
    codeElement.className = "organization-card-code";
    codeElement.textContent = code;

    const titleElement = document.createElement("h3");
    titleElement.textContent = title;

    const descriptionElement = document.createElement("p");
    descriptionElement.textContent = description || "Aucune description renseignée.";

    main.append(codeElement, titleElement, descriptionElement);

    const actions = document.createElement("div");
    actions.className = "organization-card-actions";

    if (statusText) {
        const status = document.createElement("span");
        status.className = `status ${statusText === "PUBLIÉ" ? "published" : ""}`;
        status.textContent = statusText;
        actions.appendChild(status);
    }

    if (canEdit) {
        const button = document.createElement("button");
        button.className = "edit-button";
        button.textContent = "MODIFIER";
        button.addEventListener("click", () => openEditor(code));
        actions.appendChild(button);
    }

    article.append(main, actions);
    return article;
}

function renderDepartments() {
    const container = $("departmentsContainer");
    container.replaceChildren();

    departments.forEach(department => {
        const editable = canEditDepartment(department.code);

        container.appendChild(
            createCard(
                department.code,
                department.name,
                department.description,
                editable,
                editable ? "MODIFIABLE" : "LECTURE SEULE"
            )
        );
    });
}

function renderNodes() {
    const container = $("nodesContainer");
    container.replaceChildren();

    nodes.forEach(node => {
        const editable = isAdmin || canManageAllDepartments ||
            (node.root_department_code && permissions.has(node.root_department_code));

        const parent = departments.find(item => item.code === node.parent_code)
            || nodes.find(item => item.code === node.parent_code);

        const description = [
            node.node_type.toUpperCase(),
            parent ? `Rattaché à ${parent.name || parent.title}` : "",
            node.description
        ].filter(Boolean).join(" — ");

        container.appendChild(
            createCard(
                node.code,
                node.title,
                description,
                editable,
                node.is_published ? "PUBLIÉ" : "NON PUBLIÉ"
            )
        );
    });
}

function openEditor(code = null) {
    editingRecord = code
        ? departments.find(item => item.code === code) ||
          nodes.find(item => item.code === code)
        : null;

    const isDepartment = editingRecord && "name" in editingRecord;
    const isNode = editingRecord && "title" in editingRecord;

    $("organizationForm").reset();

    $("recordKind").value = isDepartment ? "department" : "node";
    $("originalCode").value = editingRecord?.code || "";

    $("modalTitle").textContent = editingRecord
        ? "Modifier un élément"
        : "Créer un élément";

    $("nodeFields").hidden = isDepartment;
    $("responsibleField").hidden = !isDepartment;
    $("sortOrderField").hidden = isDepartment;

    $("deleteButton").hidden = !isNode || !isAdmin && !permissions.has(editingRecord.root_department_code);

    $("fieldCode").disabled = Boolean(editingRecord);
    $("fieldCode").value = editingRecord?.code || "";
    $("fieldTitle").value = editingRecord?.name || editingRecord?.title || "";
    $("fieldDescription").value = editingRecord?.description || "";
    $("fieldAdditional").value = editingRecord?.additional_info || "";
    $("fieldResponsible").value = editingRecord?.responsible || "";
    $("fieldSortOrder").value = editingRecord?.sort_order ?? 10;
    $("fieldPublished").checked = editingRecord?.is_published ?? true;

    $("fieldType").value = editingRecord?.node_type || "subdivision";

    populateParentOptions(editingRecord);
    populateDepartmentOptions(editingRecord);

    if (!editingRecord && !isAdmin && permissions.size) {
        const firstPermission = [...permissions][0];
        $("fieldRootDepartment").value = firstPermission;
        $("fieldRootDepartment").disabled = true;
        $("fieldParent").value = firstPermission;
        $("fieldParent").disabled = true;
    } else {
        $("fieldRootDepartment").disabled = false;
        $("fieldParent").disabled = false;
    }

    if (editingRecord && isNode) {
        $("fieldParent").value = editingRecord.parent_code || "";
        $("fieldRootDepartment").value = editingRecord.root_department_code || "";
    }

    $("organizationModal").showModal();
}

function populateParentOptions(record) {
    const select = $("fieldParent");
    select.replaceChildren();

    const empty = document.createElement("option");
    empty.value = "";
    empty.textContent = "Aucun parent — élément racine";
    select.appendChild(empty);

    departments.forEach(department => {
        const option = document.createElement("option");
        option.value = department.code;
        option.textContent = `${department.code} — ${department.name}`;
        select.appendChild(option);
    });

    nodes.forEach(node => {
        if (record && node.code === record.code) return;

        const option = document.createElement("option");
        option.value = node.code;
        option.textContent = `${node.code} — ${node.title}`;
        select.appendChild(option);
    });
}

function populateDepartmentOptions(record) {
    const select = $("fieldRootDepartment");
    select.replaceChildren();

    const none = document.createElement("option");
    none.value = "";
    none.textContent = "Aucun — réservé à l'administration";
    select.appendChild(none);

    departments.forEach(department => {
        if (!isAdmin && !permissions.has(department.code) &&
            record?.root_department_code !== department.code) return;

        const option = document.createElement("option");
        option.value = department.code;
        option.textContent = `${department.code} — ${department.name}`;
        select.appendChild(option);
    });
}

async function saveDepartment() {
    const payload = {
        name: $("fieldTitle").value.trim(),
        description: $("fieldDescription").value.trim(),
        responsible: $("fieldResponsible").value.trim(),
        additional_info: $("fieldAdditional").value.trim(),
        updated_at: new Date().toISOString(),
        updated_by: currentUser.id
    };

    const { error } = await db
        .from("rp_departments")
        .update(payload)
        .eq("code", editingRecord.code);

    if (error) throw error;
}

async function saveNode() {
    const code = $("fieldCode").value.trim().toUpperCase();
    const rootDepartment = $("fieldRootDepartment").value || null;
    const parentCode = $("fieldParent").value || null;

    if (!code) throw new Error("Le code de l'élément est obligatoire.");

    if (!isAdmin) {
        if (!rootDepartment || !permissions.has(rootDepartment)) {
            throw new Error("Vous ne disposez pas des droits pour ce département.");
        }

        if (editingRecord && editingRecord.root_department_code !== rootDepartment) {
            throw new Error("Vous ne pouvez pas déplacer cet élément vers un autre département.");
        }
    }

    const payload = {
        code,
        parent_code: parentCode,
        root_department_code: rootDepartment,
        node_type: $("fieldType").value,
        title: $("fieldTitle").value.trim(),
        description: $("fieldDescription").value.trim(),
        additional_info: $("fieldAdditional").value.trim(),
        sort_order: Number($("fieldSortOrder").value) || 0,
        is_published: $("fieldPublished").checked,
        updated_at: new Date().toISOString(),
        updated_by: currentUser.id
    };

    if (!payload.title) throw new Error("Le nom de l'élément est obligatoire.");

    let result;

    if (editingRecord) {
        result = await db
            .from("rp_organization_nodes")
            .update(payload)
            .eq("code", editingRecord.code);
    } else {
        result = await db
            .from("rp_organization_nodes")
            .insert(payload);
    }

    if (result.error) throw result.error;
}

async function saveCurrentRecord(event) {
    event.preventDefault();

    const saveButton = $("saveButton");
    saveButton.disabled = true;
    saveButton.textContent = "ENREGISTREMENT...";

    try {
        if ($("recordKind").value === "department") {
            await saveDepartment();
        } else {
            await saveNode();
        }

        $("organizationModal").close();
        showMessage("Les modifications ont été enregistrées.");
        await loadOrganization();
    } catch (error) {
        console.error(error);
        showMessage(error.message || "Une erreur est survenue.", true);
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "ENREGISTRER";
    }
}

async function deleteCurrentNode() {
    if (!editingRecord || !("title" in editingRecord)) return;

    const confirmed = window.confirm(
        `Supprimer définitivement « ${editingRecord.title} » ?`
    );

    if (!confirmed) return;

    try {
        const { error } = await db
            .from("rp_organization_nodes")
            .delete()
            .eq("code", editingRecord.code);

        if (error) throw error;

        $("organizationModal").close();
        showMessage("L'élément a été supprimé.");
        await loadOrganization();
    } catch (error) {
        console.error(error);
        showMessage(error.message || "Suppression impossible.", true);
    }
}

function filterOrganization() {
    const query = $("searchOrganization").value.trim().toLowerCase();

    document.querySelectorAll(".organization-card").forEach(card => {
        const content = card.textContent.toLowerCase();
        card.hidden = !content.includes(query);
    });
}

async function initialize() {
    try {
        const accessGranted = await checkAccess();
        if (!accessGranted) return;

        await loadOrganization();

        $("organizationForm").addEventListener("submit", saveCurrentRecord);
        $("closeModal").addEventListener("click", () => $("organizationModal").close());
        $("cancelButton").addEventListener("click", () => $("organizationModal").close());
        $("deleteButton").addEventListener("click", deleteCurrentNode);
        $("refreshButton").addEventListener("click", loadOrganization);
        $("searchOrganization").addEventListener("input", filterOrganization);
        $("addNodeButton").addEventListener("click", () => openEditor());

        console.info("[ZONE-431] Administration organisationnelle initialisée.");
    } catch (error) {
        console.error("[ZONE-431] Initialisation impossible :", error);
        showMessage(error.message || "Impossible de charger l'organisation.", true);
    }
}

document.addEventListener("DOMContentLoaded", initialize);
