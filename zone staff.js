/* =========================================================
   ZONE-431 // STAFF
   Interface + verrouillage + gestion des permissions
   ========================================================= */


document.addEventListener("DOMContentLoaded", () => {

    const accessLevel =
        document.getElementById("staff-access-level");

    const sessionRole =
        document.getElementById("staff-session-role");

    const sessionStatus =
        document.getElementById("staff-session-status");

    const systemSession =
        document.getElementById("system-session");

    const clock =
        document.getElementById("staff-system-clock");


    /* =====================================================
       PERMISSIONS PAR RÔLE
       ===================================================== */

    const rolePermissions = {

        "ADMINISTRATEUR": [
            "rosters",
            "scripts",
            "sanctions",
            "blacklist",
            "whitelist",
            "rapports",
            "demandes",
            "recensement",
            "gestion"
        ],

        "MANAGER MOD": [
            "rosters",
            "scripts",
            "sanctions",
            "blacklist",
            "whitelist",
            "recensement"
        ],

        "MANAGER ANIM": [
            "rosters",
            "scripts",
            "sanctions",
            "blacklist",
            "whitelist",
            "rapports",
            "demandes",
            "recensement"
        ],

        "MODÉRATION": [
            "rosters",
            "scripts",
            "sanctions",
            "blacklist",
            "whitelist"
        ],

        "ANIMATION": [
            "rosters",
            "scripts",
            "whitelist",
            "rapports",
            "demandes"
        ]

    };


    /* =====================================================
       VÉRIFICATION SESSION
       ===================================================== */

    function checkAuthentication() {

        const authenticated =
            sessionStorage.getItem(
                "zone431_staff_authenticated"
            );

        const role =
            sessionStorage.getItem(
                "zone431_role"
            );


        if (authenticated !== "true") {

            document.body.classList.remove(
                "staff-authenticated"
            );

            document.body.classList.add(
                "staff-unauthenticated"
            );


            if (accessLevel) {
                accessLevel.textContent =
                    "ACCÈS REQUIS";
            }


            if (sessionRole) {
                sessionRole.textContent =
                    "NON AUTHENTIFIÉ";
            }


            if (sessionStatus) {
                sessionStatus.textContent =
                    "AUTHENTIFICATION REQUISE";
            }


            if (systemSession) {
                systemSession.textContent =
                    "BLOQUÉE";
            }


            /*
             * Aucun module ne doit être considéré
             * comme accessible avant authentification.
             */
            hideUnauthorizedModules([]);


            if (
                typeof window.openStaffAccess === "function"
            ) {

                window.openStaffAccess();

            }


            return false;
        }


        document.body.classList.remove(
            "staff-unauthenticated"
        );

        document.body.classList.add(
            "staff-authenticated"
        );


        const formattedRole =
            role
                ? role.toUpperCase()
                : "";


        if (formattedRole) {

            if (accessLevel) {
                accessLevel.textContent =
                    formattedRole;
            }


            if (sessionRole) {
                sessionRole.textContent =
                    formattedRole;
            }

        }


        if (sessionStatus) {
            sessionStatus.textContent =
                "SESSION ACTIVE";
        }


        if (systemSession) {
            systemSession.textContent =
                "AUTORISÉE";
        }


        /*
         * Application des permissions
         */
        applyPermissions(formattedRole);


        return true;
    }


    /* =====================================================
       APPLICATION DES PERMISSIONS
       ===================================================== */

    function applyPermissions(role) {

        const permissions =
            rolePermissions[role] || [];


        hideUnauthorizedModules(
            permissions
        );


        console.log(
            `[ZONE-431] Rôle détecté : ${role}`
        );

        console.log(
            "[ZONE-431] Permissions :",
            permissions
        );
    }


    /* =====================================================
       MASQUAGE DES MODULES NON AUTORISÉS
       ===================================================== */

    function hideUnauthorizedModules(permissions) {

        document
            .querySelectorAll(
                ".staff-module[data-staff-permission]"
            )
            .forEach(module => {

                const requiredPermission =
                    module.getAttribute(
                        "data-staff-permission"
                    );


                if (
                    permissions.includes(
                        requiredPermission
                    )
                ) {

                    module.style.display = "";

                } else {

                    module.style.display = "none";

                }

            });


        /*
         * Mise à jour du nombre de modules visibles.
         */
        const moduleSection =
            document.querySelector(
                ".staff-modules-section .section-code"
            );


        if (moduleSection) {

            const visibleModules =
                document.querySelectorAll(
                    ".staff-module:not([style*='display: none'])"
                ).length;


            moduleSection.textContent =
                `MODULES // ${String(visibleModules).padStart(3, "0")}`;

        }

    }


    /* =====================================================
       RAFRAÎCHISSEMENT APRÈS AUTHENTIFICATION
       ===================================================== */

    window.refreshStaffInterface = () => {

        checkAuthentication();

    };


    /* =====================================================
       HORLOGE
       ===================================================== */

    function updateClock() {

        if (!clock) {
            return;
        }


        const now =
            new Date();


        const hours =
            String(
                now.getHours()
            ).padStart(2, "0");


        const minutes =
            String(
                now.getMinutes()
            ).padStart(2, "0");


        const seconds =
            String(
                now.getSeconds()
            ).padStart(2, "0");


        clock.textContent =
            `${hours}:${minutes}:${seconds}`;

    }


    updateClock();

    setInterval(
        updateClock,
        1000
    );


    /* =====================================================
       MODULES
       ===================================================== */

    document
        .querySelectorAll(".staff-module")
        .forEach((module, index) => {

            module.addEventListener(
                "mouseenter",
                () => {

                    module.setAttribute(
                        "data-hover",
                        `MODULE ${String(index + 1).padStart(2, "0")}`
                    );

                }
            );


            module.addEventListener(
                "mouseleave",
                () => {

                    module.removeAttribute(
                        "data-hover"
                    );

                }
            );

        });


    /* =====================================================
       INITIALISATION
       ===================================================== */

    checkAuthentication();


    console.log(
        "%cZONE-431 // STAFF",
        "color:#3d9cff;font-weight:bold;"
    );


    console.log(
        "%cInterface initialisée.",
        "color:#7d8996;"
    );

});