
/* =====================================================
   ZONE-431 — ADMINISTRATION STAFF
   Supabase / Authentification / Gestion des accès
   ===================================================== */


/* CONFIGURATION SUPABASE */

const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";

const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

const LOGIN_URL = "../accueil.html";

const ALLOWED_ROLES = [
    "MODÉRATION",
    "ANIMATION",
    "MANAGER MOD",
    "MANAGER ANIM",
    "ADMINISTRATEUR"
];


/* VARIABLES */

let supabaseClient = null;
let toastTimeout = null;
let clockInterval = null;


/* =====================================================
   INITIALISATION
   ===================================================== */

document.addEventListener("DOMContentLoaded", async () => {

    initializeSupabase();
    initializeMobileMenu();
    initializeLogout();
    initializeClock();

    await verifyStaffAccess();

});


/* =====================================================
   CONNEXION SUPABASE
   ===================================================== */

function initializeSupabase() {

    if (!window.supabase) {
        showAccessError("La bibliothèque Supabase n'a pas pu être chargée.");
        return;
    }

    supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

}


/* =====================================================
   VÉRIFICATION DES AUTORISATIONS
   ===================================================== */

async function verifyStaffAccess() {

    try {

        if (!supabaseClient) {
            throw new Error("Connexion Supabase indisponible.");
        }

        const {
            data: sessionData,
            error: sessionError
        } = await supabaseClient.auth.getSession();

        if (sessionError) {
            throw sessionError;
        }

        const session = sessionData.session;

        if (!session) {
            redirectToLogin();
            return;
        }


        const {
            data: userData,
            error: userError
        } = await supabaseClient.auth.getUser();

        if (userError || !userData.user) {
            redirectToLogin();
            return;
        }

        const user = userData.user;


        /*
         * Vérification du rôle côté serveur.
         * sessionStorage n'est jamais utilisé
         * comme preuve d'autorisation.
         */

        const {
            data: roleData,
            error: roleError
        } = await supabaseClient.rpc("current_staff_role");

        if (roleError) {
            throw roleError;
        }

        const role = extractRole(roleData);

        if (!role) {
            showAccessError(
                "Aucun rôle administratif n'est associé à votre compte."
            );
            return;
        }


        if (!ALLOWED_ROLES.includes(role)) {
            showAccessError(
                "Votre rôle ne permet pas d'accéder à l'administration STAFF."
            );
            return;
        }


        displayStaffIdentity(user, role);

        setSessionStatus(true);

        sessionStorage.setItem("zone431_role", role);

        document.body.classList.add("authorized");

        hideLoadingOverlay();

    } catch (error) {

        console.error(
            "[ZONE-431] Erreur de vérification STAFF :",
            error
        );

        showAccessError(
            "La vérification des autorisations a échoué. Veuillez réessayer."
        );

    }

}


/* =====================================================
   EXTRACTION DU RÔLE SUPABASE
   ===================================================== */

function extractRole(data) {

    if (!data) {
        return null;
    }

    let role = null;

    if (typeof data === "string") {

        role = data;

    } else if (Array.isArray(data)) {

        const firstResult = data[0];

        if (typeof firstResult === "string") {

            role = firstResult;

        } else if (firstResult && typeof firstResult === "object") {

            role =
                firstResult.role ||
                firstResult.current_staff_role ||
                firstResult.staff_role ||
                null;

        }

    } else if (typeof data === "object") {

        role =
            data.role ||
            data.current_staff_role ||
            data.staff_role ||
            null;

    }

    if (typeof role !== "string") {
        return null;
    }

    return role.trim().toUpperCase();

}


/* =====================================================
   IDENTITÉ DU PERSONNEL
   ===================================================== */

function displayStaffIdentity(user, role) {

    const metadata = user.user_metadata || {};

    const displayName =
        metadata.discord ||
        metadata.pseudo ||
        metadata.username ||
        metadata.roblox ||
        user.email ||
        "Personnel autorisé";

    const welcomeName = document.getElementById("welcomeName");
    const welcomeRole = document.getElementById("welcomeRole");
    const userInitials = document.getElementById("userInitials");
    const identityStatus = document.getElementById("identityStatus");

    if (welcomeName) {
        welcomeName.textContent = displayName;
    }

    if (welcomeRole) {
        welcomeRole.textContent = role;
    }

    if (userInitials) {
        userInitials.textContent = getInitials(displayName);
    }

    if (identityStatus) {
        identityStatus.textContent = "AUTHENTIFIÉE";
    }

}


/* =====================================================
   HORLOGE
   ===================================================== */

function initializeClock() {

    const clock = document.getElementById("currentClock");

    if (!clock) {
        return;
    }

    function updateClock() {

        const now = new Date();

        clock.textContent = now.toLocaleTimeString("fr-FR", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        });

    }

    updateClock();

    clockInterval = setInterval(updateClock, 1000);

}


/* =====================================================
   INITIALISATION DU MENU MOBILE
   ===================================================== */

function initializeMobileMenu() {

    const menuButton = document.getElementById("mobileMenuButton");
    const sidebar = document.getElementById("sidebar");

    if (!menuButton || !sidebar) {
        return;
    }

    menuButton.addEventListener("click", () => {

        const isOpen = sidebar.classList.toggle("open");

        menuButton.setAttribute(
            "aria-expanded",
            String(isOpen)
        );

    });


    const navigationLinks = sidebar.querySelectorAll("a.nav-link");

    navigationLinks.forEach((link) => {

        link.addEventListener("click", () => {

            sidebar.classList.remove("open");

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );

        });

    });


    document.addEventListener("click", (event) => {

        if (
            !sidebar.contains(event.target) &&
            !menuButton.contains(event.target)
        ) {

            sidebar.classList.remove("open");

            menuButton.setAttribute(
                "aria-expanded",
                "false"
            );

        }

    });

}


/* =====================================================
   DÉCONNEXION
   ===================================================== */

function initializeLogout() {

    const logoutButton = document.getElementById("logoutButton");

    if (!logoutButton) {
        return;
    }

    logoutButton.addEventListener("click", async () => {

        if (!supabaseClient) {
            redirectToLogin();
            return;
        }

        logoutButton.disabled = true;
        logoutButton.textContent = "DÉCONNEXION...";

        try {

            const {
                error
            } = await supabaseClient.auth.signOut();

            if (error) {
                throw error;
            }

            sessionStorage.removeItem("zone431_role");
            sessionStorage.removeItem("zone431_staff_authenticated");

            window.location.replace(LOGIN_URL);

        } catch (error) {

            console.error(
                "[ZONE-431] Erreur de déconnexion :",
                error
            );

            logoutButton.disabled = false;
            logoutButton.textContent = "Réessayer";

            showToast(
                "La déconnexion n'a pas pu être effectuée."
            );

        }

    });

}


/* =====================================================
   ÉTAT DE SESSION
   ===================================================== */

function setSessionStatus(isActive) {

    const sessionStatus = document.getElementById("sessionStatus");
    const identityStatus = document.getElementById("identityStatus");

    if (sessionStatus) {
        sessionStatus.textContent = isActive
            ? "SESSION SÉCURISÉE"
            : "SESSION INACTIVE";
    }

    if (identityStatus) {
        identityStatus.textContent = isActive
            ? "AUTHENTIFIÉE"
            : "NON AUTHENTIFIÉE";
    }

}


/* =====================================================
   ÉCRAN DE CHARGEMENT
   ===================================================== */

function hideLoadingOverlay() {

    const overlay = document.getElementById("loadingOverlay");

    if (!overlay) {
        return;
    }

    overlay.classList.add("hidden");

    setTimeout(() => {
        overlay.style.display = "none";
    }, 350);

}


/* =====================================================
   GESTION DES ERREURS
   ===================================================== */

function showAccessError(message) {

    const appShell = document.getElementById("appShell");
    const overlay = document.getElementById("loadingOverlay");

    if (appShell) {
        appShell.style.display = "none";
    }

    if (overlay) {
        overlay.style.display = "none";
    }

    const errorPage = document.createElement("main");
    errorPage.className = "access-error";

    const panel = document.createElement("div");
    panel.className = "access-error-panel";

    const mark = document.createElement("div");
    mark.className = "access-error-mark";
    mark.textContent = "Z431";

    const label = document.createElement("div");
    label.className = "access-error-label";
    label.textContent = "ZONE-431 — SÉCURITÉ";

    const title = document.createElement("h1");
    title.textContent = "Accès indisponible";

    const description = document.createElement("p");
    description.textContent = message;

    const link = document.createElement("a");
    link.className = "access-error-link";
    link.href = LOGIN_URL;
    link.textContent = "RETOUR AU SITE PUBLIC";

    panel.append(
        mark,
        label,
        title,
        description,
        link
    );

    errorPage.appendChild(panel);

    document.body.appendChild(errorPage);

}


/* =====================================================
   REDIRECTION
   ===================================================== */

function redirectToLogin() {

    window.location.replace(LOGIN_URL);

}


/* =====================================================
   NOTIFICATIONS
   ===================================================== */

function showToast(message) {

    const toast = document.getElementById("toast");

    if (!toast) {
        return;
    }

    toast.textContent = message;
    toast.classList.add("visible");

    clearTimeout(toastTimeout);

    toastTimeout = setTimeout(() => {

        toast.classList.remove("visible");

    }, 3500);

}


/* =====================================================
   INITIALISATION DES INITIALES
   ===================================================== */

function getInitials(name) {

    if (!name || typeof name !== "string") {
        return "--";
    }

    const parts = name.trim().split(/\s+/);

    if (parts.length === 1) {
        return parts[0].substring(0, 2).toUpperCase();
    }

    return (
        parts[0].charAt(0) +
        parts[parts.length - 1].charAt(0)
    ).toUpperCase();

}
