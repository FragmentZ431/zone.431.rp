
/* =========================================================
   ZONE-431 — BIBLIOTHÈQUE DOCUMENTAIRE
   Gestion des accès multi-départements
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const auth = window.Zone431Auth;

    if (!auth) {
        console.error("[ZONE-431] Authentification indisponible.");
        return;
    }

    const el = {
        loading: document.getElementById("documentationLoading"),
        error: document.getElementById("documentationError"),
        errorMessage: document.getElementById("documentationErrorMessage"),
        retry: document.getElementById("documentationRetry"),
        library: document.getElementById("documentationLibrary"),
        total: document.getElementById("documentTotal"),
        search: document.getElementById("documentSearch"),
        category: document.getElementById("documentCategory"),
        department: document.getElementById("documentDepartment"),
        results: document.getElementById("documentResultsCount"),
        grid: document.getElementById("documentGrid"),
        empty: document.getElementById("documentEmpty")
    };

    let documents = [];
    let accessibleDepartments = [];

    const departmentNames = {
        "D.SE": "Département de Sécurité",
        "D.SCI": "Département Scientifique",
        "D.M": "Département Médical",
        "DI&ST": "Département Informatique et Systèmes",
        "D.A": "Direction Administrative"
    };

    function showView(view) {
        el.loading.hidden = true;
        el.error.hidden = true;
        el.library.hidden = true;
        view.hidden = false;
    }

    function formatDate(value) {
        if (!value) return "";

        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "";

        return new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function populateDepartments() {
        el.department.replaceChildren();

        const all = document.createElement("option");
        all.value = "all";
        all.textContent = "Tous mes départements";
        el.department.appendChild(all);

        accessibleDepartments.forEach(code => {
            const option = document.createElement("option");
            option.value = code;
            option.textContent = departmentNames[code] || code;
            el.department.appendChild(option);
        });
    }

    function populateCategories() {
        const categories = [
            ...new Set(
                documents
                    .map(doc => doc.category)
                    .filter(value => typeof value === "string" && value.trim())
            )
        ].sort((a, b) => a.localeCompare(b, "fr"));

        el.category.replaceChildren();

        const all = document.createElement("option");
        all.value = "all";
        all.textContent = "Toutes les catégories";
        el.category.appendChild(all);

        categories.forEach(category => {
            const option = document.createElement("option");
            option.value = category;
            option.textContent = category;
            el.category.appendChild(option);
        });
    }

    function getDocumentDepartments(doc) {
        return (doc.member_document_departments || [])
            .map(item => item.department_code)
            .filter(Boolean);
    }

    function createCard(doc) {
        const link = document.createElement("a");
        link.className = "documentation-card";
        link.href = `document.html?id=${encodeURIComponent(doc.id)}`;

        const icon = document.createElement("div");
        icon.className = "documentation-card-icon";

        const iconElement = document.createElement("i");
        iconElement.className = "fa-solid fa-file-lines";
        icon.appendChild(iconElement);

        const content = document.createElement("div");
        content.className = "documentation-card-content";

        const category = document.createElement("span");
        category.className = "documentation-card-category";
        category.textContent = doc.category || "Non classé";

        const title = document.createElement("h3");
        title.textContent = doc.title || "Document sans titre";

        const summary = document.createElement("p");
        summary.textContent =
            doc.summary || "Aucune description disponible.";

        const departmentLine = document.createElement("div");
        departmentLine.className = "documentation-card-departments";

        const codes = getDocumentDepartments(doc);

        if (doc.is_global) {
            departmentLine.textContent = "ACCÈS TRANSVERSAL";
        } else {
            departmentLine.textContent = codes
                .map(code => code)
                .join(" · ");
        }

        const accreditation = document.createElement("span");
        accreditation.className = "documentation-card-accreditation";
        accreditation.textContent = `ACCRÉDITATION REQUISE : ${doc.required_accreditation || "ACC 0"}`;

        const footer = document.createElement("div");
        footer.className = "documentation-card-footer";

        const date = document.createElement("span");
        date.textContent = formatDate(doc.created_at);

        const read = document.createElement("span");
        read.className = "documentation-card-read";

        const readText = document.createElement("span");
        readText.textContent = "CONSULTER";

        const arrow = document.createElement("i");
        arrow.className = "fa-solid fa-arrow-right";

        read.append(readText, arrow);
        footer.append(date, read);

        content.append(category, title, summary, departmentLine, accreditation, footer);
        link.append(icon, content);

        return link;
    }

    function renderDocuments() {
        const search = el.search.value.trim().toLocaleLowerCase("fr");
        const category = el.category.value;
        const department = el.department.value;

        const filtered = documents.filter(doc => {
            const title = (doc.title || "").toLocaleLowerCase("fr");
            const summary = (doc.summary || "").toLocaleLowerCase("fr");
            const docCategory = (doc.category || "").toLocaleLowerCase("fr");

            const matchesSearch =
                !search ||
                title.includes(search) ||
                summary.includes(search) ||
                docCategory.includes(search);

            const matchesCategory =
                category === "all" || doc.category === category;

            const docDepartments = getDocumentDepartments(doc);

            const matchesDepartment =
                department === "all" ||
                doc.is_global ||
                docDepartments.includes(department);

            return matchesSearch && matchesCategory && matchesDepartment;
        });

        el.grid.replaceChildren();

        filtered.forEach(doc => {
            el.grid.appendChild(createCard(doc));
        });

        el.results.textContent =
            `${filtered.length} résultat${filtered.length > 1 ? "s" : ""}`;

        el.empty.hidden = filtered.length !== 0;
    }

    async function loadDocuments() {
        showView(el.loading);

        try {
            await auth.protectPage();

            const access = await auth.getAccess();

            if (!access || access.status !== "authorized") {
                return;
            }

            const user = access.user;
            const profile = access.profile;

            const departmentSet = new Set();

            if (profile.department) {
                departmentSet.add(profile.department);
            }

            const { data: secondaryAccess, error: accessError } =
                await auth.client
                    .from("rp_member_department_access")
                    .select("department_code")
                    .eq("user_id", user.id);

            if (accessError) throw accessError;

            (secondaryAccess || []).forEach(item => {
                departmentSet.add(item.department_code);
            });

            accessibleDepartments = [...departmentSet].sort(
                (a, b) => a.localeCompare(b, "fr")
            );

            const { data, error } = await auth.client
                .from("member_documents")
                .select(`
                    id,
                    title,
                    slug,
                    category,
                    summary,
                    required_accreditation,
                    is_global,
                    sort_order,
                    created_at,
                    member_document_departments (
                        department_code
                    )
                `)
                .eq("is_published", true)
                .order("sort_order", { ascending: true })
                .order("created_at", { ascending: false });

            if (error) throw error;

            documents = data || [];

            el.total.textContent = documents.length;

            populateDepartments();
            populateCategories();
            renderDocuments();

            showView(el.library);

        } catch (error) {
            console.error("[ZONE-431] Erreur documentaire :", error);

            el.errorMessage.textContent =
                "Impossible de charger les documents. Vérifiez votre connexion et réessayez.";

            showView(el.error);
        }
    }

    el.search.addEventListener("input", renderDocuments);
    el.category.addEventListener("change", renderDocuments);
    el.department.addEventListener("change", renderDocuments);
    el.retry.addEventListener("click", loadDocuments);

    auth.subscribe((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
            window.location.replace("accueil.html");
        }
    });

    loadDocuments();
});
