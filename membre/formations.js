
/* =========================================================
   ZONE-431 — CENTRE DE FORMATION
   Fichier : membre/formations.js
   ========================================================= */

(() => {
    "use strict";

    const elements = {
        courseTotal: document.getElementById("courseTotal"),
        completedTotal: document.getElementById("completedTotal"),
        globalProgress: document.getElementById("globalProgress"),

        courseList: document.getElementById("courseList"),

        loading: document.getElementById("trainingLoading"),
        error: document.getElementById("trainingError"),
        errorText: document.getElementById("trainingErrorText"),
        empty: document.getElementById("trainingEmpty"),
        welcome: document.getElementById("trainingWelcome"),
        courseView: document.getElementById("trainingCourseView"),

        retryButton: document.getElementById("retryTraining"),

        selectedTitle: document.getElementById("selectedCourseTitle"),
        selectedSummary: document.getElementById("selectedCourseSummary"),
        selectedProgress: document.getElementById("selectedCourseProgress"),
        selectedProgressBar: document.getElementById("selectedCourseProgressBar"),

        lessonCount: document.getElementById("lessonCount"),
        lessonList: document.getElementById("lessonList"),
        lessonReader: document.getElementById("lessonReader"),

        resultGrade: document.getElementById("trainingResultGrade"),
        resultStatus: document.getElementById("trainingResultStatus"),
        resultNote: document.getElementById("trainingResultNote")
    };

    const state = {
        user: null,
        courses: [],
        lessons: [],
        progress: [],
        results: [],
        selectedCourseId: null,
        selectedLessonId: null
    };

    function setVisible(element, visible) {
        element.hidden = !visible;
    }

    function showLoading() {
        setVisible(elements.loading, true);
        setVisible(elements.error, false);
        setVisible(elements.empty, false);
        setVisible(elements.welcome, false);
        setVisible(elements.courseView, false);
    }

    function showError(message) {
        setVisible(elements.loading, false);
        setVisible(elements.error, true);
        setVisible(elements.empty, false);
        setVisible(elements.welcome, false);
        setVisible(elements.courseView, false);

        elements.errorText.textContent =
            message || "Une erreur inconnue est survenue.";
    }

    function showEmpty() {
        setVisible(elements.loading, false);
        setVisible(elements.error, false);
        setVisible(elements.empty, true);
        setVisible(elements.welcome, false);
        setVisible(elements.courseView, false);
    }

    function showWelcome() {
        setVisible(elements.loading, false);
        setVisible(elements.error, false);
        setVisible(elements.empty, false);
        setVisible(elements.welcome, true);
        setVisible(elements.courseView, false);
    }

    function getCourseLessons(courseId) {
        return state.lessons.filter(
            lesson => lesson.course_id === courseId
        );
    }

    function isLessonCompleted(lessonId) {
        return state.progress.some(
            item => item.lesson_id === lessonId && item.is_completed === true
        );
    }

    function getCourseProgress(courseId) {
        const lessons = getCourseLessons(courseId);

        if (!lessons.length) {
            return {
                total: 0,
                completed: 0,
                percentage: 0
            };
        }

        const completed = lessons.filter(
            lesson => isLessonCompleted(lesson.id)
        ).length;

        return {
            total: lessons.length,
            completed,
            percentage: Math.round((completed / lessons.length) * 100)
        };
    }

    /* =====================================================
       RÉSULTATS OFFICIELS
       ===================================================== */

    function getCourseResult(courseId) {
        return state.results.find(
            result => result.course_id === courseId
        ) || null;
    }

    function renderCourseResult(courseId) {
        const result = getCourseResult(courseId);

        elements.resultGrade.textContent = "—";
        elements.resultStatus.className =
            "result-status result-missing";

        elements.resultStatus.replaceChildren();

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-circle-minus";

        elements.resultStatus.append(
            icon,
            document.createTextNode(" MANQUANT")
        );

        elements.resultNote.textContent =
            "Aucun résultat complet n'a été communiqué pour cette formation.";

        if (!result) return;

        const score = typeof result.score === "string"
            ? result.score.trim()
            : "";

        const rawStatus = typeof result.status === "string"
            ? result.status.trim().toLowerCase()
            : "";

        /*
         * Un résultat incomplet est toujours considéré comme manquant.
         * La note et le statut sont indépendants de la progression.
         */
        if (!score || !["validated", "refused"].includes(rawStatus)) {
            return;
        }

        elements.resultGrade.textContent = score;
        elements.resultStatus.replaceChildren();

        if (rawStatus === "validated") {
            elements.resultStatus.className =
                "result-status result-validated";

            const statusIcon = document.createElement("i");
            statusIcon.className = "fa-solid fa-circle-check";

            elements.resultStatus.append(
                statusIcon,
                document.createTextNode(" VALIDÉ")
            );

            elements.resultNote.textContent =
                "Votre formation a été validée par un membre habilité.";

            return;
        }

        if (rawStatus === "refused") {
            elements.resultStatus.className =
                "result-status result-refused";

            const statusIcon = document.createElement("i");
            statusIcon.className = "fa-solid fa-circle-xmark";

            elements.resultStatus.append(
                statusIcon,
                document.createTextNode(" REFUSÉ")
            );

            elements.resultNote.textContent =
                "Votre formation n'a pas été validée. Contactez votre formateur ou l'administration pour obtenir davantage d'informations.";
        }
    }

    /* =====================================================
       STATISTIQUES
       ===================================================== */

    function updateGlobalStatistics() {
        const totalLessons = state.lessons.length;

        const completedLessons = state.lessons.filter(
            lesson => isLessonCompleted(lesson.id)
        ).length;

        const percentage = totalLessons
            ? Math.round((completedLessons / totalLessons) * 100)
            : 0;

        elements.courseTotal.textContent = state.courses.length;
        elements.completedTotal.textContent =
            `${completedLessons} / ${totalLessons}`;

        elements.globalProgress.textContent = `${percentage} %`;
    }

    /* =====================================================
       CATALOGUE DES FORMATIONS
       ===================================================== */

    function createCourseButton(course) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "course-nav-button";

        if (course.id === state.selectedCourseId) {
            button.classList.add("active");
        }

        const iconContainer = document.createElement("span");
        iconContainer.className = "course-nav-icon";

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-book-open";

        iconContainer.appendChild(icon);

        const information = document.createElement("span");
        information.className = "course-nav-information";

        const title = document.createElement("strong");
        title.textContent = course.title;

        const progress = getCourseProgress(course.id);

        const count = document.createElement("small");
        count.textContent =
            `${progress.completed} / ${progress.total} leçons terminées`;

        const progressTrack = document.createElement("span");
        progressTrack.className = "course-nav-progress";

        const progressFill = document.createElement("span");
        progressFill.style.width = `${progress.percentage}%`;

        progressTrack.appendChild(progressFill);

        information.append(title, count, progressTrack);
        button.append(iconContainer, information);

        button.addEventListener("click", () => {
            selectCourse(course.id);
        });

        return button;
    }

    function renderCourseList() {
        elements.courseList.replaceChildren();

        state.courses.forEach(course => {
            elements.courseList.appendChild(
                createCourseButton(course)
            );
        });
    }

    /* =====================================================
       LISTE DES LEÇONS
       ===================================================== */

    function createLessonButton(lesson) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "lesson-nav-button";

        if (lesson.id === state.selectedLessonId) {
            button.classList.add("active");
        }

        const iconContainer = document.createElement("span");
        iconContainer.className = "lesson-nav-icon";

        const completed = isLessonCompleted(lesson.id);

        const icon = document.createElement("i");
        icon.className = completed
            ? "fa-solid fa-circle-check lesson-nav-complete"
            : "fa-regular fa-circle";

        iconContainer.appendChild(icon);

        const title = document.createElement("span");
        title.className = "lesson-nav-title";
        title.textContent = lesson.title;

        button.append(iconContainer, title);

        button.addEventListener("click", () => {
            selectLesson(lesson.id);
        });

        return button;
    }

    function renderLessonList() {
        const lessons = getCourseLessons(state.selectedCourseId);

        elements.lessonList.replaceChildren();

        elements.lessonCount.textContent =
            `${lessons.length} ${lessons.length > 1 ? "LEÇONS" : "LEÇON"}`;

        if (!lessons.length) {
            const message = document.createElement("p");
            message.className = "lesson-empty";
            message.textContent =
                "Aucune leçon publiée dans cette formation.";

            elements.lessonList.appendChild(message);
            return;
        }

        lessons.forEach(lesson => {
            elements.lessonList.appendChild(
                createLessonButton(lesson)
            );
        });
    }

    /* =====================================================
       LECTEUR DE LEÇONS
       ===================================================== */

    function renderLessonReader(lesson) {
        elements.lessonReader.replaceChildren();

        const header = document.createElement("div");
        header.className = "lesson-reader-header";

        const eyebrow = document.createElement("p");
        eyebrow.className = "section-eyebrow";
        eyebrow.textContent = "CONTENU DE FORMATION";

        const title = document.createElement("h3");
        title.textContent = lesson.title;

        header.append(eyebrow, title);

        const content = document.createElement("div");
        content.className = "lesson-reader-content";
        content.textContent = lesson.content || "";

        const footer = document.createElement("div");
        footer.className = "lesson-reader-footer";

        const status = document.createElement("span");
        status.className = "lesson-reader-status";

        const completed = isLessonCompleted(lesson.id);

        const statusIcon = document.createElement("i");
        statusIcon.className = completed
            ? "fa-solid fa-circle-check"
            : "fa-regular fa-circle";

        const statusText = document.createElement("span");
        statusText.textContent = completed
            ? "LEÇON TERMINÉE"
            : "LEÇON NON TERMINÉE";

        if (completed) {
            status.classList.add("completed");
        }

        status.append(statusIcon, statusText);

        const button = document.createElement("button");
        button.type = "button";
        button.className = "lesson-complete-button";

        if (completed) {
            button.classList.add("is-completed");
            button.disabled = true;

            const buttonIcon = document.createElement("i");
            buttonIcon.className = "fa-solid fa-check";

            button.append(buttonIcon, document.createTextNode("TERMINÉE"));
        } else {
            const buttonIcon = document.createElement("i");
            buttonIcon.className = "fa-solid fa-check";

            button.append(
                buttonIcon,
                document.createTextNode("MARQUER COMME TERMINÉE")
            );

            button.addEventListener("click", () => {
                completeLesson(lesson.id, button);
            });
        }

        footer.append(status, button);

        elements.lessonReader.append(header, content, footer);
    }

    function showLessonPlaceholder(titleText, descriptionText) {
        elements.lessonReader.replaceChildren();

        const placeholder = document.createElement("div");
        placeholder.className = "lesson-reader-placeholder";

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-book-open";

        const title = document.createElement("h3");
        title.textContent = titleText;

        const description = document.createElement("p");
        description.textContent = descriptionText;

        placeholder.append(icon, title, description);
        elements.lessonReader.appendChild(placeholder);
    }

    /* =====================================================
       AFFICHAGE DE LA PROGRESSION
       ===================================================== */

    function renderProgress() {
        updateGlobalStatistics();
        renderCourseList();

        if (state.selectedCourseId) {
            const progress = getCourseProgress(state.selectedCourseId);

            elements.selectedProgress.textContent =
                `${progress.percentage} %`;

            elements.selectedProgressBar.style.width =
                `${progress.percentage}%`;
        }
    }

    /* =====================================================
       SÉLECTION D'UNE FORMATION
       ===================================================== */

    function selectCourse(courseId) {
        const course = state.courses.find(
            item => item.id === courseId
        );

        if (!course) return;

        state.selectedCourseId = courseId;
        state.selectedLessonId = null;

        elements.selectedTitle.textContent = course.title;
        elements.selectedSummary.textContent =
            course.summary || course.description || "";

        renderProgress();
        renderLessonList();
        renderCourseResult(courseId);

        const firstLesson = getCourseLessons(courseId)[0];

        if (firstLesson) {
            selectLesson(firstLesson.id);
        } else {
            showLessonPlaceholder(
                "AUCUNE LEÇON DISPONIBLE",
                "Cette formation ne contient actuellement aucune leçon publiée."
            );
        }

        setVisible(elements.loading, false);
        setVisible(elements.error, false);
        setVisible(elements.empty, false);
        setVisible(elements.welcome, false);
        setVisible(elements.courseView, true);
    }

    /* =====================================================
       SÉLECTION D'UNE LEÇON
       ===================================================== */

    function selectLesson(lessonId) {
        const lesson = state.lessons.find(
            item => item.id === lessonId
        );

        if (!lesson || lesson.course_id !== state.selectedCourseId) {
            return;
        }

        state.selectedLessonId = lessonId;

        renderLessonList();
        renderLessonReader(lesson);
    }

    /* =====================================================
       ENREGISTREMENT DE LA PROGRESSION
       ===================================================== */

    async function completeLesson(lessonId, button) {
        if (!state.user || !lessonId) return;

        button.disabled = true;

        try {
            const client = window.Zone431Auth.client;

            const existing = state.progress.find(
                item => item.lesson_id === lessonId
            );

            if (existing) {
                const { error } = await client
                    .from("training_progress")
                    .update({
                        is_completed: true,
                        completed_at: new Date().toISOString()
                    })
                    .eq("user_id", state.user.id)
                    .eq("lesson_id", lessonId);

                if (error) throw error;

                existing.is_completed = true;
                existing.completed_at = new Date().toISOString();

            } else {
                const { data, error } = await client
                    .from("training_progress")
                    .insert({
                        user_id: state.user.id,
                        lesson_id: lessonId,
                        is_completed: true,
                        completed_at: new Date().toISOString()
                    })
                    .select("user_id, lesson_id, is_completed, completed_at")
                    .single();

                if (error) throw error;

                state.progress.push(data);
            }

            renderProgress();

            const lesson = state.lessons.find(
                item => item.id === lessonId
            );

            if (lesson) {
                renderLessonReader(lesson);
            }

        } catch (error) {
            console.error(
                "[ZONE-431] Impossible d'enregistrer la progression :",
                error
            );

            button.disabled = false;
            button.title =
                "Enregistrement impossible. Vérifiez votre connexion et réessayez.";
        }
    }

    /* =====================================================
       CHARGEMENT DES DONNÉES
       ===================================================== */

    async function loadTraining() {
        showLoading();

        try {
            if (!window.Zone431Auth) {
                throw new Error(
                    "Le système d'authentification Zone-431 est indisponible."
                );
            }

            const access = await window.Zone431Auth.protectPage();

            if (!access) return;

            state.user = access.user;

            const client = window.Zone431Auth.client;

            /*
             * FORMATIONS PUBLIÉES
             */
            const { data: courses, error: coursesError } = await client
                .from("training_courses")
                .select(`
                    id,
                    title,
                    summary,
                    description,
                    sort_order
                `)
                .eq("is_published", true)
                .order("sort_order", { ascending: true });

            if (coursesError) throw coursesError;

            state.courses = courses || [];

            if (!state.courses.length) {
                state.lessons = [];
                state.progress = [];
                state.results = [];

                elements.courseList.replaceChildren();

                updateGlobalStatistics();
                showEmpty();
                return;
            }

            const courseIds = state.courses.map(course => course.id);

            /*
             * LEÇONS PUBLIÉES
             */
            const { data: lessons, error: lessonsError } = await client
                .from("training_lessons")
                .select(`
                    id,
                    course_id,
                    title,
                    content,
                    sort_order
                `)
                .in("course_id", courseIds)
                .eq("is_published", true)
                .order("sort_order", { ascending: true });

            if (lessonsError) throw lessonsError;

            state.lessons = lessons || [];

            /*
             * PROGRESSION PERSONNELLE
             */
            const { data: progress, error: progressError } = await client
                .from("training_progress")
                .select(`
                    user_id,
                    lesson_id,
                    is_completed,
                    completed_at
                `)
                .eq("user_id", state.user.id);

            if (progressError) throw progressError;

            state.progress = progress || [];

            /*
             * RÉSULTATS OFFICIELS PERSONNELS
             *
             * La politique RLS de training_results limite
             * cette lecture aux résultats du compte connecté.
             */
            const { data: results, error: resultsError } = await client
                .from("training_results")
                .select(`
                    course_id,
                    score,
                    status
                `)
                .eq("user_id", state.user.id)
                .in("course_id", courseIds);

            if (resultsError) throw resultsError;

            state.results = results || [];

            /*
             * AFFICHAGE
             */
            renderProgress();
            showWelcome();

        } catch (error) {
            console.error(
                "[ZONE-431] Erreur de chargement des formations :",
                error
            );

            showError(
                "Impossible de récupérer les formations et vos résultats. " +
                "Vérifiez votre connexion ou contactez l'administration."
            );
        }
    }

    /* =====================================================
       INITIALISATION
       ===================================================== */

    elements.retryButton.addEventListener("click", loadTraining);

    loadTraining();

})();
