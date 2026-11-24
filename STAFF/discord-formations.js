
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
        const numeric = Number(value ?? 10893347);
        const safe = Number.isInteger(numeric) && numeric >= 0 && numeric <= 16777215 ? numeric : 10893347;
        return "#" + safe.toString(16).padStart(6, "0").slice(-6);
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
            "**INSCRIPTION À UNE FORMATION**\n\n{prenom} {nom} ({pseudo}) a bien été inscrit à la formation **{formation}**.";
        const accreditationTemplate = config?.accreditation_message_template ||
            "**CHANGEMENT D’ACCRÉDITATION**\n\n{pseudo} : {ancien} → {nouveau}\nDépartement : {departement}";
        const gradeTemplate = config?.grade_message_template ||
            "**CHANGEMENT DE GRADE**\n\n{pseudo} : {ancien} → {nouveau}\nDépartement : {departement}";
        const closureTemplate = config?.registration_closed_message_template ||
            "**INSCRIPTIONS CLÔTURÉES**\n\nLes inscriptions à la formation **{formation}** sont maintenant clôturées.\nDépartement : {departement}";
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
                        <span>Avatar du bot</span>
                        <input name="avatar_url" type="url" placeholder="URL HTTPS ou importez une image" value="${escapeHTML(config?.avatar_url || "")}">
                        <div class="discord-media-actions">
                            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload-for="avatar_url">
                            <button class="button button-secondary" type="button" data-delete-media="avatar_url">Supprimer l'image</button>
                        </div>
                    </label>
                    <label class="field full">
                        <span>Modèle du message</span>
                        <textarea name="message_template" maxlength="1900" required>${escapeHTML(template)}</textarea>
                        <small>Variables : {pseudo}, {prenom}, {nom}, {formation}, {departement}</small>
                    </label>
                    <label class="field full">
                        <span>Message — changement d’accréditation</span>
                        <textarea name="accreditation_message_template" maxlength="1900" required>${escapeHTML(accreditationTemplate)}</textarea>
                        <small>Variables : {pseudo}, {ancien}, {nouveau}, {departement}, {accreditation}, {grade}</small>
                    </label>
                    <label class="field full">
                        <span>Message — clôture des inscriptions</span>
                        <textarea name="registration_closed_message_template" maxlength="1900" required>${escapeHTML(closureTemplate)}</textarea>
                        <small>Variables : {formation}, {departement}</small>
                    </label>
                    <label class="field full">
                        <span>Message — changement de grade</span>
                        <textarea name="grade_message_template" maxlength="1900" required>${escapeHTML(gradeTemplate)}</textarea>
                        <small>Variables : {pseudo}, {ancien}, {nouveau}, {departement}, {grade}, {accreditation}</small>
                    </label>
                    <label class="field">
                        <span>Titre de l'Embed (facultatif)</span>
                        <input name="embed_title_template" maxlength="256" value="${escapeHTML(config?.embed_title_template || "{departement} // NOTIFICATION")}">
                        <small>Variables : {pseudo}, {formation}, {departement}, {ancien}, {nouveau}, {grade}, {accreditation}</small>
                    </label>
                    <label class="field">
                        <span>Signature / pied de page</span>
                        <input name="embed_footer" maxlength="2048" value="${escapeHTML(config?.embed_footer || "ZONE-431")}">
                    </label>
                    <label class="field">
                        <span>Auteur affiché (facultatif)</span>
                        <input name="embed_author_name" maxlength="256" value="${escapeHTML(config?.embed_author_name || "")}">
                    </label>
                    <label class="field">
                        <span>Lien de l'auteur (HTTPS, facultatif)</span>
                        <input name="embed_author_url" type="url" value="${escapeHTML(config?.embed_author_url || "")}">
                    </label>
                    <label class="field">
                        <span>Icône de l'auteur (facultatif)</span>
                        <input name="embed_author_icon_url" type="url" placeholder="URL HTTPS ou importez une image" value="${escapeHTML(config?.embed_author_icon_url || "")}">
                        <div class="discord-media-actions">
                            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload-for="embed_author_icon_url">
                            <button class="button button-secondary" type="button" data-delete-media="embed_author_icon_url">Supprimer l'image</button>
                        </div>
                    </label>

                    <label class="field">
                        <span>Miniature de l'Embed</span>
                        <input name="embed_thumbnail_url" type="url" placeholder="URL HTTPS ou importez une image" value="${escapeHTML(config?.embed_thumbnail_url || "")}">
                        <div class="discord-media-actions">
                            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload-for="embed_thumbnail_url">
                            <button class="button button-secondary" type="button" data-delete-media="embed_thumbnail_url">Supprimer l'image</button>
                        </div>
                    </label>
                    <label class="field">
                        <span>Image principale de l'Embed</span>
                        <input name="embed_image_url" type="url" placeholder="URL HTTPS ou importez une image" value="${escapeHTML(config?.embed_image_url || "")}">
                        <div class="discord-media-actions">
                            <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-upload-for="embed_image_url">
                            <button class="button button-secondary" type="button" data-delete-media="embed_image_url">Supprimer l'image</button>
                        </div>
                    </label>
                    <label class="discord-enabled">
                        <input name="embed_timestamp" type="checkbox" ${config?.embed_timestamp !== false ? "checked" : ""}>
                        Afficher la date et l'heure d'envoi
                    </label>
                    <div class="discord-preview-wrap full">
                        <span class="field-label">Aperçu du rendu Discord</span>
                        <div class="discord-preview" data-preview>
                            <div class="discord-preview-accent"></div>
                            <div class="discord-preview-content">
                                <div class="discord-preview-author" data-preview-author></div>
                                <div class="discord-preview-title" data-preview-title>NOTIFICATION DÉPARTEMENTALE</div>
                                <div class="discord-preview-description" data-preview-description>Un aperçu de votre message apparaîtra ici.</div>
                                <img class="discord-preview-thumbnail" data-preview-thumbnail alt="" hidden>
                                <div class="discord-preview-footer" data-preview-footer>ZONE-431</div>
                            </div>
                        </div>
                    </div>
                    <div class="field">
                        <span>Couleur de l'encart Discord</span>
                        <div class="discord-inline-field">
                            <input name="embed_color" type="color" value="${toHex(config?.embed_color)}">
                            <input name="embed_color_hex" type="text" inputmode="text" maxlength="7" pattern="#[0-9a-fA-F]{6}" aria-label="Code hexadécimal de la couleur" value="${toHex(config?.embed_color)}">
                            <small>Choisissez une couleur ou saisissez son code HEX. Elle sera conservée après actualisation.</small>
                        </div>
                    </div>
                    <label class="discord-enabled">
                        <input name="enabled" type="checkbox" ${enabled ? "checked" : ""}>
                        Activer les notifications pour ce département
                    </label>
                    <div class="discord-form-actions">
                        <p class="discord-webhook-status">${config?.has_webhook ? "Webhook configuré" : "Aucun webhook enregistré"}</p>
                        <select name="test_event" aria-label="Type de notification à tester">
                            <option value="training_registration">Test : inscription</option>
                            <option value="training_registration_closed">Test : clôture des inscriptions</option>
                            <option value="accreditation_changed">Test : accréditation</option>
                            <option value="grade_changed">Test : grade</option>
                        </select>
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
            list.querySelectorAll("[data-department]").forEach(updatePreview);
            list.addEventListener("input", event => {
                const card = event.target.closest("[data-department]");
                if (card) updatePreview(card);
            });

            list.innerHTML = (data.departments || [])
                .map(department => renderDepartment(department, configByDepartment.get(department.code)))
                .join("") || '<div class="empty-state">Aucun département configuré.</div>';
            list.querySelectorAll("[data-department]").forEach(updatePreview);

            $("settingsContent").classList.remove("hidden");
            list.addEventListener("submit", saveConfiguration);
            list.addEventListener("click", event => {
                testWebhook(event);
                deleteMedia(event);
            });
            list.addEventListener("change", uploadMedia);
            list.addEventListener("input", event => {
                const card = event.target.closest("[data-department]");
                if (!card) return;
                if (event.target.name === "embed_color_hex") {
                    const hex = event.target.value.trim();
                    if (/^#[0-9a-fA-F]{6}$/.test(hex)) formColor(card, hex);
                } else if (event.target.name === "embed_color") {
                    const hex = event.target.value;
                    const field = card.querySelector("[name='embed_color_hex']");
                    if (field) field.value = hex;
                }
            });
        } catch (error) {
            console.error("[ZONE-431] Configuration Discord :", error);
            $("accessDenied").classList.remove("hidden");
            $("accessDenied").querySelector("p").textContent = error.message || "Accès refusé.";
        }
    }

    function updatePreview(card) {
        const form = card.querySelector("form");
        if (!form) return;
        const get = name => form.elements[name]?.value || "";
        const department = card.querySelector("h2")?.textContent || "DÉPARTEMENT";
        const replace = value => String(value || "")
            .replaceAll("{departement}", department)
            .replaceAll("{pseudo}", "Agent Exemple")
            .replaceAll("{prenom}", "Prénom")
            .replaceAll("{nom}", "Nom")
            .replaceAll("{formation}", "Formation de démonstration")
            .replaceAll("{ancien}", "Ancien niveau")
            .replaceAll("{nouveau}", "Nouveau niveau")
            .replaceAll("{grade}", "Agent de Première Classe")
            .replaceAll("{accreditation}", "ACC 2");
        const preview = card.querySelector("[data-preview]");
        if (!preview) return;
        preview.style.setProperty("--preview-color", get("embed_color") || "#a52c33");
        const thumbnail = card.querySelector("[data-preview-thumbnail]");
        if (thumbnail) {
            const source = get("embed_thumbnail_url") || get("embed_image_url");
            thumbnail.hidden = !source;
            thumbnail.src = source || "";
        }
        card.querySelector("[data-preview-title]").textContent = replace(get("embed_title_template") || "{departement} // NOTIFICATION");
        card.querySelector("[data-preview-description]").textContent = replace(get("message_template")) || "Votre contenu apparaîtra ici.";
        card.querySelector("[data-preview-footer]").textContent = get("embed_footer") || "ZONE-431";
        card.querySelector("[data-preview-author]").textContent = get("embed_author_name");
    }

    const DISCORD_ASSET_BUCKET = "zone431-discord-assets";
    const IMAGE_LIMIT = 5 * 1024 * 1024;

    function formColor(card, hex) {
        const picker = card.querySelector("[name='embed_color']");
        if (picker) picker.value = hex;
        updatePreview(card);
    }

    function extensionFor(file) {
        return ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" })[file.type] || "";
    }

    async function uploadMedia(event) {
        const picker = event.target.closest("[data-upload-for]");
        if (!picker?.files?.length) return;
        const card = picker.closest("[data-department]");
        const form = card?.querySelector("form");
        const fieldName = picker.dataset.uploadFor;
        const file = picker.files[0];
        const extension = extensionFor(file);
        if (!extension) {
            toast("Format refusé. Utilisez PNG, JPG, WEBP ou GIF.", true);
            picker.value = "";
            return;
        }
        if (file.size > IMAGE_LIMIT) {
            toast("L'image dépasse la limite de 5 Mo.", true);
            picker.value = "";
            return;
        }
        picker.disabled = true;
        try {
            const path = card.dataset.department + "/" + fieldName + "-" + crypto.randomUUID() + "." + extension;
            const { error: uploadError } = await client.storage.from(DISCORD_ASSET_BUCKET).upload(path, file, {
                cacheControl: "3600", upsert: false, contentType: file.type
            });
            if (uploadError) throw uploadError;
            const { data } = client.storage.from(DISCORD_ASSET_BUCKET).getPublicUrl(path);
            form.elements[fieldName].value = data.publicUrl;
            updatePreview(card);
            const saved = await saveConfiguration({ target: form, preventDefault() {} });
            if (!saved) {
                await client.storage.from(DISCORD_ASSET_BUCKET).remove([path]);
                throw new Error("L'image a été importée, mais la configuration n'a pas pu être enregistrée.");
            }
            toast("Image importée et configuration enregistrée.");
        } catch (error) {
            console.error("[ZONE-431] Import image Discord :", error);
            toast(error.message || "Impossible d'importer cette image.", true);
        } finally {
            picker.disabled = false;
            picker.value = "";
        }
    }

    function storagePathFromPublicUrl(value) {
        try {
            const url = new URL(value);
            const marker = "/storage/v1/object/public/" + DISCORD_ASSET_BUCKET + "/";
            const index = url.pathname.indexOf(marker);
            return index < 0 ? "" : decodeURIComponent(url.pathname.slice(index + marker.length));
        } catch {
            return "";
        }
    }

    async function deleteMedia(event) {
        const button = event.target.closest("[data-delete-media]");
        if (!button) return;
        const card = button.closest("[data-department]");
        const form = card?.querySelector("form");
        const fieldName = button.dataset.deleteMedia;
        const input = form?.elements[fieldName];
        if (!input?.value) {
            toast("Aucune image n'est définie dans ce champ.", true);
            return;
        }
        if (!confirm("Supprimer cette image du stockage Zone-431 et retirer son lien de la configuration ?")) return;
        button.disabled = true;
        try {
            const path = storagePathFromPublicUrl(input.value);
            const previousUrl = input.value;
            input.value = "";
            updatePreview(card);
            const saved = await saveConfiguration({ target: form, preventDefault() {} });
            if (!saved) {
                input.value = previousUrl;
                updatePreview(card);
                throw new Error("La configuration n'a pas pu être mise à jour. L'image n'a pas été supprimée.");
            }
            if (path) {
                const { error } = await client.storage.from(DISCORD_ASSET_BUCKET).remove([path]);
                if (error) throw error;
            }
            toast(path ? "Image supprimée et configuration mise à jour." : "Lien externe retiré de la configuration.");
        } catch (error) {
            console.error("[ZONE-431] Suppression image Discord :", error);
            toast(error.message || "Impossible de supprimer cette image.", true);
        } finally {
            button.disabled = false;
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
                body: {
                    action: "test",
                    department_code: card.dataset.department,
                    event_type: card.querySelector("[name='test_event']")?.value || "training_registration"
                }
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
        const embedTitle = String(values.get("embed_title_template") || "").trim();
        const embedFooter = String(values.get("embed_footer") || "").trim();
        const embedAuthorName = String(values.get("embed_author_name") || "").trim();
        const embedAuthorUrl = String(values.get("embed_author_url") || "").trim();
        const embedThumbnailUrl = String(values.get("embed_thumbnail_url") || "").trim();
        const embedImageUrl = String(values.get("embed_image_url") || "").trim();
        const template = String(values.get("message_template") || "").trim();
        const accreditationTemplate = String(values.get("accreditation_message_template") || "").trim();
        const gradeTemplate = String(values.get("grade_message_template") || "").trim();
        const closureTemplate = String(values.get("registration_closed_message_template") || "").trim();
        const username = String(values.get("webhook_username") || "ZONE-431").trim();
        const color = String(values.get("embed_color_hex") || values.get("embed_color") || "#a52c33").trim();

        if ((!webhookUrl && card.dataset.hasWebhook !== "true") || (webhookUrl && !validWebhook(webhookUrl))) {
            toast("Renseignez une URL de webhook Discord valide.", true);
            return;
        }
        const validHttps = value => {
            if (!value) return true;
            try { return new URL(value).protocol === "https:"; } catch { return false; }
        };
        const authorIconUrl = String(values.get("embed_author_icon_url") || "").trim();
        if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
            toast("Code couleur invalide. Utilisez le format #RRGGBB.", true);
            return;
        }
        if (![avatarUrl, embedAuthorUrl, authorIconUrl, embedThumbnailUrl, embedImageUrl].every(validHttps)) {
            toast("Les URL d'images et de liens doivent être valides et utiliser HTTPS.", true);
            return;
        }
        if (!validAvatar(avatarUrl)) {
            toast("L'avatar doit être une URL HTTPS valide.", true);
            return;
        }
        if (!template || template.length > 1900 ||
            !accreditationTemplate || accreditationTemplate.length > 1900 ||
            !gradeTemplate || gradeTemplate.length > 1900 ||
            !closureTemplate || closureTemplate.length > 1900 ||
            !username || username.length > 80) {
            toast("Vérifiez le nom du bot et les quatre modèles de message.", true);
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
                    accreditation_message_template: accreditationTemplate,
                    grade_message_template: gradeTemplate,
                    registration_closed_message_template: closureTemplate,
                    webhook_username: username,
                    avatar_url: avatarUrl,
                    embed_color: parseInt(color.slice(1), 16),
                    embed_title_template: embedTitle,
                    embed_footer: embedFooter,
                    embed_author_name: embedAuthorName,
                    embed_author_url: embedAuthorUrl,
                    embed_author_icon_url: String(values.get("embed_author_icon_url") || "").trim(),
                    embed_thumbnail_url: embedThumbnailUrl,
                    embed_image_url: embedImageUrl,
                    embed_timestamp: form.elements.embed_timestamp.checked
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
            return true;
        } catch (error) {
            console.error("[ZONE-431] Enregistrement webhook :", error);
            toast(error.message || "Impossible d'enregistrer cette configuration.", true);
            return false;
        } finally {
            button.disabled = false;
            button.textContent = "Enregistrer la configuration";
        }
    }

    document.addEventListener("DOMContentLoaded", load);
})();
