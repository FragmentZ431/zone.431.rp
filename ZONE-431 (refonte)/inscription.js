
document.addEventListener("DOMContentLoaded", () => {
    "use strict";

    // CONFIGURATION SUPABASE — ZONE-431
    const SUPABASE_URL = "https://pvtrlplsplyigvxiykce.supabase.co";
    const SUPABASE_KEY = "sb_publishable_iwAj_zFrWEsMcqUKNINwJw_Po3QAwDG";

    // ÉLÉMENTS HTML
    const form = document.getElementById("registerForm");
    const submitButton = document.getElementById("submitButton");
    const message = document.getElementById("formMessage");

    const emailInput = document.getElementById("email");
    const passwordInput = document.getElementById("password");
    const robloxInput = document.getElementById("roblox");
    const discordInput = document.getElementById("discord");

    if (
        !form ||
        !submitButton ||
        !message ||
        !emailInput ||
        !passwordInput ||
        !robloxInput ||
        !discordInput
    ) {
        console.error("[ZONE-431] Formulaire incomplet.");
        return;
    }

    // VÉRIFICATION DE LA BIBLIOTHÈQUE
    if (
        !window.supabase ||
        typeof window.supabase.createClient !== "function"
    ) {
        showMessage(
            "Le service d'authentification est indisponible. Rechargez la page.",
            "error"
        );

        submitButton.disabled = true;
        return;
    }

    // CLIENT SUPABASE
    const supabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_KEY
    );

    // AFFICHAGE DES MESSAGES
    function showMessage(text, type = "error") {
        message.textContent = text;
        message.className = `form-message ${type}`;
    }

    // ÉTAT DU BOUTON
    function setLoading(loading) {
        submitButton.disabled = loading;

        const label = submitButton.querySelector("span:first-child");

        if (label) {
            label.textContent = loading
                ? "CRÉATION DU COMPTE..."
                : "CRÉER MON COMPTE";
        }
    }

    // INSCRIPTION
    form.addEventListener("submit", async event => {
        event.preventDefault();

        const email = emailInput.value.trim();
        const password = passwordInput.value;
        const roblox = robloxInput.value.trim();
        const discord = discordInput.value.trim();

        message.textContent = "";
        message.className = "form-message hidden";

        // VALIDATION
        if (!email || !password || !roblox || !discord) {
            showMessage(
                "Veuillez compléter tous les champs du formulaire.",
                "error"
            );
            return;
        }

        if (password.length < 8) {
            showMessage(
                "Votre mot de passe doit contenir au moins 8 caractères.",
                "error"
            );
            return;
        }

        if (roblox.length < 3) {
            showMessage(
                "Veuillez vérifier votre pseudo Roblox.",
                "error"
            );
            return;
        }

        if (discord.length < 2) {
            showMessage(
                "Veuillez vérifier votre pseudo Discord.",
                "error"
            );
            return;
        }

        setLoading(true);

        try {
            // CRÉATION DU COMPTE AUTHENTIFICATION
            const { data, error } = await supabaseClient.auth.signUp({
                email,
                password,

                options: {
                    data: {
                        display_name: roblox,
                        roblox_username: roblox,
                        discord_username: discord
                    }
                }
            });

            if (error) {
                throw error;
            }

            if (!data.user) {
                throw new Error(
                    "Supabase n'a retourné aucun utilisateur."
                );
            }

            // COMPTE CRÉÉ
            form.reset();

            if (data.session) {
                showMessage(
                    "Votre compte a été créé. Votre demande d'accès RP est enregistrée et attend la validation d'un administrateur.",
                    "success"
                );

            } else {
                showMessage(
                    "Votre compte a été créé. Consultez votre boîte e-mail pour confirmer votre adresse. Votre accès RP restera en attente de validation administrative.",
                    "success"
                );
            }

            console.info(
                "[ZONE-431] Inscription effectuée.",
                {
                    userId: data.user.id,
                    emailConfirmationRequired: !data.session
                }
            );

        } catch (error) {
            console.error("[ZONE-431] Erreur d'inscription :", error);

            let errorMessage =
                "Une erreur est survenue lors de la création du compte.";

            if (error.message?.toLowerCase().includes("already registered")) {
                errorMessage =
                    "Cette adresse e-mail possède déjà un compte.";
            } else if (
                error.message?.toLowerCase().includes("password")
            ) {
                errorMessage =
                    "Le mot de passe ne respecte pas les exigences de sécurité.";
            } else if (
                error.message?.toLowerCase().includes("email")
            ) {
                errorMessage =
                    "L'adresse e-mail renseignée est invalide.";
            } else if (
                error.message?.toLowerCase().includes("network")
            ) {
                errorMessage =
                    "Impossible de contacter Supabase. Vérifiez votre connexion.";
            }

            showMessage(errorMessage, "error");

        } finally {
            setLoading(false);
        }
    });

});
