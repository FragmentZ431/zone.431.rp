
/* =========================================================
   ZONE-431 — ESPACE MEMBRE / ACCUEIL
   Fichier : membre/accueil.js
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    const auth = window.Zone431Auth;

    if (!auth) {
        console.error("[ZONE-431] Le module auth.js est introuvable.");
        return;
    }

    const elements = {
        loginView: document.getElementById("loginView"),
        loginForm: document.getElementById("loginForm"),
        loginEmail: document.getElementById("loginEmail"),
        loginPassword: document.getElementById("loginPassword"),
        togglePassword: document.getElementById("togglePassword"),
        loginMessage: document.getElementById("loginMessage"),
        loginButton: document.getElementById("loginButton"),

        loadingView: document.getElementById("loadingView"),

        accessState: document.getElementById("accessState"),
        stateTitle: document.getElementById("stateTitle"),
        stateDescription: document.getElementById("stateDescription"),
        stateIcon: document.getElementById("stateIcon"),
        stateReference: document.getElementById("stateReference"),
        stateLogout: document.getElementById("stateLogout"),

        dashboardView: document.getElementById("dashboardView"),
        dashboardWelcome: document.getElementById("dashboardWelcome"),
        dashboardDepartment: document.getElementById("dashboardDepartment"),
        dashboardLogout: document.getElementById("dashboardLogout")
    };

    let refreshing = false;

    function showOnly(view) {
        [
            elements.loginView,
            elements.loadingView,
            elements.accessState,
            elements.dashboardView
        ].forEach(element => {
            if (element) {
                element.hidden = true;
            }
        });

        if (view) {
            view.hidden = false;
        }
    }

    function showMessage(message, type = "error") {
        if (!elements.loginMessage) return;

        elements.loginMessage.textContent = message;
        elements.loginMessage.dataset.type = type;
    }

    function setLoginLoading(isLoading) {
        if (elements.loginButton) {
            elements.loginButton.disabled = isLoading;
            elements.loginButton.textContent = isLoading
                ? "VÉRIFICATION..."
                : "SE CONNECTER";
        }
    }

    function displayAccessState(status, profile = null) {
        const states = {
            pending: {
                title: "DEMANDE EN ATTENTE",
                description:
                    "Votre compte a bien été créé. Un administrateur doit encore valider votre accès à l'installation.",
                icon: "ATTENTE"
            },
            rejected: {
                title: "ACCÈS NON AUTORISÉ",
                description:
                    "Votre demande d'accès n'a pas été acceptée. Contactez l'administration si vous souhaitez obtenir des informations.",
                icon: "REFUS"
            },
            suspended: {
                title: "ACCÈS SUSPENDU",
                description:
                    "L'accès à l'espace membre de votre compte est actuellement suspendu. Contactez l'administration.",
                icon: "SUSPENDU"
            },
            unknown: {
                title: "PROFIL INTROUVABLE",
                description:
                    "Aucun profil membre associé à ce compte n'a été trouvé. Contactez l'administration.",
                icon: "ERREUR"
            },
            error: {
                title: "VÉRIFICATION IMPOSSIBLE",
                description:
                    "Une erreur empêche actuellement la vérification de votre autorisation. Réessayez ultérieurement.",
                icon: "ERREUR"
            }
        };

        const state = states[status] || states.unknown;

        if (elements.stateTitle) {
            elements.stateTitle.textContent = state.title;
        }

        if (elements.stateDescription) {
            elements.stateDescription.textContent = state.description;
        }

        if (elements.stateIcon) {
            elements.stateIcon.textContent = state.icon;
        }

        if (elements.stateReference) {
            elements.stateReference.textContent = profile?.display_name
                ? `PROFIL : ${profile.display_name}`
                : "STATUT DU COMPTE : NON AUTORISÉ";
        }

        showOnly(elements.accessState);
    }

    function displayDashboard(profile) {
        const displayName =
            profile?.display_name?.trim() || "MEMBRE";

        const department =
            profile?.department?.trim() || "Département non renseigné";

        if (elements.dashboardWelcome) {
            elements.dashboardWelcome.textContent = displayName;
        }

        if (elements.dashboardDepartment) {
            elements.dashboardDepartment.textContent = department;
        }

        showOnly(elements.dashboardView);
    }

    async function refreshView() {
        if (refreshing) return;

        refreshing = true;
        showOnly(elements.loadingView);

        try {
            const access = await auth.getAccess();

            if (access.status === "authorized") {
                displayDashboard(access.profile);
            } else if (
                access.status === "signed_out" ||
                access.status === "anonymous"
            ) {
                showOnly(elements.loginView);
            } else {
                displayAccessState(access.status, access.profile);
            }
        } catch (error) {
            console.error("[ZONE-431] Erreur de vérification :", error);
            displayAccessState("error");
        } finally {
            refreshing = false;
        }
    }

    if (elements.loginForm) {
        elements.loginForm.addEventListener("submit", async event => {
            event.preventDefault();

            const email = elements.loginEmail?.value.trim();
            const password = elements.loginPassword?.value;

            if (!email || !password) {
                showMessage("Veuillez renseigner votre adresse e-mail et votre mot de passe.");
                return;
            }

            setLoginLoading(true);
            showMessage("");

            try {
                const { error } = await auth.client.auth.signInWithPassword({
                    email,
                    password
                });

                if (error) {
                    showMessage(
                        "Connexion impossible. Vérifiez vos identifiants."
                    );
                    return;
                }

                await refreshView();

            } catch (error) {
                console.error("[ZONE-431] Erreur de connexion :", error);
                showMessage("Une erreur est survenue pendant la connexion.");
            } finally {
                setLoginLoading(false);
            }
        });
    }

    if (elements.togglePassword && elements.loginPassword) {
        elements.togglePassword.addEventListener("click", () => {
            const isPassword =
                elements.loginPassword.type === "password";

            elements.loginPassword.type =
                isPassword ? "text" : "password";

            elements.togglePassword.textContent =
                isPassword ? "MASQUER" : "AFFICHER";
        });
    }

    async function logout() {
        try {
            await auth.signOut();
            window.location.replace("accueil.html");
        } catch (error) {
            console.error("[ZONE-431] Erreur de déconnexion :", error);
            showMessage("La déconnexion a échoué.");
        }
    }

    if (elements.stateLogout) {
        elements.stateLogout.addEventListener("click", logout);
    }

    if (elements.dashboardLogout) {
        elements.dashboardLogout.addEventListener("click", logout);
    }

    auth.subscribe((event, session) => {
        if (event === "SIGNED_OUT" || !session) {
            showOnly(elements.loginView);
            return;
        }

        if (
            event === "SIGNED_IN" ||
            event === "TOKEN_REFRESHED" ||
            event === "USER_UPDATED"
        ) {
            refreshView();
        }
    });

    refreshView();
});
