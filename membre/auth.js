
/* =========================================================
   ZONE-431 — AUTHENTIFICATION CENTRALE
   Fichier : membre/auth.js
   ========================================================= */

(() => {
    "use strict";

    const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
    const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

    if (!window.supabase) {
        console.error("[ZONE-431] La bibliothèque Supabase est absente.");
        return;
    }

    const client = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    async function getAccess() {
        const { data: sessionData, error: sessionError } =
            await client.auth.getSession();

        if (sessionError) {
            return { status: "error", error: sessionError };
        }

        const session = sessionData.session;
        if (!session) return { status: "signed_out" };

        const user = session.user;
        if (!user || user.is_anonymous === true) {
            return { status: "anonymous" };
        }

        // Le contrôle est vérifié avant toute lecture du profil membre.
        const { data: sessionIsCurrent, error: validationError } =
            await client.rpc("rp_validate_current_session");

        if (validationError) {
            return { status: "error", error: validationError };
        }

        if (sessionIsCurrent !== true) {
            const { error: signOutError } =
                await client.auth.signOut({ scope: "local" });

            if (signOutError) {
                console.warn("[ZONE-431] Nettoyage de la session RP invalide impossible :", signOutError);
            }

            return { status: "signed_out" };
        }

        const { data: profile, error: profileError } = await client
            .from("rp_member_profiles")
            .select(`
                status,
                display_name,
                department,
                grade,
                personnel_id,
                personnel_function,
                integration_date
            `)
            .eq("user_id", user.id)
            .maybeSingle();

        if (profileError) {
            return { status: "error", error: profileError };
        }

        if (!profile) return { status: "unknown" };

        return { status: profile.status, user, profile };
    }

    async function protectPage() {
        const access = await getAccess();

        if (access.status !== "authorized") {
            const reasons = {
                signed_out: "login",
                anonymous: "login",
                pending: "pending",
                rejected: "rejected",
                suspended: "suspended",
                unknown: "unknown",
                error: "error"
            };

            const reason = reasons[access.status] || "unknown";

            window.location.replace(
                `accueil.html?reason=${encodeURIComponent(reason)}`
            );

            return null;
        }

        return access;
    }

    async function signOut() {
        const { error } = await client.auth.signOut({ scope: "local" });

        if (error) {
            throw error;
        }
    }

    function subscribe(callback) {
        const { data } = client.auth.onAuthStateChange(
            (event, session) => {
                queueMicrotask(() => {
                    callback(event, session);
                });
            }
        );

        return data.subscription;
    }

    window.Zone431Auth = {
        client,
        getAccess,
        protectPage,
        signOut,
        subscribe
    };
})();


/* Chargement du pied de page juridique commun */
(() => {
  const current = document.currentScript;
  if (!current) return;
  const legal = document.createElement("script");
  legal.src = new URL("../mentions-legales.js", current.src).href;
  legal.defer = true;
  document.head.appendChild(legal);
})();
