
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
            <article class="discord-webhook-card" data-department="${code}">
                <span class="department-code">${code}</span>
                <h2>${name}</h2>
                <form class="discord-webhook-form">
                    <label class="field full">
                        <span>URL du webhook Discord</span>
                        <input name="webhook_url" type="password" autocomplete="off" placeholder="https://discord.com/api/webhooks/..." value="${escapeHTML(config?.webhook_url || "")}">
                        <small>Masquée dans le formulaire. Seuls les administrateurs peuvent modifier cette valeur.</small>
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
                        <p class="discord-webhook-status">${config?.webhook_url ? "Webhook configuré" : "Aucun webhook enregistré"}</p>
                        <button class="button button-primary" type="submit">Enregistrer la configuration</button>
                    </div>
                </form>
            </article>
        `;
    }

    async function load() {
        try {
            const access = await window.Zone431Auth.getAccess();
            if (access.status !== "authorized") throw new Error("Session membre non autorisée.");
            client = window.Zone431Auth.client;

            const { data: role, error: roleError } = await client.rpc("current_staff_role");
            if (roleError) throw roleError;
            if (role !== "ADMINISTRATEUR") throw new Error("Ce module est réservé aux administrateurs.");

            const [departmentsResult, configsResult] = await Promise.all([
                client.from("rp_departments").select("code,name").order("code"),
                client.from("department_discord_webhooks")
                    .select("department_code,webhook_url,enabled,message_template,webhook_username,avatar_url,embed_color")
            ]);
            if (departmentsResult.error) throw departmentsResult.error;
            if (configsResult.error) throw configsResult.error;

            const configByDepartment = new Map(
                (configsResult.data || []).map(config => [config.department_code, config])
            );
            list.innerHTML = (departmentsResult.data || [])
                .map(department => renderDepartment(department, configByDepartment.get(department.code)))
                .join("") || '<div class="empty-state">Aucun département configuré.</div>';

            $("settingsContent").classList.remove("hidden");
            list.addEventListener("submit", saveConfiguration);
        } catch (error) {
            console.error("[ZONE-431] Configuration Discord :", error);
            $("accessDenied").classList.remove("hidden");
            $("accessDenied").querySelector("p").textContent = error.message || "Accès refusé.";
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

        if (!webhookUrl || !validWebhook(webhookUrl)) {
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
            const { error } = await client.from("department_discord_webhooks").upsert({
                department_code: departmentCode,
                webhook_url: webhookUrl,
                enabled: form.elements.enabled.checked,
                message_template: template,
                webhook_username: username,
                avatar_url: avatarUrl,
                embed_color: parseInt(color.slice(1), 16),
                updated_at: new Date().toISOString()
            }, { onConflict: "department_code" });
            if (error) throw error;

            const status = card.querySelector(".discord-webhook-status");
            status.textContent = "Configuration enregistrée";
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
