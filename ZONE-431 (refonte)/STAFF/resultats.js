
// =========================================================
// ZONE-431 — GESTION DES RÉSULTATS
// Fichier : STAFF/resultats.js
// =========================================================

(() => {
    "use strict";

    const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
    const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

    const PERMISSION_CODE = "training.results.manage";

    const elements = {
        pageMessage: document.getElementById("pageMessage"),
        workspace: document.getElementById("resultsWorkspace"),
        recordsPanel: document.getElementById("recordsPanel"),

        memberTotal: document.getElementById("memberTotal"),
        resultTotal: document.getElementById("resultTotal"),
        validatedTotal: document.getElementById("validatedTotal"),
        refusedTotal: document.getElementById("refusedTotal"),

        courseSelect: document.getElementById("courseSelect"),
        courseInformation: document.getElementById("courseInformation"),

        memberSearch: document.getElementById("memberSearch"),
        memberList: document.getElementById("memberList"),

        editorPlaceholder: document.getElementById("editorPlaceholder"),
        resultForm: document.getElementById("resultForm"),

        selectedMemberName: document.getElementById("selectedMemberName"),
        selectedMemberDetails: document.getElementById("selectedMemberDetails"),
        selectedResultState: document.getElementById("selectedResultState"),

        resultScore: document.getElementById("resultScore"),
        resultStatus: document.getElementById("resultStatus"),
        partialResultWarning: document.getElementById("partialResultWarning"),

        resetResult: document.getElementById("resetResult"),
        saveResult: document.getElementById("saveResult"),
        formFeedback: document.getElementById("formFeedback"),

        recordsSubtitle: document.getElementById("recordsSubtitle"),
        recordsCount: document.getElementById("recordsCount"),
        recordsList: document.getElementById("recordsList")
    };

    const state = {
        client: null,
        user: null,
        courses: [],
        members: [],
        results: [],
        selectedCourseId: null,
        selectedMemberId: null,
        saving: false
    };

    // -----------------------------------------------------
    // OUTILS GÉNÉRAUX
    // -----------------------------------------------------

    function showMessage(message, type = "error") {
        elements.pageMessage.textContent = message;
        elements.pageMessage.className = "page-message";

        if (type === "success") {
            elements.pageMessage.classList.add("success");
        }

        elements.pageMessage.hidden = false;
    }

    function hideMessage() {
        elements.pageMessage.hidden = true;
        elements.pageMessage.textContent = "";
    }

    function showFormFeedback(message, type = "") {
        elements.formFeedback.textContent = message;
        elements.formFeedback.className = "form-feedback";

        if (type) {
            elements.formFeedback.classList.add(type);
        }
    }

    function getMemberName(member) {
        return (
            member.rp_name ||
            member.display_name ||
            member.roblox_username ||
            "Membre sans nom RP"
        );
    }

    function getMemberDetails(member) {
        const details = [];

        if (member.personnel_id) {
            details.push(member.personnel_id);
        }

        if (member.department) {
            details.push(member.department);
        }

        if (!details.length && member.roblox_username) {
            details.push(`Roblox : ${member.roblox_username}`);
        }

        return details.join(" • ") || "Personnel autorisé";
    }

    function getSelectedCourse() {
        return state.courses.find(
            course => course.id === state.selectedCourseId
        ) || null;
    }

    function getSelectedMember() {
        return state.members.find(
            member => member.user_id === state.selectedMemberId
        ) || null;
    }

    function getMemberResult(memberId) {
        return state.results.find(
            result => result.user_id === memberId
        ) || null;
    }

    function getStatusLabel(status) {
        if (status === "validated") return "VALIDÉ";
        if (status === "refused") return "REFUSÉ";
        return "MANQUANT";
    }

    function getStatusClass(status) {
        if (status === "validated") return "validated";
        if (status === "refused") return "refused";
        return "missing";
    }

    function isCompleteResult(result) {
        return Boolean(
            result &&
            typeof result.score === "string" &&
            result.score.trim() &&
            ["validated", "refused"].includes(result.status)
        );
    }

    function normalizeScore(value) {
        return value.trim().replace(/\s*\/\s*/g, "/");
    }

    function isValidScore(value) {
        return /^[0-9]+([.,][0-9]+)?\/[0-9]+([.,][0-9]+)?$/.test(value);
    }

    function setSaving(isSaving) {
        state.saving = isSaving;
        elements.saveResult.disabled = isSaving;
        elements.resetResult.disabled = isSaving;

        elements.saveResult.innerHTML = isSaving
            ? '<i class="fa-solid fa-spinner fa-spin"></i> ENREGISTREMENT...'
            : '<i class="fa-solid fa-floppy-disk"></i> ENREGISTRER LE RÉSULTAT';
    }

    // -----------------------------------------------------
    // CONTRÔLE D'ACCÈS
    // -----------------------------------------------------

    async function checkAccess() {
        if (!window.supabase || !window.supabase.createClient) {
            throw new Error(
                "La bibliothèque Supabase n'a pas pu être chargée."
            );
        }

        state.client = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_KEY
        );

        const { data: sessionData, error: sessionError } =
            await state.client.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        const session = sessionData?.session;

        if (!session || !session.user) {
            throw new Error(
                "Aucune session active. Connectez-vous avec votre compte Zone-431 avant d'accéder à cette interface."
            );
        }

        state.user = session.user;

        /*
         * La permission est vérifiée côté serveur.
         * Le contrôle visuel de la page ne remplace jamais
         * les règles RLS de Supabase.
         */
        const { data: permitted, error: permissionError } =
            await state.client.rpc("has_rp_permission", {
                p_permission_code: PERMISSION_CODE,
                p_department_code: null
            });

        if (permissionError) {
            throw permissionError;
        }

        if (permitted !== true) {
            throw new Error(
                "Accès refusé. Votre compte ne possède pas la permission nécessaire pour gérer les résultats des formations."
            );
        }
    }

    // -----------------------------------------------------
    // CHARGEMENT DES DONNÉES
    // -----------------------------------------------------

    async function loadCourses() {
        const { data, error } = await state.client
            .from("training_courses")
            .select(`
                id,
                title,
                summary,
                description,
                is_published,
                sort_order
            `)
            .order("sort_order", { ascending: true });

        if (error) throw error;

        state.courses = data || [];

        elements.courseSelect.replaceChildren();

        if (!state.courses.length) {
            const option = document.createElement("option");
            option.value = "";
            option.textContent = "Aucune formation disponible";
            elements.courseSelect.appendChild(option);

            elements.courseInformation.textContent =
                "Aucune formation n'a encore été créée.";

            return;
        }

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Sélectionner une formation";
        elements.courseSelect.appendChild(placeholder);

        state.courses.forEach(course => {
            const option = document.createElement("option");
            option.value = course.id;
            option.textContent = course.title;

            if (!course.is_published) {
                option.textContent += " — NON PUBLIÉE";
            }

            elements.courseSelect.appendChild(option);
        });
    }

    async function loadMembers() {
        const { data, error } = await state.client
            .from("rp_member_profiles")
            .select(`
                user_id,
                rp_name,
                display_name,
                roblox_username,
                personnel_id,
                department,
                grade,
                status
            `)
            .eq("status", "authorized")
            .order("rp_name", { ascending: true });

        if (error) throw error;

        state.members = data || [];

        elements.memberTotal.textContent = state.members.length;

        renderMemberList();
    }

    async function loadCourseResults(courseId) {
        if (!courseId) {
            state.results = [];
            renderRecords();
            updateStatistics();
            return;
        }

        const { data, error } = await state.client
            .from("training_results")
            .select(`
                id,
                user_id,
                course_id,
                score,
                status,
                updated_at
            `)
            .eq("course_id", courseId)
            .order("updated_at", { ascending: false });

        if (error) throw error;

        state.results = data || [];

        renderMemberList();
        renderRecords();
        updateStatistics();

        if (state.selectedMemberId) {
            loadSelectedMemberResult();
        }
    }

    // -----------------------------------------------------
    // STATISTIQUES
    // -----------------------------------------------------

    function updateStatistics() {
        const completeResults = state.results.filter(isCompleteResult);

        const validated = completeResults.filter(
            result => result.status === "validated"
        ).length;

        const refused = completeResults.filter(
            result => result.status === "refused"
        ).length;

        elements.memberTotal.textContent = state.members.length;
        elements.resultTotal.textContent = state.results.length;
        elements.validatedTotal.textContent = validated;
        elements.refusedTotal.textContent = refused;
    }

    // -----------------------------------------------------
    // LISTE DES MEMBRES
    // -----------------------------------------------------

    function renderMemberList() {
        elements.memberList.replaceChildren();

        if (!state.selectedCourseId) {
            const message = document.createElement("p");
            message.className = "empty-state";
            message.textContent =
                "Sélectionnez d'abord une formation.";

            elements.memberList.appendChild(message);
            return;
        }

        const search = elements.memberSearch.value
            .trim()
            .toLocaleLowerCase("fr");

        const filteredMembers = state.members.filter(member => {
            const searchable = [
                member.rp_name,
                member.display_name,
                member.roblox_username,
                member.personnel_id,
                member.department
            ]
                .filter(Boolean)
                .join(" ")
                .toLocaleLowerCase("fr");

            return searchable.includes(search);
        });

        if (!filteredMembers.length) {
            const message = document.createElement("p");
            message.className = "empty-state";
            message.textContent = search
                ? "Aucun membre ne correspond à votre recherche."
                : "Aucun membre autorisé n'est disponible.";

            elements.memberList.appendChild(message);
            return;
        }

        filteredMembers.forEach(member => {
            const button = document.createElement("button");
            button.type = "button";
            button.className = "member-button";

            if (member.user_id === state.selectedMemberId) {
                button.classList.add("active");
            }

            const avatar = document.createElement("span");
            avatar.className = "member-avatar";

            const name = getMemberName(member);
            avatar.textContent = name.charAt(0).toLocaleUpperCase("fr");

            const information = document.createElement("span");
            information.className = "member-button-information";

            const title = document.createElement("strong");
            title.textContent = name;

            const details = document.createElement("small");
            details.textContent = getMemberDetails(member);

            information.append(title, details);

            const result = getMemberResult(member.user_id);

            const indicator = document.createElement("span");
            indicator.className = "member-result-indicator";

            if (result && isCompleteResult(result)) {
                indicator.classList.add(
                    getStatusClass(result.status)
                );
            }

            const arrow = document.createElement("i");
            arrow.className = "fa-solid fa-chevron-right";

            button.append(avatar, information, indicator, arrow);

            button.addEventListener("click", () => {
                selectMember(member.user_id);
            });

            elements.memberList.appendChild(button);
        });
    }

    // -----------------------------------------------------
    // SÉLECTION D'UN MEMBRE
    // -----------------------------------------------------

    function selectMember(memberId) {
        if (state.saving) return;

        state.selectedMemberId = memberId;

        const member = getSelectedMember();

        if (!member) return;

        elements.editorPlaceholder.hidden = true;
        elements.resultForm.hidden = false;

        elements.selectedMemberName.textContent =
            getMemberName(member);

        elements.selectedMemberDetails.textContent =
            getMemberDetails(member);

        renderMemberList();
        loadSelectedMemberResult();
    }

    function loadSelectedMemberResult() {
        const result = getMemberResult(state.selectedMemberId);

        elements.resultScore.value = result?.score || "";
        elements.resultStatus.value = result?.status || "missing";

        if (result) {
            elements.selectedResultState.textContent = "ENREGISTRÉ";
            elements.selectedResultState.classList.add("saved");
        } else {
            elements.selectedResultState.textContent = "NOUVEAU";
            elements.selectedResultState.classList.remove("saved");
        }

        showFormFeedback("");
        updatePartialWarning();
    }

    // -----------------------------------------------------
    // FORMULAIRE DE RÉSULTAT
    // -----------------------------------------------------

    function updatePartialWarning() {
        const score = normalizeScore(elements.resultScore.value);
        const status = elements.resultStatus.value;

        const isPartial = (
            !score ||
            status === "missing"
        );

        elements.partialResultWarning.hidden = !isPartial;
    }

    function resetSelectedResult() {
        if (state.saving) return;

        const result = getMemberResult(state.selectedMemberId);

        elements.resultScore.value = result?.score || "";
        elements.resultStatus.value = result?.status || "missing";

        showFormFeedback("");
        updatePartialWarning();
    }

    async function saveSelectedResult(event) {
        event.preventDefault();

        if (state.saving) return;

        const member = getSelectedMember();
        const course = getSelectedCourse();

        if (!member || !course) {
            showFormFeedback(
                "Sélectionnez une formation et un membre avant d'enregistrer.",
                "error"
            );
            return;
        }

        const score = normalizeScore(elements.resultScore.value);
        const status = elements.resultStatus.value;

        if (score && !isValidScore(score)) {
            showFormFeedback(
                "Format de note invalide. Utilisez le format X/X, par exemple 16/20.",
                "error"
            );

            elements.resultScore.focus();
            return;
        }

        if (!["validated", "refused", "missing"].includes(status)) {
            showFormFeedback(
                "Le statut sélectionné n'est pas valide.",
                "error"
            );
            return;
        }

        setSaving(true);
        showFormFeedback("Enregistrement en cours...");

        try {
            const existing = getMemberResult(member.user_id);

            const resultData = {
                score: score || null,
                status,
                updated_by: state.user.id,
                updated_at: new Date().toISOString()
            };

            if (existing) {
                const { error } = await state.client
                    .from("training_results")
                    .update(resultData)
                    .eq("id", existing.id);

                if (error) throw error;

            } else {
                const { error } = await state.client
                    .from("training_results")
                    .insert({
                        user_id: member.user_id,
                        course_id: course.id,
                        ...resultData,
                        created_by: state.user.id
                    });

                if (error) throw error;
            }

            await loadCourseResults(course.id);

            elements.selectedResultState.textContent = "ENREGISTRÉ";
            elements.selectedResultState.classList.add("saved");

            showFormFeedback(
                "Le résultat a été enregistré avec succès.",
                "success"
            );

        } catch (error) {
            console.error(
                "[ZONE-431] Erreur d'enregistrement du résultat :",
                error
            );

            showFormFeedback(
                error.message ||
                "Impossible d'enregistrer ce résultat. Vérifiez vos droits et votre connexion.",
                "error"
            );

        } finally {
            setSaving(false);
            updatePartialWarning();
        }
    }

    // -----------------------------------------------------
    // HISTORIQUE DES RÉSULTATS
    // -----------------------------------------------------

    function renderRecords() {
        elements.recordsList.replaceChildren();

        const course = getSelectedCourse();

        if (!course) {
            elements.recordsPanel.hidden = true;
            return;
        }

        elements.recordsPanel.hidden = false;

        elements.recordsSubtitle.textContent =
            `Résultats enregistrés pour : ${course.title}`;

        elements.recordsCount.textContent =
            `${state.results.length} ${state.results.length > 1 ? "RÉSULTATS" : "RÉSULTAT"}`;

        if (!state.results.length) {
            const message = document.createElement("p");
            message.className = "empty-state";
            message.textContent =
                "Aucun résultat n'a encore été enregistré pour cette formation.";

            elements.recordsList.appendChild(message);
            return;
        }

        const sortedResults = [...state.results].sort((a, b) => {
            const memberA = state.members.find(
                member => member.user_id === a.user_id
            );

            const memberB = state.members.find(
                member => member.user_id === b.user_id
            );

            return getMemberName(memberA || {})
                .localeCompare(
                    getMemberName(memberB || {}),
                    "fr"
                );
        });

        sortedResults.forEach(result => {
            const member = state.members.find(
                item => item.user_id === result.user_id
            );

            const row = document.createElement("article");
            row.className = "record-row";

            const information = document.createElement("div");
            information.className = "record-row-information";

            const name = document.createElement("strong");
            name.textContent = getMemberName(member || {});

            const details = document.createElement("small");
            details.textContent = getMemberDetails(member || {});

            information.append(name, details);

            const score = document.createElement("span");
            score.className = "record-score";
            score.textContent = result.score || "—";

            const status = document.createElement("span");
            status.className =
                `result-badge ${getStatusClass(result.status)}`;
            status.textContent = getStatusLabel(result.status);

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "record-edit-button";
            editButton.title = "Modifier ce résultat";
            editButton.setAttribute(
                "aria-label",
                `Modifier le résultat de ${getMemberName(member || {})}`
            );

            const editIcon = document.createElement("i");
            editIcon.className = "fa-solid fa-pen";

            editButton.appendChild(editIcon);

            editButton.addEventListener("click", () => {
                if (!member) {
                    showMessage(
                        "Le profil de ce membre n'est plus disponible dans la liste des membres autorisés."
                    );
                    return;
                }

                selectMember(member.user_id);

                elements.editorPlaceholder.scrollIntoView({
                    behavior: "smooth",
                    block: "nearest"
                });
            });

            row.append(
                information,
                score,
                status,
                editButton
            );

            elements.recordsList.appendChild(row);
        });
    }

    // -----------------------------------------------------
    // CHANGEMENT DE FORMATION
    // -----------------------------------------------------

    async function selectCourse(courseId) {
        if (state.saving) return;

        state.selectedCourseId = courseId;
        state.selectedMemberId = null;

        elements.memberSearch.value = "";
        elements.editorPlaceholder.hidden = false;
        elements.resultForm.hidden = true;

        showFormFeedback("");

        if (!courseId) {
            elements.courseInformation.textContent =
                "Sélectionnez une formation pour afficher les membres concernés.";

            state.results = [];

            renderMemberList();
            renderRecords();
            updateStatistics();
            return;
        }

        const course = getSelectedCourse();

        if (!course) return;

        elements.courseInformation.textContent =
            course.summary ||
            course.description ||
            (course.is_published
                ? "Formation publiée dans le catalogue."
                : "Cette formation n'est pas publiée.");

        if (!course.is_published) {
            elements.courseInformation.textContent +=
                " Les membres ne peuvent pas la consulter tant qu'elle n'est pas publiée.";
        }

        renderMemberList();

        try {
            await loadCourseResults(courseId);
        } catch (error) {
            console.error(
                "[ZONE-431] Impossible de charger les résultats :",
                error
            );

            showMessage(
                "Impossible de récupérer les résultats de cette formation."
            );
        }
    }

    // -----------------------------------------------------
    // INITIALISATION
    // -----------------------------------------------------

    async function initialize() {
        hideMessage();

        try {
            await checkAccess();

            await Promise.all([
                loadCourses(),
                loadMembers()
            ]);

            elements.workspace.hidden = false;

            if (!state.courses.length) {
                elements.recordsPanel.hidden = true;
                showMessage(
                    "Aucune formation n'est actuellement disponible dans le système.",
                    "success"
                );
            } else {
                showMessage(
                    "Accès autorisé. Vous pouvez maintenant gérer les résultats des formations.",
                    "success"
                );
            }

            updateStatistics();

        } catch (error) {
            console.error(
                "[ZONE-431] Initialisation de la gestion des résultats impossible :",
                error
            );

            elements.workspace.hidden = true;
            elements.recordsPanel.hidden = true;

            showMessage(
                error.message ||
                "Une erreur est survenue lors de l'initialisation de cette interface."
            );
        }
    }

    elements.courseSelect.addEventListener("change", event => {
        selectCourse(event.target.value);
    });

    elements.memberSearch.addEventListener("input", renderMemberList);

    elements.resultScore.addEventListener("input", updatePartialWarning);
    elements.resultStatus.addEventListener("change", updatePartialWarning);

    elements.resetResult.addEventListener("click", resetSelectedResult);

    elements.resultForm.addEventListener(
        "submit",
        saveSelectedResult
    );

    initialize();

})();
