
/* =========================================================
   ZONE-431 — ORGANISATION PUBLIQUE
   Chargement dynamique depuis Supabase
   ========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const NODE_TYPES = {
    structure: "STRUCTURE",
    filiere: "FILIÈRE",
    subdivision: "SUBDIVISION",
    bureau: "BUREAU",
    classe: "CLASSE",
    unite: "UNITÉ",
    composante: "COMPOSANTE"
};

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, character => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function sortItems(items) {
    return [...items].sort((a, b) => {
        const orderDifference = (a.sort_order ?? 0) - (b.sort_order ?? 0);

        if (orderDifference !== 0) return orderDifference;

        return String(a.name || a.title || a.code)
            .localeCompare(String(b.name || b.title || b.code), "fr");
    });
}

/* =========================================================
   MODALE D'INFORMATION
   ========================================================= */

function createModal() {
    let modal = document.getElementById("departmentModal");

    if (modal) return modal;

    modal = document.createElement("dialog");
    modal.id = "departmentModal";
    modal.className = "department-modal";

    modal.innerHTML = `
        <div class="department-modal-content">

            <div class="department-modal-header">
                <div>
                    <span class="department-modal-label">
                        ZONE-431 / ORGANISATION
                    </span>

                    <span id="modalCategory"
                        class="department-modal-category"></span>
                </div>

                <button type="button"
                    class="department-modal-close"
                    id="closeDepartmentModal"
                    aria-label="Fermer">×</button>
            </div>

            <div class="department-modal-body">

                <div class="department-modal-reference">
                    FICHE ORGANISATIONNELLE
                </div>

                <h2 id="modalTitle">Informations</h2>

                <div id="modalParentContainer"
                    class="department-modal-parent"
                    hidden>
                    <span>RATTACHEMENT</span>
                    <strong id="modalParent"></strong>
                </div>

                <div class="department-modal-description">
                    <span class="department-modal-section-title">
                        DESCRIPTION
                    </span>

                    <p id="modalDescription"></p>
                </div>

                <div id="modalAdditionalContainer"
                    class="department-modal-description"
                    hidden>
                    <span class="department-modal-section-title">
                        INFORMATIONS COMPLÉMENTAIRES
                    </span>

                    <p id="modalAdditional"></p>
                </div>

                <div id="modalResponsibleContainer"
                    class="department-modal-parent"
                    hidden>
                    <span>RESPONSABLE</span>
                    <strong id="modalResponsible"></strong>
                </div>

                <div class="department-modal-footer">
                    <span>DOCUMENT INTERNE — HRP</span>
                    <span>ZONE-431</span>
                </div>

            </div>
        </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#closeDepartmentModal")
        .addEventListener("click", () => modal.close());

    modal.addEventListener("click", event => {
        if (event.target === modal) modal.close();
    });

    return modal;
}

function openInformation(item, parentName = "") {
    const modal = createModal();

    const title = item.name || item.title || item.code;

    modal.querySelector("#modalTitle").textContent = title;

    modal.querySelector("#modalCategory").textContent =
        item.category ||
        NODE_TYPES[item.node_type] ||
        "DÉPARTEMENT";

    const parentContainer = modal.querySelector("#modalParentContainer");

    parentContainer.hidden = !parentName;

    modal.querySelector("#modalParent").textContent = parentName;

    modal.querySelector("#modalDescription").textContent =
        item.description?.trim() ||
        "Aucune description détaillée n'a encore été publiée pour cette rubrique.";

    const additionalContainer =
        modal.querySelector("#modalAdditionalContainer");

    additionalContainer.hidden = !item.additional_info?.trim();

    modal.querySelector("#modalAdditional").textContent =
        item.additional_info || "";

    const responsibleContainer =
        modal.querySelector("#modalResponsibleContainer");

    responsibleContainer.hidden = !item.responsible?.trim();

    modal.querySelector("#modalResponsible").textContent =
        item.responsible || "";

    modal.showModal();
}

/* =========================================================
   CARTES
   ========================================================= */

function createSubdivisionCard(item, parentName) {
    const card = document.createElement("div");

    card.className = "subdivision-card";
    card.dataset.code = item.code;
    card.tabIndex = 0;
    card.setAttribute("role", "button");

    const type = NODE_TYPES[item.node_type] || "ÉLÉMENT";

    card.innerHTML = `
        <span class="subdivision-code">
            ${escapeHTML(String(item.sort_order ?? 0).padStart(2, "0"))}
        </span>

        <strong>${escapeHTML(item.name || item.title || item.code)}</strong>

        <small>${escapeHTML(type)}</small>
    `;

    const activate = () => openInformation({
        ...item,
        category: type
    }, parentName);

    card.addEventListener("click", activate);

    card.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activate();
        }
    });

    return card;
}

function createModule(item, children, category, parentName = "") {
    const article = document.createElement("article");

    article.className = "department-module";
    article.id = `org-${String(item.code).replace(/[^a-zA-Z0-9]/g, "-")}`;

    const title = item.name || item.title || item.code;
    const description = item.description?.trim() || "";

    const header = document.createElement("div");

    header.className = "module-header";
    header.tabIndex = 0;
    header.setAttribute("role", "button");

    header.innerHTML = `
        <div class="module-identity">
            <span class="module-code">
                ${escapeHTML(item.code)}
            </span>

            <div>
                <span class="module-category">
                    ${escapeHTML(category)}
                </span>

                <h3>${escapeHTML(title)}</h3>
            </div>
        </div>

        <span class="module-index">
            ${children.length.toString().padStart(3, "0")} ÉLÉMENT(S)
        </span>
    `;

    const activateHeader = () => openInformation({
        ...item,
        category
    }, parentName);

    header.addEventListener("click", activateHeader);

    header.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            activateHeader();
        }
    });

    const content = document.createElement("div");
    content.className = "module-content";

    const descriptionBlock = document.createElement("div");
    descriptionBlock.className = "module-description";

    descriptionBlock.innerHTML = `
        <span class="content-label">PRÉSENTATION</span>

        <p>
            ${escapeHTML(
                description ||
                "Aucune présentation détaillée n'a encore été publiée."
            )}
        </p>
    `;

    content.appendChild(descriptionBlock);

    const subdivisionContainer = document.createElement("div");
    subdivisionContainer.className = "subdivision-container";

    const label = document.createElement("span");
    label.className = "content-label";

    label.textContent = children.length
        ? "SUBDIVISIONS ET COMPOSANTES"
        : "ORGANISATION";

    subdivisionContainer.appendChild(label);

    if (children.length) {
        const grid = document.createElement("div");

        grid.className = "subdivision-grid";

        if (children.length >= 4) {
            grid.classList.add("four-columns");
        }

        children.forEach(child => {
            grid.appendChild(createSubdivisionCard(child, title));
        });

        subdivisionContainer.appendChild(grid);
    } else {
        const empty = document.createElement("p");

        empty.className = "module-description";
        empty.textContent =
            "Aucune subdivision renseignée pour le moment.";

        subdivisionContainer.appendChild(empty);
    }

    content.appendChild(subdivisionContainer);

    article.append(header, content);

    return article;
}

/* =========================================================
   CONSTRUCTION DE L'ORGANISATION
   ========================================================= */

function renderOrganization(departments, nodes) {
    const departmentList = document.getElementById("departmentList");
    const branchList = document.getElementById("branchList");

    departmentList.replaceChildren();
    branchList.replaceChildren();

    const childrenByParent = new Map();

    nodes.forEach(node => {
        if (!node.parent_code) return;

        if (!childrenByParent.has(node.parent_code)) {
            childrenByParent.set(node.parent_code, []);
        }

        childrenByParent.get(node.parent_code).push(node);
    });

    function getChildren(parentCode) {
        return sortItems(childrenByParent.get(parentCode) || []);
    }

    function getDepartmentChildren(parentCode) {
        return getChildren(parentCode);
    }

    // Départements enregistrés dans rp_departments.
    sortItems(departments).forEach(department => {
        const children = getDepartmentChildren(department.code);

        departmentList.appendChild(
            createModule(
                department,
                children,
                "DÉPARTEMENT"
            )
        );
    });

    // Éléments racines qui ne sont pas des départements.
    // Exemples : ZC, FIM, GDI et futures filières.
    const rootNodes = sortItems(
        nodes.filter(node => !node.parent_code)
    );

    rootNodes.forEach(root => {
        const children = getChildren(root.code);

        const category =
            NODE_TYPES[root.node_type] || "STRUCTURE";

        const target = root.node_type === "filiere"
            ? branchList
            : departmentList;

        target.appendChild(
            createModule(
                root,
                children,
                category
            )
        );
    });

    if (!departmentList.children.length) {
        departmentList.textContent =
            "Aucun département ou structure publié.";
    }

    if (!branchList.children.length) {
        branchList.textContent =
            "Aucune filière publiée.";
    }
}

/* =========================================================
   CHARGEMENT SUPABASE
   ========================================================= */

async function loadOrganization() {
    const departmentList = document.getElementById("departmentList");
    const branchList = document.getElementById("branchList");

    departmentList.textContent = "Chargement des départements...";
    branchList.textContent = "Chargement des filières...";

    try {
        const [departmentResult, nodeResult] = await Promise.all([
            db.from("rp_departments")
                .select("code,name,description,responsible,additional_info")
                .order("code"),

            db.from("rp_organization_nodes")
                .select(`
                    code,
                    parent_code,
                    root_department_code,
                    node_type,
                    title,
                    description,
                    additional_info,
                    sort_order,
                    is_published
                `)
                .eq("is_published", true)
                .order("sort_order")
        ]);

        if (departmentResult.error) {
            throw new Error(
                `Départements : ${departmentResult.error.message}`
            );
        }

        if (nodeResult.error) {
            throw new Error(
                `Organisation : ${nodeResult.error.message}`
            );
        }

        renderOrganization(
            departmentResult.data || [],
            nodeResult.data || []
        );

        console.info(
            "[ZONE-431] Organisation chargée :",
            departmentResult.data?.length || 0,
            "départements,",
            nodeResult.data?.length || 0,
            "éléments."
        );

    } catch (error) {
        console.error("[ZONE-431] Erreur :", error);

        departmentList.textContent =
            "Impossible de charger les départements.";

        branchList.textContent =
            "Impossible de charger les filières.";
    }
}

/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    createModal();
    loadOrganization();
});
