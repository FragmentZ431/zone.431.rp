import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_ORIGIN = "https://fragmentz431.github.io";
const corsHeaders = {
  "Access-Control-Allow-Origin": SITE_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readKey(name: string): string | null {
  const raw = Deno.env.get(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.default === "string" ? parsed.default : null;
  } catch {
    return null;
  }
}

function text(value: unknown, max: number): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
}

function renderTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) output = output.replaceAll(`{${key}}`, value);
  return output.trim().slice(0, 1900);
}

function cleanTemplate(value: unknown, fallback = ""): string {
  return String(value ?? fallback).replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").trim().slice(0, 1900);
}


function safeHttps(value: unknown): string {
  const candidate = text(value, 1000);
  if (!candidate) return "";
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" ? candidate : "";
  } catch {
    return "";
  }
}

function buildEmbed(config: any, description: string, values: Record<string, string>) {
  const titleTemplate = cleanTemplate(config.embed_title_template || "{departement} // NOTIFICATION").slice(0, 256);
  const title = renderTemplate(titleTemplate, values).slice(0, 256);
  const footer = text(config.embed_footer || "ZONE-431", 2048);
  const authorName = text(config.embed_author_name, 256);
  const authorUrl = safeHttps(config.embed_author_url);
  const thumbnailUrl = safeHttps(config.embed_thumbnail_url);
  const imageUrl = safeHttps(config.embed_image_url);
  return {
    description,
    color: Number(config.embed_color) || 10893347,
    ...(title ? { title } : {}),
    ...(footer ? { footer: { text: footer } } : {}),
    ...(authorName ? { author: { name: authorName, ...(authorUrl ? { url: authorUrl } : {}) } } : {}),
    ...(thumbnailUrl ? { thumbnail: { url: thumbnailUrl } } : {}),
    ...(imageUrl ? { image: { url: imageUrl } } : {}),
    ...(config.embed_timestamp !== false ? { timestamp: new Date().toISOString() } : {}),
  };
}

function normalizeRole(value: unknown): string {
  let role: any = value;
  if (Array.isArray(role)) role = role[0];
  if (role && typeof role === "object") {
    role = role.role || role.current_staff_role || role.staff_role || "";
  }
  return String(role || "").toUpperCase().trim();
}

function isWebhook(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["discord.com", "discordapp.com"].includes(url.hostname) &&
      url.pathname.startsWith("/api/webhooks/");
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    if ((req.headers.get("Origin") || "") !== SITE_ORIGIN) {
      return new Response("Origine refusée.", { status: 403 });
    }
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return json({ error: "Méthode non autorisée." }, 405);
  if ((req.headers.get("Origin") || "") !== SITE_ORIGIN) {
    return json({ error: "Origine non autorisée." }, 403);
  }

  try {
    const authorization = req.headers.get("Authorization") || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return json({ error: "Session manquante." }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || readKey("SUPABASE_PUBLISHABLE_KEYS");
    const secretKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || readKey("SUPABASE_SECRET_KEYS");
    if (!supabaseUrl || !publishableKey || !secretKey) {
      return json({ error: "Configuration serveur incomplète." }, 500);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers: { Authorization: "Bearer " + token } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData.user || userData.user.is_anonymous) {
      return json({ error: "Session invalide." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const requestedAction = text(body.action, 20);
    if (requestedAction === "member_change") {
      const { data: role, error: roleError } = await userClient.rpc("current_staff_role");
      if (roleError || !["ADMIN", "ADMINISTRATEUR"].includes(normalizeRole(role))) {
        return json({ error: "Seuls les administrateurs peuvent notifier un changement de dossier membre." }, 403);
      }
    } else {
      const { data: canWrite, error: permissionError } = await userClient.rpc(
        "has_staff_module_permission",
        { p_module_code: "discord_notifications", p_action: "write" },
      );
      if (permissionError || canWrite !== true) {
        return json({ error: "Vous ne disposez pas de la permission de modifier les notifications Discord." }, 403);
      }
    }
    const action = text(body.action, 20);
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "list") {
      const [departmentsResult, configsResult] = await Promise.all([
        adminClient.from("rp_departments").select("code,name").order("code"),
        adminClient.from("department_discord_webhooks")
          .select("department_code,enabled,message_template,accreditation_message_template,grade_message_template,registration_closed_message_template,webhook_username,avatar_url,embed_color,embed_title_template,embed_footer,embed_author_name,embed_author_url,embed_thumbnail_url,embed_image_url,embed_timestamp,webhook_url"),
      ]);
      if (departmentsResult.error) throw departmentsResult.error;
      if (configsResult.error) throw configsResult.error;

      const configs = (configsResult.data || []).map((row: any) => ({
        department_code: row.department_code,
        enabled: row.enabled,
        message_template: row.message_template,
        accreditation_message_template: row.accreditation_message_template,
        grade_message_template: row.grade_message_template,
        registration_closed_message_template: row.registration_closed_message_template,
        webhook_username: row.webhook_username,
        avatar_url: row.avatar_url,
        embed_color: row.embed_color,
        embed_title_template: row.embed_title_template,
        embed_footer: row.embed_footer,
        embed_author_name: row.embed_author_name,
        embed_author_url: row.embed_author_url,
        embed_thumbnail_url: row.embed_thumbnail_url,
        embed_image_url: row.embed_image_url,
        embed_timestamp: row.embed_timestamp,
        has_webhook: Boolean(row.webhook_url),
      }));
      return json({ success: true, departments: departmentsResult.data || [], configs });
    }

    if (action === "member_change") {
      const eventType = text(body.event_type, 40);
      const userId = text(body.user_id, 80);
      const previousValue = text(body.previous_value, 120);
      const newValue = text(body.new_value, 120);
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidPattern.test(userId) || !["grade_changed", "accreditation_changed"].includes(eventType)) {
        return json({ error: "Données de notification membre invalides." }, 400);
      }

      const { data: profile, error: profileError } = await adminClient
        .from("rp_member_profiles")
        .select("user_id,rp_name,display_name,first_name,last_name,status")
        .eq("user_id", userId)
        .maybeSingle();
      if (profileError) throw profileError;
      if (!profile || profile.status !== "authorized") {
        return json({ error: "Le membre n'est pas autorisé." }, 404);
      }

      const { data: assignments, error: assignmentsError } = await adminClient
        .from("rp_member_department_assignments")
        .select("department_code")
        .eq("user_id", userId);
      if (assignmentsError) throw assignmentsError;

      const departmentCodes = [...new Set((assignments || []).map((row: any) => row.department_code).filter(Boolean))];
      if (!departmentCodes.length) {
        return json({ success: true, notificationsConfigured: 0, notificationsSent: 0 });
      }

      const [{ data: configs, error: configError }, { data: departments, error: departmentError }] = await Promise.all([
        adminClient.from("department_discord_webhooks")
          .select("department_code,webhook_url,enabled,accreditation_message_template,grade_message_template,webhook_username,avatar_url,embed_color,embed_title_template,embed_footer,embed_author_name,embed_author_url,embed_thumbnail_url,embed_image_url,embed_timestamp")
          .in("department_code", departmentCodes)
          .eq("enabled", true),
        adminClient.from("rp_departments")
          .select("code,name")
          .in("code", departmentCodes),
      ]);
      if (configError) throw configError;
      if (departmentError) throw departmentError;

      const departmentNames = new Map((departments || []).map((row: any) => [row.code, row.name]));
      const configured = (configs || []).filter((config: any) => config.webhook_url && isWebhook(config.webhook_url));
      let sent = 0;

      for (const config of configured) {
        const template = eventType === "grade_changed"
          ? config.grade_message_template
          : config.accreditation_message_template;
        const rendered = renderTemplate(String(template || ""), {
          pseudo: text(profile.rp_name || profile.display_name || "Membre", 100),
          prenom: text(profile.first_name, 80),
          nom: text(profile.last_name, 80),
          ancien: previousValue || "Non renseigné",
          nouveau: newValue || "Non renseigné",
          departement: text(departmentNames.get(config.department_code) || config.department_code, 120),
          grade: eventType === "grade_changed" ? newValue : "",
          accreditation: eventType === "accreditation_changed" ? newValue : "",
        });
        if (!rendered) continue;

        const response = await fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username: text(config.webhook_username || "ZONE-431", 80),
            ...(config.avatar_url ? { avatar_url: config.avatar_url } : {}),
            embeds: [buildEmbed(config, rendered, {
              departement: text(departmentNames.get(config.department_code) || config.department_code, 120),
              pseudo: text(profile.rp_name || profile.display_name || "Membre", 100),
              ancien: previousValue || "Non renseigné",
              nouveau: newValue || "Non renseigné",
              grade: eventType === "grade_changed" ? newValue : "",
              accreditation: eventType === "accreditation_changed" ? newValue : "",
            })],
            allowed_mentions: { parse: [] },
          }),
        });
        if (response.ok) sent++;
        else console.error("Discord member change webhook error:", config.department_code, response.status, await response.text());
      }

      return json({ success: true, notificationsConfigured: configured.length, notificationsSent: sent });
    }

    if (action === "test") {
      const departmentCode = text(body.department_code, 40);
      const eventType = text(body.event_type, 40);
      const allowedEvents = ["training_registration", "training_registration_closed", "accreditation_changed", "grade_changed"];
      if (!departmentCode || !allowedEvents.includes(eventType)) {
        return json({ error: "Département ou type de test invalide." }, 400);
      }

      const { data: config, error: configError } = await adminClient
        .from("department_discord_webhooks")
        .select("webhook_url,enabled,message_template,accreditation_message_template,grade_message_template,registration_closed_message_template,webhook_username,avatar_url,embed_color,embed_title_template,embed_footer,embed_author_name,embed_author_url,embed_thumbnail_url,embed_image_url,embed_timestamp")
        .eq("department_code", departmentCode)
        .maybeSingle();
      if (configError) throw configError;
      if (!config?.webhook_url || !isWebhook(config.webhook_url)) {
        return json({ error: "Aucun webhook valide n'est configuré pour ce département." }, 404);
      }
      if (config.enabled !== true) {
        return json({ error: "Les notifications sont désactivées pour ce département." }, 400);
      }

      const { data: department } = await adminClient
        .from("rp_departments").select("name").eq("code", departmentCode).maybeSingle();

      const template = eventType === "training_registration"
        ? config.message_template
        : eventType === "training_registration_closed"
          ? config.registration_closed_message_template
          : eventType === "accreditation_changed"
            ? config.accreditation_message_template
            : config.grade_message_template;

      const testMessage = renderTemplate(template || "", {
        pseudo: "Agent Exemple",
        prenom: "Prénom",
        nom: "Nom",
        formation: "Formation de démonstration",
        departement: department?.name || departmentCode,
        ancien: "Ancien niveau",
        nouveau: "Nouveau niveau",
        accreditation: "ACC 2",
        grade: "Agent de Première Classe",
      });
      if (!testMessage) return json({ error: "Le modèle de test est vide." }, 400);

      const response = await fetch(config.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: text(config.webhook_username || "ZONE-431", 80),
          ...(config.avatar_url ? { avatar_url: config.avatar_url } : {}),
          embeds: [buildEmbed(config, testMessage, {
            departement: text(department?.name || departmentCode, 120),
            pseudo: "Agent Exemple",
            formation: "Formation de démonstration",
            ancien: "Ancien niveau",
            nouveau: "Nouveau niveau",
            grade: "Agent de Première Classe",
            accreditation: "ACC 2",
          })],
          allowed_mentions: { parse: [] },
        }),
      });
      if (!response.ok) {
        return json({ error: "Discord a refusé le message de test : " + response.status }, 502);
      }
      return json({ success: true });
    }

    if (action === "save") {
      const departmentCode = text(body.department_code, 40);
      const suppliedWebhook = text(body.webhook_url, 1000);
      const messageTemplate = cleanTemplate(body.message_template);
      const accreditationTemplate = cleanTemplate(body.accreditation_message_template);
      const gradeTemplate = cleanTemplate(body.grade_message_template);
      const closureTemplate = cleanTemplate(body.registration_closed_message_template);
      const username = text(body.webhook_username || "ZONE-431", 80);
      const avatarUrl = text(body.avatar_url, 1000);
      const embedColor = Number(body.embed_color);
      const embedTitleTemplate = cleanTemplate(body.embed_title_template, "");
      const embedFooter = text(body.embed_footer || "ZONE-431", 2048);
      const embedAuthorName = text(body.embed_author_name, 256);
      const embedAuthorUrl = safeHttps(body.embed_author_url);
      const embedThumbnailUrl = safeHttps(body.embed_thumbnail_url);
      const embedImageUrl = safeHttps(body.embed_image_url);
      const embedTimestamp = body.embed_timestamp !== false;


      if (!departmentCode) return json({ error: "Département manquant." }, 400);
      if (!messageTemplate || !accreditationTemplate || !gradeTemplate || !closureTemplate) return json({ error: "Les quatre modèles de message sont obligatoires." }, 400);
      if (!username) return json({ error: "Le nom du bot est obligatoire." }, 400);
      if (body.embed_author_url && !embedAuthorUrl) return json({ error: "Le lien de l'auteur doit être une URL HTTPS valide." }, 400);
      if (body.embed_thumbnail_url && !embedThumbnailUrl) return json({ error: "La miniature doit être une URL HTTPS valide." }, 400);
      if (body.embed_image_url && !embedImageUrl) return json({ error: "L'image principale doit être une URL HTTPS valide." }, 400);
      if (!Number.isInteger(embedColor) || embedColor < 0 || embedColor > 16777215) {
        return json({ error: "Couleur Discord invalide." }, 400);
      }
      if (avatarUrl) {
        try {
          if (new URL(avatarUrl).protocol !== "https:") throw new Error();
        } catch {
          return json({ error: "L'avatar doit être une URL HTTPS valide." }, 400);
        }
      }

      const { data: department, error: departmentError } = await adminClient
        .from("rp_departments").select("code").eq("code", departmentCode).maybeSingle();
      if (departmentError) throw departmentError;
      if (!department) return json({ error: "Département inconnu." }, 404);

      const { data: previous, error: previousError } = await adminClient
        .from("department_discord_webhooks")
        .select("webhook_url")
        .eq("department_code", departmentCode)
        .maybeSingle();
      if (previousError) throw previousError;

      const webhookUrl = suppliedWebhook || previous?.webhook_url || "";
      if (!isWebhook(webhookUrl)) {
        return json({ error: "Renseignez une URL de webhook Discord valide." }, 400);
      }

      const { error: saveError } = await adminClient
        .from("department_discord_webhooks")
        .upsert({
          department_code: departmentCode,
          webhook_url: webhookUrl,
          enabled: body.enabled === true,
          message_template: messageTemplate,
          accreditation_message_template: accreditationTemplate,
          grade_message_template: gradeTemplate,
          registration_closed_message_template: closureTemplate,
          webhook_username: username,
          avatar_url: avatarUrl,
          embed_color: embedColor,
          embed_title_template: embedTitleTemplate,
          embed_footer: embedFooter,
          embed_author_name: embedAuthorName,
          embed_author_url: embedAuthorUrl,
          embed_thumbnail_url: embedThumbnailUrl,
          embed_image_url: embedImageUrl,
          embed_timestamp: embedTimestamp,
          updated_by: userData.user.id,
          updated_at: new Date().toISOString(),
        }, { onConflict: "department_code" });
      if (saveError) throw saveError;

      return json({ success: true, has_webhook: true });
    }

    return json({ error: "Action inconnue." }, 400);
  } catch (error) {
    console.error("manage-department-webhook:", error);
    return json({ error: error instanceof Error ? error.message : "Erreur interne." }, 500);
  }
});
