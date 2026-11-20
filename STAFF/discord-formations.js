
"use strict";

(() => {
    const $ = (id) => document.getElementById(id);
    const list = $("departmentWebhookList");
    let client = null;
    let toastTimer = null;

    function toast(message, error = false) {
        const element = $("toast");
        element.textContent = message;
        element.classList.toggle("error", error);
        element.classList.add("visible");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => element.classList.remove("visible"), 4000);
    }

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, character => ({
            "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
        })[character]);
    }

    function toHex(value) {
        return "#" + Number(value || 10893347).toString(16).padStart(6, "0").slice(-6);
    }

    function validWebhook(value) {
        if (!value) return true;
        try {
            const url = new URL(value);
            return url.protocol === "https:" &&
                ["discord.com", "discordapp.com"].includes(url.hostname) &&
                url.pathname.startsWith("/api/webhooks/");
        } catch {
            return false;
        }
    }

    function validAvatar(value) {
        if (!value) return true;
        try {
            return new URL(value).protocol === "https:";
        } catch {
            return false;
        }
    }

    function renderDepartment(department, config) {
        const code = escapeHTML(department.code);
        const name = escapeHTML(department.name);
        const enabled = config?.enabled !== false;
        const template = config?.message_template ||
            "**INSCRIPTION À UNE FORMATION**\n\n{pseudo} a bien été inscrit à la {formation}.";
        return `
            <article class="discord-webhook-card" data-department="${code}" data-has-webhook="${config?.has_webhook ? "true" : "false"}">
                <span class="department-code">${code}</span>
                <h2>${name}</h2>
                <form class="discord-webhook-form">
                    <label class="field full">
                        <span>URL du webhook Discord</span>
                        <input name="webhook_url" type="password" autocomplete="new-password" placeholder="${config?.has_webhook ? "Laisser vide pour conserver le webhook actuel" : "https://discord.com/api/webhooks/..."}" value="">
                        <small>Le secret reste côté serveur. Laissez vide pour conserver le webhook déjà enregistré.</small>
                    </label>
                    <label class="field">
                        <span>Nom affiché du bot</span>
                        <input name="webhook_username" type="text" maxlength="80" value="${escapeHTML(config?.webhook_username || "ZONE-431")}">
                    </label>
                    <label class="field">
                        <span>Avatar du bot (URL HTTPS, facultatif)</span>
                        <input name="avatar_url" type="url" placeholder="https://..." value="${escapeHTML(config?.avatar_url || "")}">
                    </label>
                    <label class="field full">
                        <span>Modèle du message</span>
                        <textarea name="message_template" maxlength="1900" required>${escapeHTML(template)}</textarea>
                        <small>Variables : {pseudo}, {formation}, {departement}</small>
                    </label>
                    <div class="field">
                        <span>Couleur de l'encart Discord</span>
                        <div class="discord-inline-field">
                            <input name="embed_color" type="color" value="${toHex(config?.embed_color)}">
                            <small>Appliquée à l'encart du message.</small>
                        </div>
                    </div>
                    <label class="discord-enabled">
                        <input name="enabled" type="checkbox" ${enabled ? "checked" : ""}>
                        Activer les notifications pour ce département
                    </label>
                    <div class="discord-form-actions">
                        <p class="discord-webhook-status">${config?.has_webhook ? "Webhook configuré" : "Aucun webhook enregistré"}</p>
                        <button class="button button-secondary" type="button" data-test ${config?.has_webhook ? "" : "disabled"}>Envoyer un test</button>
                        <button class="button button-primary" type="submit">Enregistrer la configuration</button>
                    </div>
                </form>
            </article>
        `;
    }

    async function load() {
        try {
            client = window.Zone431Auth.client;
            const { data: sessionData, error: sessionError } = await client.auth.getSession();
            if (sessionError) throw sessionError;
            if (!sessionData?.session?.user) throw new Error("Aucune session STAFF active.");

            const { data: canAccess, error: accessError } = await client.rpc("has_staff_module_permission", {
                p_module_code: "discord_notifications",
                p_action: "access"
            });
            if (accessError) throw accessError;
            if (canAccess !== true) throw new Error("Vous ne disposez pas de l'autorisation d'accès au module 14.");

            const { data: canWrite, error: writeError } = await client.rpc("has_staff_module_permission", {
                p_module_code: "discord_notifications",
                p_action: "write"
            });
            if (writeError) throw writeError;
            if (canWrite !== true) throw new Error("La modification du module 14 n'est pas autorisée pour votre compte.");

            const { data, error } = await client.functions.invoke("manage-department-webhook", {
                body: { action: "list" }
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Impossible de charger les configurations.");

            const configByDepartment = new Map(
                (data.configs || []).map(config => [config.department_code, config])
            );
            list.innerHTML = (data.departments || [])
                .map(department => renderDepartment(department, configByDepartment.get(department.code)))
                .join("") || '<div class="empty-state">Aucun département configuré.</div>';

            $("settingsContent").classList.remove("hidden");
            list.addEventListener("submit", saveConfiguration);
            list.addEventListener("click", testWebhook);
        } catch (error) {
            console.error("[ZONE-431] Configuration Discord :", error);
            $("accessDenied").classList.remove("hidden");
            $("accessDenied").querySelector("p").textContent = error.message || "Accès refusé.";
        }
    }

    async function testWebhook(event) {
        const button = event.target.closest("[data-test]");
        if (!button) return;
        const card = button.closest("[data-department]");
        if (!card || card.dataset.hasWebhook !== "true") {
            toast("Enregistrez d'abord un webhook pour ce département.", true);
            return;
        }
        button.disabled = true;
        const previousText = button.textContent;
        button.textContent = "ENVOI...";
        try {
            const { data, error } = await client.functions.invoke("manage-department-webhook", {
                body: { action: "test", department_code: card.dataset.department }
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Le message de test n'a pas pu être envoyé.");
            toast("Message de test envoyé pour " + card.dataset.department + ".");
        } catch (error) {
            console.error("[ZONE-431] Test webhook :", error);
            toast(error.message || "Échec de l'envoi du test.", true);
        } finally {
            button.disabled = false;
            button.textContent = previousText;
        }
    }

    async function saveConfiguration(event) {
        if (!event.target.matches("form")) return;
        event.preventDefault();

        const form = event.target;
        const card = form.closest("[data-department]");
        const departmentCode = card.dataset.department;
        const values = new FormData(form);
        const webhookUrl = String(values.get("webhook_url") || "").trim();
        const avatarUrl = String(values.get("avatar_url") || "").trim();
        const template = String(values.get("message_template") || "").trim();
        const username = String(values.get("webhook_username") || "ZONE-431").trim();
        const color = String(values.get("embed_color") || "#a52c33");

        if ((!webhookUrl && card.dataset.hasWebhook !== "true") || !validWebhook(webhookUrl)) {
            toast("Renseignez une URL de webhook Discord valide.", true);
            return;
        }
        if (!validAvatar(avatarUrl)) {
            toast("L'avatar doit être une URL HTTPS valide.", true);
            return;
        }
        if (!template || template.length > 1900 || !username || username.length > 80) {
            toast("Vérifiez le nom du bot et le modèle du message.", true);
            return;
        }

        const button = form.querySelector("button[type='submit']");
        button.disabled = true;
        button.textContent = "ENREGISTREMENT...";

        try {
            const { data, error } = await client.functions.invoke("manage-department-webhook", {
                body: {
                    action: "save",
                    department_code: departmentCode,
                    webhook_url: webhookUrl,
                    enabled: form.elements.enabled.checked,
                    message_template: template,
                    webhook_username: username,
                    avatar_url: avatarUrl,
                    embed_color: parseInt(color.slice(1), 16)
                }
            });
            if (error) throw error;
            if (!data?.success) throw new Error(data?.error || "Enregistrement impossible.");

            card.dataset.hasWebhook = "true";
            card.querySelector("[data-test]")?.removeAttribute("disabled");
            form.elements.webhook_url.value = "";
            form.elements.webhook_url.placeholder = "Laisser vide pour conserver le webhook actuel";
            const status = card.querySelector(".discord-webhook-status");
            status.textContent = "Configuration enregistrée — webhook sécurisé";
            toast("Configuration Discord enregistrée pour " + departmentCode + ".");
        } catch (error) {
            console.error("[ZONE-431] Enregistrement webhook :", error);
            toast(error.message || "Impossible d'enregistrer cette configuration.", true);
        } finally {
            button.disabled = false;
            button.textContent = "Enregistrer la configuration";
        }
    }

    document.addEventListener("DOMContentLoaded", load);
})();
