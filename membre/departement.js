/* =========================================================
   ZONE-431 — MON DÉPARTEMENT
   Données personnelles et organisation publiée
   ========================================================= */

(() => {
    "use strict";

    const auth = window.Zone431Auth;

    const elements = {
        identity: document.getElementById("departmentIdentity"),
        primaryDepartment: document.getElementById("primaryDepartment"),
        departmentList: document.getElementById("departmentList"),
        loading: document.getElementById("departmentLoading"),
        error: document.getElementById("departmentError"),
        errorText: document.getElementById("departmentErrorText"),
        empty: document.getElementById("departmentEmpty"),
        display: document.getElementById("departmentDisplay"),
        selectedName: document.getElementById("selectedDepartmentName"),
        selectedType: document.getElementById("selectedDepartmentType"),
        selectedCode: document.getElementById("selectedDepartmentCode"),
        nodeCount: document.getElementById("departmentNodeCount"),
        grade: document.getElementById("memberGrade"),
        accreditation: document.getElementById("memberAccreditation"),
        divisionWrap: document.getElementById("memberDivisionWrap"),
        division: document.getElementById("memberDivision"),
        structure: document.getElementById("departmentStructure"),
        structureEmpty: document.getElementById("departmentStructureEmpty"),
        retry: document.getElementById("retryButton")
    };

    const state = {
        assignments: [],
        departments: [],
        nodes: [],
        selectedCode: null,
        primaryCode: null
    };

    const icons = {
        "D.SE": "fa-shield-halved",
        "D.SCI": "fa-flask",
        "D.M": "fa-kit-medical",
        "DI&ST": "fa-microchip",
        "D.A": "fa-scale-balanced",
        "FIM": "fa-person-military-rifle",
        "GDI": "fa-network-wired"
    };

    const normalize = value => String(value || "").trim();

    function show(view) {
        [elements.loading, elements.error, elements.empty, elements.display]
            .forEach(item => { item.hidden = item !== view; });
    }

    function showError(message) {
        elements.errorText.textContent = message;
        show(elements.error);
    }

    function getAssignment(code) {
        return state.assignments.find(item => item.department_code === code) || null;
    }

    function getDepartment(code) {
        return state.departments.find(item => item.code === code) || null;
    }

    function getNode(code) {
        return state.nodes.find(item => item.code === code) || null;
    }

    function getDepartmentTitle(code) {
        const department = getDepartment(code);
        if (department?.name) return department.name;
        const rootNode = getNode(code);
        return rootNode?.title || code;
    }

    function getDepartmentIcon(code) {
        return icons[code] || "fa-building";
    }

    function createAssignmentButton(assignment) {
        const code = assignment.department_code;
        const button = document.createElement("button");
        button.type = "button";
        button.className = "department-nav-button";
        button.classList.toggle("active", code === state.selectedCode);

        const icon = document.createElement("i");
        icon.className = "fa-solid " + getDepartmentIcon(code);

        const text = document.createElement("span");
        text.className = "department-nav-label";

        const title = document.createElement("strong");
        title.textContent = code;

        const type = document.createElement("small");
        type.textContent = assignment.assignment_type === "primary"
            ? "AFFECTATION PRINCIPALE"
            : "AFFECTATION SECONDAIRE";

        text.append(title, type);
        button.append(icon, text);
        button.addEventListener("click", () => selectDepartment(code));
        return button;
    }

    function renderAssignmentList() {
        elements.departmentList.replaceChildren();
        state.assignments.forEach(assignment => {
            elements.departmentList.appendChild(createAssignmentButton(assignment));
        });
    }

    function renderStructure(code) {
        elements.structure.replaceChildren();

        const entries = state.nodes
            .filter(node =>
                node.code !== code &&
                (node.root_department_code === code || node.parent_code === code)
            )
            .sort((a, b) =>
                (a.sort_order || 0) - (b.sort_order || 0) ||
                String(a.title || a.code).localeCompare(String(b.title || b.code), "fr")
            );

        elements.nodeCount.textContent =
            entries.length + (entries.length > 1 ? " ÉLÉMENTS" : " ÉLÉMENT");
        elements.structureEmpty.hidden = entries.length > 0;

        entries.forEach(node => {
            const item = document.createElement("article");
            item.className = "structure-item";

            const icon = document.createElement("div");
            icon.className = "structure-item-icon";
            const iconElement = document.createElement("i");
            iconElement.className = "fa-solid " +
                (node.node_type === "bureau" ? "fa-briefcase" :
                node.node_type === "unite" ? "fa-users" : "fa-sitemap");
            icon.appendChild(iconElement);

            const content = document.createElement("div");
            content.className = "structure-item-content";

            const title = document.createElement("strong");
            title.textContent = node.title || node.code;

            const codeLabel = document.createElement("span");
            codeLabel.textContent = node.code;

            content.append(title, codeLabel);
            item.append(icon, content);
            elements.structure.appendChild(item);
        });
    }

    function selectDepartment(code) {
        const assignment = getAssignment(code);
        if (!assignment) return;

        state.selectedCode = code;
        const department = getDepartment(code);

        elements.selectedName.textContent = getDepartmentTitle(code);
        elements.selectedCode.textContent = code;
        elements.selectedType.textContent =
            assignment.assignment_type === "primary"
                ? "AFFECTATION PRINCIPALE"
                : "AFFECTATION SECONDAIRE";

        elements.grade.textContent = normalize(assignment.grade) || "Non renseigné";
        elements.accreditation.textContent =
            normalize(assignment.accreditation) || "ACC 0";

        const division = normalize(assignment.division_code);
        const divisionNode = division ? getNode(division) : null;
        elements.divisionWrap.hidden = !division;
        elements.division.textContent = divisionNode?.title || division || "Non renseigné";

        renderStructure(code);
        renderAssignmentList();
        show(elements.display);

        if (department?.description && !/^test$/i.test(department.description.trim())) {
            // Description disponible dans le catalogue, mais non affichée dans cette vue compacte.
        }
    }

    async function loadDepartment() {
        show(elements.loading);

        try {
            if (!auth) {
                throw new Error("Le système d'authentification est indisponible.");
            }

            const access = await auth.protectPage();
            if (!access || access.status !== "authorized") return;

            const userId = access.user.id;
            const client = auth.client;

            const { data: assignments, error: assignmentsError } = await client
                .from("rp_member_department_assignments")
                .select("assignment_type, department_code, division_code, grade, accreditation, position")
                .eq("user_id", userId)
                .order("position", { ascending: true });

            if (assignmentsError) throw assignmentsError;

            state.assignments = (assignments || [])
                .filter(item => normalize(item.department_code))
                .sort((a, b) => {
                    if (a.assignment_type === "primary" && b.assignment_type !== "primary") return -1;
                    if (b.assignment_type === "primary" && a.assignment_type !== "primary") return 1;
                    return (a.position || 0) - (b.position || 0);
                });

            state.primaryCode =
                state.assignments.find(item => item.assignment_type === "primary")?.department_code ||
                normalize(access.profile?.department) || null;

            if (!state.assignments.length && state.primaryCode) {
                state.assignments.push({
                    assignment_type: "primary",
                    department_code: state.primaryCode,
                    grade: access.profile?.grade || "",
                    accreditation: access.profile?.accreditation || "ACC 0",
                    division_code: null
                });
            }

            if (!state.assignments.length) {
                elements.departmentList.replaceChildren();
                show(elements.empty);
                return;
            }

            const codes = [...new Set(state.assignments.map(item => item.department_code))];

            const [departmentResult, nodeResult] = await Promise.all([
                client.from("rp_departments")
                    .select("code, name, description")
                    .in("code", codes),
                client.from("rp_organization_nodes")
                    .select("code, parent_code, root_department_code, node_type, title, sort_order")
                    .eq("is_published", true)
            ]);

            if (departmentResult.error) throw departmentResult.error;
            if (nodeResult.error) throw nodeResult.error;

            state.departments = departmentResult.data || [];
            state.nodes = nodeResult.data || [];

            elements.primaryDepartment.textContent = state.primaryCode
                ? getDepartmentTitle(state.primaryCode)
                : "Département non renseigné";
            elements.identity.hidden = !state.primaryCode;

            renderAssignmentList();
            selectDepartment(codes.includes(state.primaryCode) ? state.primaryCode : codes[0]);

        } catch (error) {
            console.error("[ZONE-431] Erreur Mon département :", error);
            showError("Impossible de récupérer votre dossier départemental. Vérifiez votre connexion puis réessayez.");
        }
    }

    elements.retry.addEventListener("click", loadDepartment);

    if (auth?.subscribe) {
        auth.subscribe((event, session) => {
            if (event === "SIGNED_OUT" || !session) {
                window.location.replace("accueil.html");
            }
        });
    }

    loadDepartment();
})();