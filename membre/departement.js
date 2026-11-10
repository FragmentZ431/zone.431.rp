
/* =========================================================
   ZONE-431 — INFORMATIONS DÉPARTEMENTALES
   Fichier : membre/departement.js
   ========================================================= */

(() => {
    "use strict";

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
        documentCount: document.getElementById("documentCount"),
        description: document.getElementById("departmentDescription"),
        documents: document.getElementById("departmentDocuments"),

        retryButton: document.getElementById("retryButton")
    };

    const state = {
        access: null,
        departments: [],
        documents: [],
        selectedDepartment: null
    };

    const departmentIcons = {
        "D.SE": "fa-shield-halved",
        "D.SCI": "fa-flask",
        "D.M": "fa-kit-medical",
        "DI&ST": "fa-microchip",
        "D.A": "fa-scale-balanced",
        "ZC": "fa-building"
    };

    function normalizeCode(code) {
        return String(code || "").trim();
    }

    function getDepartmentIcon(code) {
        return departmentIcons[normalizeCode(code)] || "fa-building";
    }

    function setVisible(element, visible) {
        element.hidden = !visible;
    }

    function showLoading() {
        setVisible(elements.loading, true);
        setVisible(elements.error, false);
        setVisible(elements.empty, false);
        setVisible(elements.display, false);
    }

    function showError(message) {
        setVisible(elements.loading, false);
        setVisible(elements.error, true);
        setVisible(elements.empty, false);
        setVisible(elements.display, false);

        elements.errorText.textContent =
            message || "Une erreur inconnue est survenue.";
    }

    function showEmpty() {
        setVisible(elements.loading, false);
        setVisible(elements.error, false);
        setVisible(elements.empty, true);
        setVisible(elements.display, false);
    }

    function formatDate(value) {
        if (!value) return "";

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return "";
        }

        return new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function createDepartmentButton(code) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "department-nav-button";

        if (code === state.selectedDepartment) {
            button.classList.add("active");
        }

        const icon = document.createElement("i");
        icon.className = `fa-solid ${getDepartmentIcon(code)}`;

        const label = document.createElement("span");
        label.textContent = code;

        button.append(icon, label);

        button.addEventListener("click", () => {
            selectDepartment(code);
        });

        return button;
    }

    function renderDepartmentList() {
        elements.departmentList.replaceChildren();

        state.departments.forEach((code) => {
            elements.departmentList.appendChild(
                createDepartmentButton(code)
            );
        });
    }

    function renderDocuments(documents) {
        elements.documents.replaceChildren();

        if (!documents.length) {
            const message = document.createElement("div");
            message.className = "department-message";

            const iconContainer = document.createElement("div");
            iconContainer.className = "message-icon";

            const icon = document.createElement("i");
            icon.className = "fa-solid fa-folder-open";

            iconContainer.appendChild(icon);

            const eyebrow = document.createElement("p");
            eyebrow.className = "section-eyebrow";
            eyebrow.textContent = "RESSOURCES DÉPARTEMENTALES";

            const title = document.createElement("h2");
            title.textContent = "AUCUNE INFORMATION DISPONIBLE";

            const description = document.createElement("p");
            description.textContent =
                "Aucune information publiée n'est actuellement disponible pour ce département.";

            message.append(
                iconContainer,
                eyebrow,
                title,
                description
            );

            elements.documents.appendChild(message);
            return;
        }

        documents.forEach((documentData) => {
            const article = document.createElement("article");
            article.className = "department-document";

            const header = document.createElement("div");
            header.className = "document-header";

            const iconContainer = document.createElement("div");
            iconContainer.className = "document-icon";

            const icon = document.createElement("i");
            icon.className = "fa-solid fa-file-lines";

            iconContainer.appendChild(icon);

            const heading = document.createElement("div");
            heading.className = "document-heading";

            const title = document.createElement("h3");
            title.textContent = documentData.title || "Information sans titre";

            const category = document.createElement("span");
            category.textContent = state.selectedDepartment;

            heading.append(title, category);
            header.append(iconContainer, heading);
            article.appendChild(header);

            if (documentData.summary) {
                const summary = document.createElement("p");
                summary.className = "document-summary";
                summary.textContent = documentData.summary;
                article.appendChild(summary);
            }

            if (documentData.content) {
                const content = document.createElement("div");
                content.className = "document-content";
                content.textContent = documentData.content;
                article.appendChild(content);
            }

            const dateValue = documentData.updated_at || documentData.created_at;
            const dateText = formatDate(dateValue);

            if (dateText) {
                const date = document.createElement("span");
                date.className = "document-date";
                date.textContent = `DERNIÈRE MISE À JOUR : ${dateText}`;
                article.appendChild(date);
            }

            elements.documents.appendChild(article);
        });
    }

    function selectDepartment(code) {
        if (!state.departments.includes(code)) {
            return;
        }

        state.selectedDepartment = code;

        const documents = state.documents.filter(
            (item) => normalizeCode(item.department_code) === code
        );

        elements.selectedName.textContent = code;

        elements.documentCount.textContent =
            `${documents.length} ${documents.length > 1 ? "DOCUMENTS" : "DOCUMENT"}`;

        renderDepartmentList();
        renderDocuments(documents);

        setVisible(elements.loading, false);
        setVisible(elements.error, false);
        setVisible(elements.empty, false);
        setVisible(elements.display, true);

        elements.description.textContent = "";
        setVisible(elements.description, false);

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
    }

    async function loadDepartmentInformation() {
        showLoading();

        try {
            if (!window.Zone431Auth) {
                throw new Error(
                    "Le système d'authentification Zone-431 est indisponible."
                );
            }

            const access = await window.Zone431Auth.protectPage();

            if (!access) {
                return;
            }

            state.access = access;

            const userId = access.user.id;
            const client = window.Zone431Auth.client;

            /*
             * Les départements sont désormais enregistrés dans
             * rp_member_department_assignments par la gestion des comptes.
             * Cette page doit lire cette même table pour récupérer
             * le département principal et tous les départements additionnels.
             */
            const { data: assignments, error: assignmentsError } =
                await client
                    .from("rp_member_department_assignments")
                    .select("assignment_type, department_code, position")
                    .eq("user_id", userId)
                    .order("position", { ascending: true });

            if (assignmentsError) {
                throw assignmentsError;
            }

            const primaryAssignment = (assignments || []).find(
                (assignment) => assignment.assignment_type === "primary"
            );

            const primaryCode = normalizeCode(
                primaryAssignment?.department_code || access.profile.department
            );

            const accessibleCodes = new Set();

            if (primaryCode) {
                accessibleCodes.add(primaryCode);
            }

            (assignments || []).forEach((assignment) => {
                const code = normalizeCode(assignment.department_code);

                if (code) {
                    accessibleCodes.add(code);
                }
            });

            // Le département principal reste en premier dans la navigation.
            state.departments = Array.from(accessibleCodes);

            elements.primaryDepartment.textContent =
                primaryCode || "Département non renseigné";

            setVisible(elements.identity, Boolean(primaryCode));

            if (!state.departments.length) {
                elements.departmentList.replaceChildren();
                showEmpty();
                return;
            }

            /*
             * Récupération des informations publiées.
             */
            const { data: documents, error: documentsError } =
                await client
                    .from("member_department_info")
                    .select(`
                        id,
                        department_code,
                        title,
                        summary,
                        content,
                        sort_order,
                        created_at,
                        updated_at
                    `)
                    .in("department_code", state.departments)
                    .eq("is_published", true)
                    .order("sort_order", { ascending: true })
                    .order("created_at", { ascending: false });

            if (documentsError) {
                throw documentsError;
            }

            state.documents = documents || [];

            renderDepartmentList();

            selectDepartment(state.departments[0]);

        } catch (error) {
            console.error(
                "[ZONE-431] Erreur de chargement départemental :",
                error
            );

            showError(
                "Impossible de récupérer les informations départementales. " +
                "Vérifiez votre connexion ou contactez l'administration."
            );
        }
    }

    elements.retryButton.addEventListener(
        "click",
        loadDepartmentInformation
    );

    loadDepartmentInformation();

})();
