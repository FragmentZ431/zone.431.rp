/* =========================================================
   ZONE-431 // STAFF ACCESS
   Authentification du personnel
   ========================================================= */


/* =========================================================
   CONFIGURATION SUPABASE
   ========================================================= */

const SUPABASE_URL =
    "https://pvtrlplsplyigvxiykce.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";


/* =========================================================
   CLIENT SUPABASE
   ========================================================= */

window.zone431Supabase =
    window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_PUBLISHABLE_KEY
    );


/* =========================================================
   CRÉATION DE LA FENÊTRE
   ========================================================= */

function createStaffAccessModal() {

    if (
        document.getElementById(
            "staff-access-modal"
        )
    ) {
        return;
    }


    const modal =
        document.createElement("div");

    modal.id =
        "staff-access-modal";

    modal.className =
        "staff-access-modal";


    modal.innerHTML = `

        <div class="staff-access-grid"></div>

        <div class="staff-access-scanline"></div>

        <div class="staff-access-box">

            <button
                type="button"
                class="staff-access-close"
                onclick="closeStaffAccess()"
            >
                ×
            </button>


            <div class="staff-access-top">

                <span>
                    ZONE-431 // SECURITY SYSTEM
                </span>

                <span>
                    AUTH-001
                </span>

            </div>


            <div class="staff-access-header">

                <div class="staff-access-code">
                    SCP FOUNDATION // SITE-431
                </div>

                <h2>
                    ACCÈS STAFF
                </h2>

                <p>
                    Authentification requise avant l'accès
                    aux systèmes administratifs.
                </p>

            </div>


            <div class="staff-access-separator"></div>


            <div class="staff-access-form">

                <label
                    for="staff-access-input"
                >
                    CODE D'AUTORISATION
                </label>


                <input
                    id="staff-access-input"
                    class="staff-access-input"
                    type="password"
                    autocomplete="off"
                    spellcheck="false"
                    placeholder="ENTRER LE CODE"
                />


                <div
                    id="staff-access-message"
                    class="staff-access-message"
                ></div>


                <button
                    type="button"
                    id="staff-access-submit"
                    class="staff-access-submit"
                    onclick="checkStaffAccess()"
                >
                    ACCÉDER
                </button>

            </div>


            <div class="staff-access-footer">

                <span>
                    AUTHENTIFICATION SÉCURISÉE
                </span>

                <span>
                    SITE-431
                </span>

            </div>

        </div>
    `;


    document.body.appendChild(modal);


    const input =
        document.getElementById(
            "staff-access-input"
        );


    if (input) {

        input.addEventListener(
            "keydown",
            (event) => {

                if (
                    event.key === "Enter"
                ) {

                    checkStaffAccess();

                }

            }
        );

    }

}


/* =========================================================
   OUVRIR
   ========================================================= */

function openStaffAccess() {

    createStaffAccessModal();


    const modal =
        document.getElementById(
            "staff-access-modal"
        );


    if (!modal) {
        return;
    }


    modal.classList.add("active");


    const input =
        document.getElementById(
            "staff-access-input"
        );


    if (input) {

        setTimeout(() => {

            input.focus();

        }, 150);

    }

}


/* =========================================================
   FERMER
   ========================================================= */

function closeStaffAccess() {

    const modal =
        document.getElementById(
            "staff-access-modal"
        );


    if (!modal) {
        return;
    }


    modal.classList.remove("active");

}


/* =========================================================
   MESSAGE
   ========================================================= */

function showStaffMessage(
    text,
    type = ""
) {

    const message =
        document.getElementById(
            "staff-access-message"
        );


    if (!message) {
        return;
    }


    message.textContent =
        text;

    message.className =
        "staff-access-message";


    if (type) {

        message.classList.add(
            type
        );

    }

}


/* =========================================================
   VÉRIFICATION DU CODE
   ========================================================= */

async function checkStaffAccess() {

    const input =
        document.getElementById(
            "staff-access-input"
        );

    const button =
        document.getElementById(
            "staff-access-submit"
        );


    if (!input || !button) {
        return;
    }


    const enteredCode =
        input.value.trim();


    if (!enteredCode) {

        showStaffMessage(
            "VEUILLEZ ENTRER UN CODE.",
            "error"
        );

        input.focus();

        return;
    }


    button.disabled =
        true;

    button.textContent =
        "VÉRIFICATION...";


    showStaffMessage(
        "VÉRIFICATION DES AUTORISATIONS...",
        "loading"
    );


    try {

        /* =================================================
           VÉRIFICATION DU CLIENT SUPABASE
           ================================================= */

        if (
            !window.zone431Supabase
        ) {

            throw new Error(
                "CLIENT SUPABASE INDISPONIBLE."
            );

        }


        /* =================================================
           SESSION SUPABASE
           ================================================= */

        let {
            data: sessionData
        } =
            await window.zone431Supabase.auth.getSession();


        let session =
            sessionData?.session;


        /* =================================================
           CRÉATION D'UNE SESSION ANONYME
           ================================================= */

        if (!session) {

            const {
                data,
                error
            } =
                await window.zone431Supabase.auth
                    .signInAnonymously();


            if (error) {
                throw error;
            }


            session =
                data?.session;

        }


        if (!session) {

            throw new Error(
                "SESSION SUPABASE INDISPONIBLE."
            );

        }


        /* =================================================
           VÉRIFICATION DU CODE CÔTÉ SERVEUR
           ================================================= */

        const {
            data,
            error
        } =
            await window.zone431Supabase.rpc(
                "check_staff_code",
                {
                    input_code: enteredCode
                }
            );


        if (error) {
            throw error;
        }


        /* =================================================
           CODE REFUSÉ
           ================================================= */

        if (
            !data ||
            !Array.isArray(data) ||
            data.length === 0
        ) {

            showStaffMessage(
                "CODE INCORRECT OU ACCÈS REFUSÉ.",
                "error"
            );


            input.value =
                "";

            input.focus();


            button.disabled =
                false;

            button.textContent =
                "ACCÉDER";


            return;

        }


        /* =================================================
           ACCÈS VALIDÉ
           ================================================= */

        const role =
            data[0].role;


        if (!role) {

            throw new Error(
                "RÔLE STAFF NON RETOURNÉ PAR LE SERVEUR."
            );

        }


        sessionStorage.setItem(
            "zone431_role",
            role
        );


        sessionStorage.setItem(
            "zone431_staff_authenticated",
            "true"
        );


        showStaffMessage(
            "ACCÈS AUTORISÉ.",
            "success"
        );


        button.textContent =
            "ACCÈS AUTORISÉ";


        /* =================================================
           RAFRAÎCHISSEMENT DE L'INTERFACE
           ================================================= */

        setTimeout(() => {

            const currentPage =
                window.location.pathname
                    .split("/")
                    .pop();


            if (
                currentPage ===
                "zone staff.html"
            ) {

                closeStaffAccess();


                document.body.classList.remove(
                    "staff-unauthenticated"
                );


                document.body.classList.add(
                    "staff-authenticated"
                );


                if (
                    typeof window.refreshStaffInterface ===
                    "function"
                ) {

                    window.refreshStaffInterface();

                }


                return;

            }


            window.location.href =
                "zone staff.html";

        }, 500);


    } catch (error) {

        console.error(
            "ZONE-431 // STAFF ACCESS ERROR:",
            error
        );


        console.error(
            "Message:",
            error?.message
        );


        console.error(
            "Code:",
            error?.code
        );


        console.error(
            "Details:",
            error?.details
        );


        console.error(
            "Hint:",
            error?.hint
        );


        showStaffMessage(
            error?.message
                ? `ERREUR : ${error.message}`
                : "ERREUR DE COMMUNICATION AVEC LE SERVEUR.",
            "error"
        );


        button.disabled =
            false;

        button.textContent =
            "ACCÉDER";

    }

}


/* =========================================================
   RÔLE ACTUEL
   ========================================================= */

async function getCurrentStaffRole() {

    try {

        if (
            !window.zone431Supabase
        ) {

            return null;

        }


        const {
            data: sessionData
        } =
            await window.zone431Supabase.auth.getSession();


        if (
            !sessionData?.session
        ) {

            return null;

        }


        const {
            data,
            error
        } =
            await window.zone431Supabase.rpc(
                "current_staff_role"
            );


        if (error) {
            throw error;
        }


        if (
            !data ||
            !Array.isArray(data) ||
            data.length === 0
        ) {

            return null;

        }


        return data[0].role || null;


    } catch (error) {

        console.error(
            "ZONE-431 // ROLE CHECK ERROR:",
            error
        );


        return null;

    }

}


/* =========================================================
   EXPORTS
   ========================================================= */

window.openStaffAccess =
    openStaffAccess;

window.closeStaffAccess =
    closeStaffAccess;

window.checkStaffAccess =
    checkStaffAccess;

window.getCurrentStaffRole =
    getCurrentStaffRole;


/* =========================================================
   INITIALISATION
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {

        createStaffAccessModal();

    }
);