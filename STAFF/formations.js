
"use strict";

/* =========================================================
   ZONE-431 — MODULE FORMATIONS
   RP : training_courses / training_lessons / training_progress
   STAFF : staff_training_courses / staff_training_lessons / staff_training_progress
   ========================================================= */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const TABLES = {
    rp: {
        courses: "training_courses",
        lessons: "training_lessons",
        progress: "training_progress",
        targets: "rp_training_course_targets"
    },
    staff: {
        courses: "staff_training_courses",
        lessons: "staff_training_lessons",
        progress: "staff_training_progress"
    }
};

const MANAGER_ROLES = ["ADMINISTRATEUR", "MANAGER MOD", "MANAGER ANIM"];

const state = {
    user: null,
    role: null,
    space: "rp",
    courses: [],
    departments: [],
    nodes: [],
    targets: [],
    currentCourse: null,
    currentLessons: [],
    canManageRP: false,
    canAccessStaff: false,
    canManageStaff: false,
    canManageAssignments: false,
    toastTimeout: null
};

const $ = (id) => document.getElementById(id);

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[character]);
}

function showToast(message, isError = false) {
    const toast = $("toast");
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("visible");

    clearTimeout(state.toastTimeout);
    state.toastTimeout = setTimeout(() => {
        toast.classList.remove("visible");
    }, 3500);
}

function openModal(id) {
    $(id)?.classList.remove("hidden");
}

function closeModal(id) {
    $(id)?.classList.add("hidden");
}

function formatDate(value) {
    if (!value) return "Date inconnue";

    return new Date(value).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "long",
        year: "numeric"
    });
}

function currentTables() {
    return TABLES[state.space];
}

function canManageCurrentSpace() {
    return state.space === "rp" ? state.canManageRP : state.canManageStaff;
}

function isManager() {
    return MANAGER_ROLES.includes(state.role);
}

function nodeLabel(code) {
    const node = state.nodes.find((item) => item.code === code);
    return node ? node.title : code;
}

function departmentLabel(code) {
    const department = state.departments.find((item) => item.code === code);
    return department ? `${department.code} — ${department.name}` : code;
}

function getSelectedValues(containerId) {
    return [...$(containerId).querySelectorAll("input[type='checkbox']:checked")]
        .map((input) => input.value);
}

function setSelectedValues(containerId, selectedValues) {
    const selected = new Set(selectedValues || []);

    $(containerId).querySelectorAll("input[type='checkbox']").forEach((input) => {
        input.checked = selected.has(input.value);
    });
}

function selectionOption(value, label, checked = false, name = "") {
    return `
        <label class="selection-option">
            <input
                type="checkbox"
                name="${escapeHTML(name)}"
                value="${escapeHTML(value)}"
                ${checked ? "checked" : ""}
            >
            <span>${escapeHTML(label)}</span>
        </label>
    `;
}

/* =========================================================
   AUTHENTIFICATION ET INITIALISATION
   ========================================================= */

async function initializeModule() {
    try {
        const { data: sessionData, error: sessionError } =
            await supabaseClient.auth.getSession();

        if (sessionError) throw sessionError;

        const session = sessionData?.session;

        if (!session?.user) {
            showAccessDenied("Aucune session active. Connectez-vous pour continuer.");
            return;
        }

        state.user = session.user;

        const { data: roleData, error: roleError } =
            await supabaseClient.rpc("current_staff_role");

        if (roleError) {
            console.warn("Lecture du rôle STAFF impossible :", roleError.message);
            state.role = null;
        } else {
            state.role = roleData || null;
        }

        // RP : la permission individuelle training/write autorise la gestion.
        // STAFF : seul un administrateur STAFF peut consulter et gérer cet espace.
        state.canManageAssignments = state.role === "ADMINISTRATEUR";

        const { data: staffAccess, error: staffAccessError } =
            await supabaseClient.rpc("has_staff_module_permission", {
                p_module_code: "training",
                p_action: "access"
            });

        if (staffAccessError) {
            throw new Error("Vérification des droits Formations impossible : " + staffAccessError.message);
        }

        const { data: staffWrite, error: staffWriteError } =
            await supabaseClient.rpc("has_staff_module_permission", {
                p_module_code: "training",
                p_action: "write"
            });

        if (staffWriteError) {
            throw new Error("Vérification des droits de gestion Formations impossible : " + staffWriteError.message);
        }

        state.canManageRP = staffAccess === true && staffWrite === true;
        state.canAccessStaff = state.role === "ADMINISTRATEUR";
        state.canManageStaff = state.role === "ADMINISTRATEUR";

        $("accessLabel").textContent = state.canManageRP
            ? "ACCÈS RP — GESTION AUTORISÉE"
            : "ACCÈS RP — CONSULTATION UNIQUEMENT";

        await loadCatalog();

        if (state.canManageAssignments) {
            $("assignmentPanel").classList.remove("hidden");
        }

        $("mainContent").classList.remove("hidden");
        configureInterface();

        await switchSpace("rp");
    } catch (error) {
        console.error("Initialisation du module :", error);
        showAccessDenied(error.message || "Une erreur est survenue pendant la connexion.");
    }
}

function showAccessDenied(message) {
    $("mainContent").classList.add("hidden");
    $("accessDenied").classList.remove("hidden");
    $("accessDenied").querySelector("p").textContent = message;
    $("accessLabel").textContent = "ACCÈS REFUSÉ";
}

/* =========================================================
   CATALOGUE DES DÉPARTEMENTS ET ORGANISATIONS
   ========================================================= */

async function loadCatalog() {
    const [departmentsResult, nodesResult] = await Promise.all([
        supabaseClient
            .from("rp_departments")
            .select("code,name")
            .order("code"),

        supabaseClient
            .from("rp_organization_nodes")
            .select("code,parent_code,root_department_code,node_type,title,is_published,sort_order")
            .eq("is_published", true)
            .order("sort_order")
            .order("title")
    ]);

    if (departmentsResult.error) {
        throw new Error(
            "Impossible de récupérer les départements : " +
            departmentsResult.error.message
        );
    }

    if (nodesResult.error) {
        throw new Error(
            "Impossible de récupérer les divisions et filières : " +
            nodesResult.error.message
        );
    }

    state.departments = departmentsResult.data || [];
    state.nodes = nodesResult.data || [];

    renderCatalogSelectors();
}

function renderCatalogSelectors() {
    const departmentHTML = state.departments.map((department) =>
        selectionOption(
            department.code,
            `${department.code} — ${department.name}`,
            false,
            "departmentTarget"
        )
    ).join("");

    $("courseDepartments").innerHTML = departmentHTML || "<p>Aucun département disponible.</p>";
    $("assignmentDepartments").innerHTML = departmentHTML || "<p>Aucun département disponible.</p>";

    const nodeGroups = new Map();

    state.nodes.forEach((node) => {
        const groupName = node.root_department_code
            ? departmentLabel(node.root_department_code)
            : node.parent_code
                ? node.parent_code
                : "Structures et filières indépendantes";

        if (!nodeGroups.has(groupName)) {
            nodeGroups.set(groupName, []);
        }

        nodeGroups.get(groupName).push(node);
    });

    let nodeHTML = "";

    nodeGroups.forEach((nodes, groupName) => {
        nodeHTML += `
            <div class="node-group full-width">
                <strong>${escapeHTML(groupName)}</strong>
                <div class="selection-grid">
                    ${nodes.map((node) =>
                        selectionOption(
                            node.code,
                            `${node.title} (${node.node_type})`,
                            false,
                            "nodeTarget"
                        )
                    ).join("")}
                </div>
            </div>
        `;
    });

    $("courseNodes").innerHTML = nodeHTML || "<p>Aucune division ou filière publiée.</p>";
    $("assignmentNodes").innerHTML = nodeHTML || "<p>Aucune division ou filière publiée.</p>";
}

/* =========================================================
   INTERFACE
   ========================================================= */

function configureInterface() {
    const staffTab = document.querySelector('.space-tab[data-space="staff"]');
    if (staffTab) staffTab.classList.toggle("hidden", !state.canAccessStaff);

    $("createCourseButton").classList.toggle("hidden", !canManageCurrentSpace());

    $("spaceDescription").textContent = state.space === "rp"
        ? "Les formations sont accessibles uniquement aux membres possédant les affectations RP correspondantes."
        : "Les formations sont destinées aux équipes Animation, Modération ou aux deux équipes.";

    $("rpTargetFields").classList.toggle("hidden", state.space !== "rp");
    $("staffTargetFields").classList.toggle("hidden", state.space !== "staff");

    $("spaceDescription").textContent += state.space === "rp"
        ? " Les affectations sont contrôlées par la base de données."
        : " Les droits d'accès sont contrôlés par le rôle STAFF actif.";
}

async function switchSpace(space) {
    if (!["rp", "staff"].includes(space)) return;

    if (space === "rp" && !state.canManageRP) {
        showToast("La permission training/write n'est pas active pour ce compte.", true);
    }

    if (space === "staff" && state.role !== "ADMINISTRATEUR") {
        showToast("L'espace Formations STAFF est réservé aux administrateurs.", true);
        return;
    }

    state.space = space;

    document.querySelectorAll(".space-tab").forEach((button) => {
        button.classList.toggle("active", button.dataset.space === space);
    });

    configureInterface();
    $("categoryFilter").value = "";

    await loadCourses();
}

async function loadCourses() {
    const tables = currentTables();

    $("courseGrid").innerHTML = '<div class="empty-state">Chargement des formations...</div>';

    const { data, error } = await supabaseClient
        .from(tables.courses)
        .select("*")
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Chargement formations :", error);
        $("courseGrid").innerHTML = `
            <div class="empty-state">
                Impossible de charger les formations.<br>
                ${escapeHTML(error.message)}
            </div>
        `;
        return;
    }

    state.courses = data || [];

    if (state.space === "rp") {
        await loadCourseTargets();
    } else {
        state.targets = [];
    }

    populateCategoryFilter();
    renderCourses();
    await updateStatistics();
}

async function loadCourseTargets() {
    if (!state.courses.length) {
        state.targets = [];
        return;
    }

    const ids = state.courses.map((course) => course.id);

    const { data, error } = await supabaseClient
        .from("rp_training_course_targets")
        .select("course_id,target_type,target_code")
        .in("course_id", ids);

    if (error) {
        console.error("Lecture des publics des formations :", error);
        state.targets = [];
        return;
    }

    state.targets = data || [];
}

function populateCategoryFilter() {
    const categories = [...new Set(
        state.courses.map((course) => course.category).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "fr"));

    $("categoryFilter").innerHTML =
        '<option value="">Toutes les catégories</option>' +
        categories.map((category) =>
            `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`
        ).join("");
}

function getCourseTargets(courseId) {
    return state.targets.filter((target) => target.course_id === courseId);
}

function renderCourses() {
    const search = $("searchInput").value.trim().toLocaleLowerCase("fr");
    const category = $("categoryFilter").value;
    const canManage = canManageCurrentSpace();

    const filteredCourses = state.courses.filter((course) => {
        const searchable = [
            course.title,
            course.summary,
            course.description,
            course.category
        ].join(" ").toLocaleLowerCase("fr");

        return searchable.includes(search) &&
            (!category || course.category === category);
    });

    if (!filteredCourses.length) {
        $("courseGrid").innerHTML = `
            <div class="empty-state">
                Aucune formation ne correspond à votre recherche ou à vos autorisations.
            </div>
        `;
        return;
    }

    $("courseGrid").innerHTML = filteredCourses.map((course) => {
        const targets = state.space === "rp" ? getCourseTargets(course.id) : [];

        const targetLabels = state.space === "rp"
            ? targets.map((target) => target.target_type === "department"
                ? departmentLabel(target.target_code)
                : nodeLabel(target.target_code))
            : [course.target_audience === "LES_DEUX"
                ? "Animation + Modération"
                : course.target_audience];

        return `
            <article class="course-card">
                <div class="course-card-top">
                    <span class="course-category">${escapeHTML(course.category || "Général")}</span>
                    <span class="course-status ${course.is_published ? "published" : ""}">
                        ${course.is_published ? "PUBLIÉE" : "BROUILLON"}
                    </span>
                </div>

                <h3>${escapeHTML(course.title)}</h3>
                <p>${escapeHTML(course.summary || course.description || "Aucune description disponible.")}</p>

                <div class="course-targets">
                    ${targetLabels.length
                        ? targetLabels.map((label) => `<span class="target-chip">${escapeHTML(label)}</span>`).join("")
                        : '<span class="target-chip">Public non défini</span>'}
                </div>

                <div class="course-card-footer">
                    <span class="muted">${formatDate(course.created_at)}</span>
                    <div class="card-actions">
                        <button class="small-button" data-action="view" data-id="${course.id}" type="button">Consulter</button>
                        ${canManage ? `
                            <button class="small-button" data-action="edit" data-id="${course.id}" type="button">Modifier</button>
                            <button class="small-button danger" data-action="delete" data-id="${course.id}" type="button">Supprimer</button>
                        ` : ""}
                    </div>
                </div>
            </article>
        `;
    }).join("");
}

async function updateStatistics() {
    const tables = currentTables();

    $("statCourses").textContent = state.courses.length;
    $("statPublished").textContent = state.courses.filter((course) => course.is_published).length;

    if (!state.courses.length) {
        $("statProgress").textContent = "0%";
        return;
    }

    const courseIds = state.courses.map((course) => course.id);

    const { data: lessons, error: lessonError } = await supabaseClient
        .from(tables.lessons)
        .select("id,course_id")
        .in("course_id", courseIds)
        .eq("is_published", true);

    if (lessonError || !lessons?.length) {
        $("statProgress").textContent = "0%";
        return;
    }

    const { data: progress, error: progressError } = await supabaseClient
        .from(tables.progress)
        .select("lesson_id,is_completed")
        .eq("user_id", state.user.id)
        .eq("is_completed", true);

    if (progressError) {
        $("statProgress").textContent = "0%";
        return;
    }

    const completedIds = new Set((progress || []).map((item) => item.lesson_id));
    const completed = lessons.filter((lesson) => completedIds.has(lesson.id)).length;

    $("statProgress").textContent =
        `${Math.round((completed / lessons.length) * 100)}%`;
}

/* =========================================================
   CRÉATION ET MODIFICATION DES FORMATIONS
   ========================================================= */

function resetCourseForm() {
    $("courseForm").reset();
    $("courseId").value = "";
    $("courseOrder").value = "0";
    $("courseModalTitle").textContent = "Nouvelle formation";

    setSelectedValues("courseDepartments", []);
    setSelectedValues("courseNodes", []);

    const defaultAudience = document.querySelector(
        'input[name="staffAudience"][value="ANIMATION"]'
    );

    if (defaultAudience) defaultAudience.checked = true;
}

function openCreateCourse() {
    if (!canManageCurrentSpace()) return;

    resetCourseForm();
    $("courseModalTitle").textContent = "Nouvelle formation";
    openModal("courseModal");
}

async function openEditCourse(courseId) {
    if (!canManageCurrentSpace()) return;

    const course = state.courses.find((item) => item.id === courseId);
    if (!course) return;

    resetCourseForm();

    $("courseId").value = course.id;
    $("courseTitle").value = course.title || "";
    $("courseCategory").value = course.category || "";
    $("courseOrder").value = course.sort_order ?? 0;
    $("courseSummary").value = course.summary || "";
    $("courseDescription").value = course.description || "";
    $("coursePublished").checked = Boolean(course.is_published);

    if (state.space === "rp") {
        const targets = getCourseTargets(course.id);

        setSelectedValues(
            "courseDepartments",
            targets.filter((item) => item.target_type === "department")
                .map((item) => item.target_code)
        );

        setSelectedValues(
            "courseNodes",
            targets.filter((item) => item.target_type === "node")
                .map((item) => item.target_code)
        );
    } else {
        const audience = document.querySelector(
            `input[name="staffAudience"][value="${course.target_audience}"]`
        );

        if (audience) audience.checked = true;
    }

    $("courseModalTitle").textContent = "Modifier la formation";
    openModal("courseModal");
}

async function saveCourse(event) {
    event.preventDefault();

    if (!canManageCurrentSpace()) {
        showToast("Vous ne disposez pas des droits de gestion.", true);
        return;
    }

    const tables = currentTables();
    const courseId = $("courseId").value;

    const title = $("courseTitle").value.trim();
    const category = $("courseCategory").value.trim();

    if (!title || !category) {
        showToast("Le titre et la catégorie sont obligatoires.", true);
        return;
    }

    const payload = {
        title,
        category,
        summary: $("courseSummary").value.trim() || null,
        description: $("courseDescription").value.trim() || null,
        sort_order: Number($("courseOrder").value) || 0,
        is_published: $("coursePublished").checked,
        updated_by: state.user.id,
        updated_at: new Date().toISOString()
    };

    if (state.space === "staff") {
        payload.target_audience =
            document.querySelector('input[name="staffAudience"]:checked')?.value || "ANIMATION";
    }

    if (!courseId) {
        payload.created_by = state.user.id;
    }

    let savedCourse;
    let saveError;

    if (courseId) {
        const result = await supabaseClient
            .from(tables.courses)
            .update(payload)
            .eq("id", courseId)
            .select()
            .single();

        savedCourse = result.data;
        saveError = result.error;
    } else {
        const result = await supabaseClient
            .from(tables.courses)
            .insert(payload)
            .select()
            .single();

        savedCourse = result.data;
        saveError = result.error;
    }

    if (saveError) {
        console.error("Enregistrement formation :", saveError);
        showToast("Enregistrement impossible : " + saveError.message, true);
        return;
    }

    if (state.space === "rp") {
        const departments = getSelectedValues("courseDepartments");
        const nodes = getSelectedValues("courseNodes");

        if (!departments.length && !nodes.length) {
            showToast("Sélectionnez au moins un département, une division ou une filière.", true);
            return;
        }

        const { error: deleteError } = await supabaseClient
            .from("rp_training_course_targets")
            .delete()
            .eq("course_id", savedCourse.id);

        if (deleteError) {
            showToast("Formation enregistrée, mais la mise à jour des publics a échoué.", true);
            console.error(deleteError);
            return;
        }

        const targetRows = [
            ...departments.map((code) => ({
                course_id: savedCourse.id,
                target_type: "department",
                target_code: code
            })),
            ...nodes.map((code) => ({
                course_id: savedCourse.id,
                target_type: "node",
                target_code: code
            }))
        ];

        const { error: targetError } = await supabaseClient
            .from("rp_training_course_targets")
            .insert(targetRows);

        if (targetError) {
            console.error("Enregistrement des publics :", targetError);
            showToast("Formation enregistrée, mais les publics n'ont pas pu être enregistrés.", true);
            return;
        }
    }

    closeModal("courseModal");
    showToast("Formation enregistrée.");
    await loadCourses();
}

/* =========================================================
   SUPPRESSION DES FORMATIONS
   ========================================================= */

async function deleteCourse(courseId) {
    if (!canManageCurrentSpace()) return;

    const course = state.courses.find((item) => item.id === courseId);
    if (!course) return;

    const confirmed = window.confirm(
        `Supprimer définitivement la formation « ${course.title} » et ses leçons ?`
    );

    if (!confirmed) return;

    const { error } = await supabaseClient
        .from(currentTables().courses)
        .delete()
        .eq("id", courseId);

    if (error) {
        console.error("Suppression formation :", error);
        showToast("Suppression impossible : " + error.message, true);
        return;
    }

    showToast("Formation supprimée.");
    await loadCourses();
}

/* =========================================================
   CONSULTATION ET GESTION DES LEÇONS
   ========================================================= */

async function openCourse(courseId) {
    const course = state.courses.find((item) => item.id === courseId);
    if (!course) return;

    state.currentCourse = course;

    $("viewTitle").textContent = course.title;
    $("viewDescription").textContent =
        course.description || course.summary || "Aucune description disponible.";

    $("viewEyebrow").textContent = state.space === "rp"
        ? "FORMATION RP"
        : "FORMATION STAFF";

    const meta = [
        course.category || "Général",
        course.is_published ? "Publiée" : "Brouillon",
        state.space === "staff"
            ? (course.target_audience === "LES_DEUX" ? "Animation + Modération" : course.target_audience)
            : null
    ].filter(Boolean);

    $("viewMeta").innerHTML = meta.map((item) =>
        `<span class="target-chip">${escapeHTML(item)}</span>`
    ).join("");

    $("addLessonButton").classList.toggle("hidden", !canManageCurrentSpace());

    await loadLessons(course.id);
    openModal("viewModal");
}

async function loadLessons(courseId) {
    const tables = currentTables();

    const { data, error } = await supabaseClient
        .from(tables.lessons)
        .select("*")
        .eq("course_id", courseId)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) {
        console.error("Chargement des leçons :", error);
        $("lessonList").innerHTML = `
            <div class="empty-state">
                Impossible de charger les leçons.<br>
                ${escapeHTML(error.message)}
            </div>
        `;
        return;
    }

    state.currentLessons = data || [];
    await renderLessons();
}

async function renderLessons() {
    const tables = currentTables();
    const canManage = canManageCurrentSpace();

    const { data: progressRows, error: progressError } = await supabaseClient
        .from(tables.progress)
        .select("lesson_id,is_completed")
        .eq("user_id", state.user.id);

    if (progressError) {
        console.warn("Lecture de la progression :", progressError.message);
    }

    const completedIds = new Set(
        (progressRows || [])
            .filter((row) => row.is_completed)
            .map((row) => row.lesson_id)
    );

    if (!state.currentLessons.length) {
        $("lessonList").innerHTML = `
            <div class="empty-state">
                Aucune leçon n'a encore été ajoutée à cette formation.
            </div>
        `;
        return;
    }

    const visibleLessons = state.currentLessons.filter((lesson) =>
        canManage || lesson.is_published
    );

    if (!visibleLessons.length) {
        $("lessonList").innerHTML = `
            <div class="empty-state">
                Aucune leçon publiée n'est disponible pour le moment.
            </div>
        `;
        return;
    }

    $("lessonList").innerHTML = visibleLessons.map((lesson, index) => {
        const completed = completedIds.has(lesson.id);

        return `
            <article class="lesson-item">
                <div class="lesson-item-top">
                    <div>
                        <span class="eyebrow">LEÇON ${String(index + 1).padStart(2, "0")}</span>
                        <h4>${escapeHTML(lesson.title)}</h4>
                    </div>

                    <span class="course-status ${completed ? "published" : ""}">
                        ${completed ? "TERMINÉE" : lesson.is_published ? "À SUIVRE" : "BROUILLON"}
                    </span>
                </div>

                <p class="lesson-content">${escapeHTML(lesson.content)}</p>

                <div class="lesson-actions">
                    ${lesson.is_published ? `
                        <button
                            class="small-button"
                            data-action="progress"
                            data-id="${lesson.id}"
                            type="button"
                        >
                            ${completed ? "Marquer comme non terminée" : "Marquer comme terminée"}
                        </button>
                    ` : ""}

                    ${canManage ? `
                        <button class="small-button" data-action="edit-lesson" data-id="${lesson.id}" type="button">Modifier</button>
                        <button class="small-button danger" data-action="delete-lesson" data-id="${lesson.id}" type="button">Supprimer</button>
                    ` : ""}
                </div>
            </article>
        `;
    }).join("");
}

function openCreateLesson() {
    if (!canManageCurrentSpace() || !state.currentCourse) return;

    $("lessonForm").reset();
    $("lessonId").value = "";
    $("lessonCourseId").value = state.currentCourse.id;
    $("lessonPublished").checked = true;
    $("lessonModalTitle").textContent = "Nouvelle leçon";

    openModal("lessonModal");
}

function openEditLesson(lessonId) {
    if (!canManageCurrentSpace()) return;

    const lesson = state.currentLessons.find((item) => item.id === lessonId);
    if (!lesson) return;

    $("lessonId").value = lesson.id;
    $("lessonCourseId").value = lesson.course_id;
    $("lessonTitle").value = lesson.title;
    $("lessonContent").value = lesson.content;
    $("lessonPublished").checked = Boolean(lesson.is_published);
    $("lessonModalTitle").textContent = "Modifier la leçon";

    openModal("lessonModal");
}

async function saveLesson(event) {
    event.preventDefault();

    if (!canManageCurrentSpace()) return;

    const tables = currentTables();
    const lessonId = $("lessonId").value;

    const payload = {
        course_id: $("lessonCourseId").value,
        title: $("lessonTitle").value.trim(),
        content: $("lessonContent").value.trim(),
        sort_order: lessonId
            ? (state.currentLessons.find((item) => item.id === lessonId)?.sort_order ?? state.currentLessons.length)
            : state.currentLessons.length,
        is_published: $("lessonPublished").checked,
        updated_by: state.user.id,
        updated_at: new Date().toISOString()
    };

    if (!payload.title || !payload.content) {
        showToast("Le titre et le contenu sont obligatoires.", true);
        return;
    }

    if (!lessonId) {
        payload.created_by = state.user.id;
    }

    let result;

    if (lessonId) {
        result = await supabaseClient
            .from(tables.lessons)
            .update(payload)
            .eq("id", lessonId);
    } else {
        result = await supabaseClient
            .from(tables.lessons)
            .insert(payload);
    }

    if (result.error) {
        console.error("Enregistrement leçon :", result.error);
        showToast("Impossible d'enregistrer la leçon : " + result.error.message, true);
        return;
    }

    closeModal("lessonModal");
    showToast("Leçon enregistrée.");
    await loadLessons(payload.course_id);
    await updateStatistics();
}

async function deleteLesson(lessonId) {
    if (!canManageCurrentSpace()) return;

    const lesson = state.currentLessons.find((item) => item.id === lessonId);
    if (!lesson) return;

    if (!window.confirm(`Supprimer la leçon « ${lesson.title} » ?`)) return;

    const { error } = await supabaseClient
        .from(currentTables().lessons)
        .delete()
        .eq("id", lessonId);

    if (error) {
        showToast("Suppression impossible : " + error.message, true);
        return;
    }

    showToast("Leçon supprimée.");
    await loadLessons(state.currentCourse.id);
    await updateStatistics();
}

/* =========================================================
   SUIVI DE PROGRESSION
   ========================================================= */

async function toggleLessonProgress(lessonId) {
    const tables = currentTables();

    const { data: existing, error: readError } = await supabaseClient
        .from(tables.progress)
        .select("user_id,lesson_id,is_completed")
        .eq("user_id", state.user.id)
        .eq("lesson_id", lessonId)
        .maybeSingle();

    if (readError) {
        showToast("Lecture de la progression impossible : " + readError.message, true);
        return;
    }

    const nextCompleted = !existing?.is_completed;

    const payload = {
        user_id: state.user.id,
        lesson_id: lessonId,
        is_completed: nextCompleted,
        completed_at: nextCompleted ? new Date().toISOString() : null,
        updated_at: new Date().toISOString()
    };

    let result;

    if (existing) {
        result = await supabaseClient
            .from(tables.progress)
            .update({
                is_completed: payload.is_completed,
                completed_at: payload.completed_at,
                updated_at: payload.updated_at
            })
            .eq("user_id", state.user.id)
            .eq("lesson_id", lessonId);
    } else {
        result = await supabaseClient
            .from(tables.progress)
            .insert(payload);
    }

    if (result.error) {
        console.error("Mise à jour progression :", result.error);
        showToast("Progression non enregistrée : " + result.error.message, true);
        return;
    }

    showToast(nextCompleted ? "Leçon validée." : "Leçon retirée de vos leçons terminées.");
    await loadLessons(state.currentCourse.id);
    await updateStatistics();
}

/* =========================================================
   AFFECTATIONS INDIVIDUELLES RP
   ========================================================= */

async function saveMemberAssignments(event) {
    event.preventDefault();

    if (!state.canManageAssignments) {
        showToast("Seul un administrateur peut gérer les affectations.", true);
        return;
    }

    const userId = $("assignmentUserId").value.trim();

    const uuidPattern =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidPattern.test(userId)) {
        showToast("L'identifiant utilisateur doit être un UUID valide.", true);
        return;
    }

    const departmentCodes = getSelectedValues("assignmentDepartments");
    const nodeCodes = getSelectedValues("assignmentNodes");

    const confirmed = window.confirm(
        "Remplacer les affectations départementales et organisationnelles de ce membre ?"
    );

    if (!confirmed) return;

    const { error: deleteDepartmentsError } = await supabaseClient
        .from("rp_member_department_access")
        .delete()
        .eq("user_id", userId);

    if (deleteDepartmentsError) {
        showToast("Impossible de modifier les départements : " + deleteDepartmentsError.message, true);
        return;
    }

    const { error: deleteNodesError } = await supabaseClient
        .from("rp_member_organization_access")
        .delete()
        .eq("user_id", userId);

    if (deleteNodesError) {
        showToast("Impossible de modifier les divisions : " + deleteNodesError.message, true);
        return;
    }

    if (departmentCodes.length) {
        const rows = departmentCodes.map((departmentCode) => ({
            user_id: userId,
            department_code: departmentCode,
            granted_by: state.user.id
        }));

        const { error } = await supabaseClient
            .from("rp_member_department_access")
            .insert(rows);

        if (error) {
            showToast("Erreur lors de l'attribution des départements : " + error.message, true);
            return;
        }
    }

    if (nodeCodes.length) {
        const rows = nodeCodes.map((nodeCode) => ({
            user_id: userId,
            node_code: nodeCode,
            granted_by: state.user.id
        }));

        const { error } = await supabaseClient
            .from("rp_member_organization_access")
            .insert(rows);

        if (error) {
            showToast("Erreur lors de l'attribution des divisions : " + error.message, true);
            return;
        }
    }

    showToast("Affectations du membre enregistrées.");
    $("assignmentForm").reset();
}

/* =========================================================
   ÉVÉNEMENTS
   ========================================================= */

function bindEvents() {
    document.querySelectorAll(".space-tab").forEach((button) => {
        button.addEventListener("click", () => {
            switchSpace(button.dataset.space);
        });
    });

    $("refreshButton").addEventListener("click", loadCourses);
    $("searchInput").addEventListener("input", renderCourses);
    $("categoryFilter").addEventListener("change", renderCourses);

    $("createCourseButton").addEventListener("click", openCreateCourse);
    $("courseForm").addEventListener("submit", saveCourse);
    $("lessonForm").addEventListener("submit", saveLesson);
    $("assignmentForm").addEventListener("submit", saveMemberAssignments);

    $("addLessonButton").addEventListener("click", openCreateLesson);

    document.querySelectorAll("[data-close]").forEach((button) => {
        button.addEventListener("click", () => closeModal(button.dataset.close));
    });

    document.querySelectorAll(".modal").forEach((modal) => {
        modal.addEventListener("click", (event) => {
            if (event.target === modal) closeModal(modal.id);
        });
    });

    $("courseGrid").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const { action, id } = button.dataset;

        if (action === "view") await openCourse(id);
        if (action === "edit") await openEditCourse(id);
        if (action === "delete") await deleteCourse(id);
    });

    $("lessonList").addEventListener("click", async (event) => {
        const button = event.target.closest("button[data-action]");
        if (!button) return;

        const { action, id } = button.dataset;

        if (action === "progress") await toggleLessonProgress(id);
        if (action === "edit-lesson") openEditLesson(id);
        if (action === "delete-lesson") await deleteLesson(id);
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            document.querySelectorAll(".modal:not(.hidden)").forEach((modal) => {
                closeModal(modal.id);
            });
        }
    });
}

/* =========================================================
   DÉMARRAGE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    initializeModule();
});
