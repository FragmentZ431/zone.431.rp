
/* =========================================================
   ZONE-431 — PROFIL PERSONNEL
   Fichier : membre/profil.js
   ========================================================= */

(() => {
    "use strict";

    const elements = {
        loading: document.getElementById("profileLoading"),
        error: document.getElementById("profileError"),
        errorText: document.getElementById("profileErrorText"),
        content: document.getElementById("profileContent"),
        retry: document.getElementById("profileRetry"),
        signOut: document.getElementById("profileSignOut"),
        passwordCooldownInfo: document.getElementById("passwordCooldownInfo"),
        newPassword: document.getElementById("newPassword"),
        confirmNewPassword: document.getElementById("confirmNewPassword"),
        requestPasswordCodeBtn: document.getElementById("requestPasswordCodeBtn"),
        passwordOtpStep: document.getElementById("passwordOtpStep"),
        passwordEmailCode: document.getElementById("passwordEmailCode"),
        confirmPasswordChangeBtn: document.getElementById("confirmPasswordChangeBtn"),
        passwordChangeFeedback: document.getElementById("passwordChangeFeedback"),

        monogram: document.getElementById("profileMonogram"),
        displayName: document.getElementById("profileDisplayName"),
        personnelId: document.getElementById("profilePersonnelId"),
        accountStatus: document.getElementById("profileAccountStatus"),
        statusText: document.getElementById("profileStatusText"),

        name: document.getElementById("profileName"),
        roblox: document.getElementById("profileRoblox"),
        discord: document.getElementById("profileDiscord"),
        email: document.getElementById("profileEmail"),

        department: document.getElementById("profileDepartment"),
        grade: document.getElementById("profileGrade"),
        secondaryDepartments: document.getElementById("profileSecondaryDepartments"),

        roles: document.getElementById("profileRoles"),

        publicationTitle: document.getElementById("profilePublicationTitle"),
        publicationDescription: document.getElementById("profilePublicationDescription"),
        publicationBadge: document.getElementById("profilePublicationBadge"),
        publicationButton: document.getElementById("profilePublicationButton"),
        publicationButtonIcon: document.getElementById("profilePublicationButtonIcon"),
        publicationButtonText: document.getElementById("profilePublicationButtonText"),
        publicationFeedback: document.getElementById("profilePublicationFeedback")
    };

    const state = {
        access: null,
        profile: null,
        roles: [],
        departmentAssignments: [],
        publicationInProgress: false,
        passwordChangeAvailable: false,
        pendingPassword: null
    };

    const roleLabels = {
        MEMBRE: "Membre",
        DIRECTEUR_DEPARTEMENT: "Directeur de département",
        MODERATEUR: "Modérateur",
        ANIMATEUR: "Animateur",
        MANAGER: "Manager",
        ADMIN: "Administrateur"
    };

    function setVisible(element, visible) {
        element.hidden = !visible;
    }

    function showLoading() {
        setVisible(elements.loading, true);
        setVisible(elements.error, false);
        setVisible(elements.content, false);
    }

    function showError(message) {
        setVisible(elements.loading, false);
        setVisible(elements.error, true);
        setVisible(elements.content, false);

        elements.errorText.textContent =
            message || "Une erreur inconnue est survenue.";
    }

    function displayValue(value, fallback = "Non renseigné") {
        if (value === null || value === undefined || String(value).trim() === "") {
            return fallback;
        }

        return String(value);
    }

    function formatDate(value) {
        if (!value) return "Non renseignée";

        const date = new Date(`${value}T00:00:00`);

        if (Number.isNaN(date.getTime())) {
            return "Non renseignée";
        }

        return new Intl.DateTimeFormat("fr-FR", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        }).format(date);
    }

    function getMonogram(name) {
        const parts = String(name || "Agent")
            .trim()
            .split(/\s+/)
            .filter(Boolean);

        if (!parts.length) return "AG";

        return parts
            .slice(0, 2)
            .map(part => part.charAt(0).toUpperCase())
            .join("");
    }

    function renderAccountStatus(status) {
        const labels = {
            authorized: "COMPTE AUTORISÉ",
            pending: "EN ATTENTE",
            rejected: "REFUSÉ",
            suspended: "SUSPENDU"
        };

        elements.statusText.textContent =
            labels[status] || "STATUT INCONNU";

        elements.accountStatus.classList.remove(
            "status-pending",
            "status-rejected",
            "status-suspended"
        );

        if (status === "pending") {
            elements.accountStatus.classList.add("status-pending");
        } else if (status === "rejected") {
            elements.accountStatus.classList.add("status-rejected");
        } else if (status === "suspended") {
            elements.accountStatus.classList.add("status-suspended");
        }
    }

    function setPublicationFeedback(message = "", type = "") {
        elements.publicationFeedback.textContent = message;
        elements.publicationFeedback.classList.remove(
            "success",
            "error"
        );

        if (type) {
            elements.publicationFeedback.classList.add(type);
        }
    }

    function setPasswordFeedback(message = "", type = "") {
        elements.passwordChangeFeedback.textContent = message;
        elements.passwordChangeFeedback.classList.remove("success", "error");
        if (type) elements.passwordChangeFeedback.classList.add(type);
    }

    function formatDateTime(value) {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return "date indisponible";
        return new Intl.DateTimeFormat("fr-FR", {
            dateStyle: "long",
            timeStyle: "short"
        }).format(date);
    }

    async function refreshPasswordChangeStatus(client) {
        const { data, error } = await client.rpc("get_my_password_change_status");
        if (error) throw error;

        const status = Array.isArray(data) ? data[0] : data;
        if (!status) {
            state.passwordChangeAvailable = true;
            elements.passwordCooldownInfo.textContent =
                "Vous pouvez modifier votre mot de passe. Un code de confirmation sera envoyé par e-mail.";
        } else if (status.can_change === true) {
            state.passwordChangeAvailable = true;
            elements.passwordCooldownInfo.textContent =
                "Le délai de sécurité est écoulé. Vous pouvez modifier votre mot de passe.";
        } else {
            state.passwordChangeAvailable = false;
            elements.passwordCooldownInfo.textContent =
                "Prochain changement possible à partir du " +
                formatDateTime(status.next_change_at) + ".";
        }

        elements.requestPasswordCodeBtn.disabled = !state.passwordChangeAvailable;
    }

    async function requestPasswordChangeCode() {
        if (!state.passwordChangeAvailable || state.pendingPassword) return;

        const password = elements.newPassword.value;
        const confirmation = elements.confirmNewPassword.value;

        if (password.length < 8) {
            setPasswordFeedback("Le mot de passe doit contenir au moins 8 caractères.", "error");
            elements.newPassword.focus();
            return;
        }
        if (password !== confirmation) {
            setPasswordFeedback("Les deux mots de passe ne correspondent pas.", "error");
            elements.confirmNewPassword.focus();
            return;
        }

        const button = elements.requestPasswordCodeBtn;
        button.disabled = true;
        button.textContent = "ENVOI DU CODE...";

        try {
            const client = window.Zone431Auth.client;
            const { error } = await client.auth.reauthenticate();
            if (error) throw error;

            state.pendingPassword = password;
            elements.newPassword.value = "";
            elements.confirmNewPassword.value = "";
            elements.passwordOtpStep.hidden = false;
            elements.passwordEmailCode.value = "";
            elements.passwordEmailCode.focus();
            setPasswordFeedback(
                "Un code de confirmation vient d'être envoyé à l'adresse e-mail de votre compte. Saisissez-le pour valider le changement.",
                "success"
            );
        } catch (error) {
            console.error("[ZONE-431] Envoi du code de sécurité impossible :", error);
            setPasswordFeedback(
                error.message || "Impossible d'envoyer le code de confirmation.",
                "error"
            );
        } finally {
            button.textContent = "ENVOYER LE CODE DE CONFIRMATION";
            button.disabled = !state.passwordChangeAvailable || Boolean(state.pendingPassword);
        }
    }

    async function confirmPasswordChange() {
        if (!state.pendingPassword) return;

        const nonce = elements.passwordEmailCode.value.trim();
        if (!/^[0-9]{6}$/.test(nonce)) {
            setPasswordFeedback("Saisissez le code à 6 chiffres reçu par e-mail.", "error");
            elements.passwordEmailCode.focus();
            return;
        }

        const button = elements.confirmPasswordChangeBtn;
        button.disabled = true;
        button.textContent = "VÉRIFICATION...";

        try {
            const client = window.Zone431Auth.client;
            const { error } = await client.auth.updateUser({
                password: state.pendingPassword,
                nonce
            });
            if (error) throw error;

            state.pendingPassword = null;
            elements.passwordOtpStep.hidden = true;
            elements.passwordEmailCode.value = "";
            await refreshPasswordChangeStatus(client);
            setPasswordFeedback(
                "Votre mot de passe a été modifié avec succès. Le prochain changement sera possible dans 15 jours.",
                "success"
            );
        } catch (error) {
            console.error("[ZONE-431] Changement du mot de passe impossible :", error);
            const message = String(error.message || "");
            setPasswordFeedback(
                message.includes("PASSWORD_CHANGE_COOLDOWN")
                    ? "Le délai de 15 jours n'est pas encore écoulé."
                    : (error.message || "Le code est invalide ou le changement a échoué."),
                "error"
            );
        } finally {
            button.disabled = false;
            button.textContent = "CONFIRMER LE CHANGEMENT";
        }
    }

    function renderPublicationStatus(isPublished) {
        if (isPublished === true) {
            elements.publicationTitle.textContent = "Profil publié";
            elements.publicationDescription.textContent =
                "Votre fiche est visible dans l'annuaire public du personnel.";

            elements.publicationBadge.textContent = "PUBLIÉ";
            elements.publicationBadge.classList.add("published");

            elements.publicationButtonText.textContent =
                "RETIRER DE L'ANNUAIRE";

            elements.publicationButtonIcon.className =
                "fa-solid fa-eye-slash";

            elements.publicationButton.classList.add("is-published");
            elements.publicationButton.setAttribute("aria-pressed", "true");

        } else {
            elements.publicationTitle.textContent = "Profil non publié";
            elements.publicationDescription.textContent =
                "Votre fiche n'est pas visible dans l'annuaire public du personnel.";

            elements.publicationBadge.textContent = "NON PUBLIÉ";
            elements.publicationBadge.classList.remove("published");

            elements.publicationButtonText.textContent =
                "PUBLIER MON PROFIL";

            elements.publicationButtonIcon.className =
                "fa-solid fa-eye";

            elements.publicationButton.classList.remove("is-published");
            elements.publicationButton.setAttribute("aria-pressed", "false");
        }

        elements.publicationButton.disabled =
            state.publicationInProgress === true;
    }

    function getRoleLabel(roleCode) {
        return roleLabels[roleCode] ||
            String(roleCode || "Rôle inconnu")
                .replaceAll("_", " ")
                .toLowerCase()
                .replace(/(^|\s)\S/g, letter => letter.toUpperCase());
    }

    function renderRoles(roles) {
        elements.roles.replaceChildren();

        if (!roles.length) {
            const empty = document.createElement("span");
            empty.className = "profile-role-tag";
            empty.textContent = "Aucun rôle attribué";
            elements.roles.appendChild(empty);
            return;
        }

        roles.forEach(role => {
            const tag = document.createElement("span");
            tag.className = "profile-role-tag";

            const icon = document.createElement("i");
            icon.className = "fa-solid fa-shield-halved";

            const label = document.createElement("span");
            label.textContent = getRoleLabel(role.role_code);

            if (role.department_code) {
                label.textContent += ` — ${role.department_code}`;
            }

            tag.append(icon, label);
            elements.roles.appendChild(tag);
        });
    }

    function renderDepartmentAssignments(profile) {
        const primary = state.departmentAssignments.find(item => item.assignment_type === "primary");
        if (primary) {
            const division = primary.division_title
                ? ` / ${primary.division_title}`
                : "";
            elements.department.textContent =
                `${primary.department_code} — ${primary.department_name || primary.department_code}${division}`;
            elements.grade.textContent = displayValue(primary.grade);
        } else {
            elements.department.textContent = displayValue(profile.department);
            elements.grade.textContent = displayValue(profile.grade);
        }

        elements.secondaryDepartments.replaceChildren();
        const secondary = state.departmentAssignments
            .filter(item => item.assignment_type === "secondary")
            .sort((a, b) => (a.position || 0) - (b.position || 0));

        if (!secondary.length) {
            const empty = document.createElement("p");
            empty.className = "profile-secondary-empty";
            empty.textContent = "Aucun département additionnel attribué.";
            elements.secondaryDepartments.appendChild(empty);
            return;
        }

        secondary.forEach((item, index) => {
            const card = document.createElement("div");
            card.className = "profile-secondary-item";

            const heading = document.createElement("span");
            heading.textContent = `DÉPARTEMENT SECONDAIRE #${index + 1}`;

            const department = document.createElement("strong");
            const division = item.division_title ? ` / ${item.division_title}` : "";
            department.textContent =
                `${item.department_code} — ${item.department_name || item.department_code}${division}`;

            const rpName = document.createElement("small");
            rpName.textContent = `NOM RP : ${item.rp_name || "Non renseigné"}`;

            const grade = document.createElement("small");
            grade.textContent = `GRADE : ${item.grade || "Non renseigné"}`;

            card.append(heading, department, rpName, grade);
            elements.secondaryDepartments.appendChild(card);
        });
    }

    function renderProfile(profile, user) {
        const name = displayValue(profile.display_name, "Agent");

        elements.monogram.textContent = getMonogram(name);
        elements.displayName.textContent = name;

        elements.personnelId.textContent =
            profile.personnel_id
                ? `IDENTIFIANT : ${profile.personnel_id}`
                : "Identifiant personnel non renseigné";

        elements.name.textContent = name;
        elements.roblox.textContent =
            displayValue(profile.roblox_username);

        elements.discord.textContent =
            displayValue(profile.discord_username);

        elements.email.textContent =
            displayValue(user.email);

        renderDepartmentAssignments(profile);

        renderAccountStatus(profile.status);
        renderPublicationStatus(profile.is_published);
        renderRoles(state.roles);

        setVisible(elements.loading, false);
        setVisible(elements.error, false);
        setVisible(elements.content, true);
    }

    async function togglePublication() {
        if (
            state.publicationInProgress ||
            !state.profile ||
            !state.access
        ) {
            return;
        }

        const client = window.Zone431Auth.client;
        const nextValue = state.profile.is_published !== true;

        state.publicationInProgress = true;
        elements.publicationButton.disabled = true;
        elements.publicationButtonText.textContent = "MISE À JOUR...";
        elements.publicationButtonIcon.className =
            "fa-solid fa-spinner fa-spin";

        setPublicationFeedback("Enregistrement de votre choix...");

        try {
            const { data, error } = await client.rpc(
                "set_my_rp_profile_publication",
                {
                    p_is_published: nextValue
                }
            );

            if (error) {
                throw error;
            }

            if (data !== nextValue) {
                throw new Error(
                    "La base de données n'a pas confirmé le changement."
                );
            }

            state.profile.is_published = nextValue;

            renderPublicationStatus(nextValue);

            setPublicationFeedback(
                nextValue
                    ? "Votre profil est maintenant publié dans l'annuaire."
                    : "Votre profil a été retiré de l'annuaire.",
                "success"
            );

        } catch (error) {
            console.error(
                "[ZONE-431] Erreur de publication du profil :",
                error
            );

            renderPublicationStatus(state.profile.is_published);

            setPublicationFeedback(
                "Impossible de modifier la visibilité. Vérifiez la configuration Supabase.",
                "error"
            );

        } finally {
            state.publicationInProgress = false;
            elements.publicationButton.disabled = false;
        }
    }

    async function loadProfile() {
        showLoading();

        try {
            if (!window.Zone431Auth) {
                throw new Error(
                    "Le système d'authentification Zone-431 est indisponible."
                );
            }

            const access = await window.Zone431Auth.protectPage();

            if (!access) return;

            state.access = access;

            const client = window.Zone431Auth.client;
            const user = access.user;

            /*
             * RÉCUPÉRATION DU PROFIL PERSONNEL
             *
             * La requête porte uniquement sur le compte connecté.
             */
            const { data: profile, error: profileError } = await client
                .from("rp_member_profiles")
                .select(`
                    user_id,
                    display_name,
                    discord_username,
                    roblox_username,
                    status,
                    personnel_id,
                    department,
                    grade,
                    personnel_function,
                    integration_date,
                    is_published,
                    created_at
                `)
                .eq("user_id", user.id)
                .maybeSingle();

            if (profileError) {
                throw profileError;
            }

            if (!profile) {
                throw new Error(
                    "Aucune fiche personnelle n'est associée à ce compte."
                );
            }

            state.profile = profile;

            /*
             * RÉCUPÉRATION DES RÔLES
             */
            const { data: roles, error: rolesError } = await client
                .from("rp_member_role_assignments")
                .select(`
                    role_code,
                    department_code
                `)
                .eq("user_id", user.id);

            if (rolesError) {
                throw rolesError;
            }

            state.roles = roles || [];

            const { data: departmentAssignments, error: departmentAssignmentsError } =
                await client.rpc("get_my_department_assignments");
            if (departmentAssignmentsError) throw departmentAssignmentsError;
            state.departmentAssignments = Array.isArray(departmentAssignments)
                ? departmentAssignments
                : [];

            await refreshPasswordChangeStatus(client);
            renderProfile(profile, user);

        } catch (error) {
            console.error(
                "[ZONE-431] Erreur de chargement du profil :",
                error
            );

            showError(
                "Impossible de récupérer votre profil. " +
                "Vérifiez votre connexion ou contactez l'administration."
            );
        }
    }

    async function signOut() {
        const button = elements.signOut;

        button.disabled = true;
        button.innerHTML =
            '<i class="fa-solid fa-spinner fa-spin"></i> DÉCONNEXION...';

        try {
            await window.Zone431Auth.signOut();

            window.location.replace("accueil.html?reason=login");

        } catch (error) {
            console.error(
                "[ZONE-431] Erreur lors de la déconnexion :",
                error
            );

            button.disabled = false;
            button.innerHTML =
                '<i class="fa-solid fa-right-from-bracket"></i> DÉCONNEXION';

            alert("La déconnexion a échoué. Veuillez réessayer.");
        }
    }

    elements.retry.addEventListener("click", loadProfile);
    elements.requestPasswordCodeBtn.addEventListener("click", requestPasswordChangeCode);
    elements.confirmPasswordChangeBtn.addEventListener("click", confirmPasswordChange);
    elements.signOut.addEventListener("click", signOut);
    elements.publicationButton.addEventListener("click", togglePublication);

    loadProfile();

})();
