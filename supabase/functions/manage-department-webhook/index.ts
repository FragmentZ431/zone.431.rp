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
  return String(value ?? fallback).replace(/[\\u0000-\\u0008\\u000b\\u000c\\u000e-\\u001f\\u007f]/g, "").trim().slice(0, 1900);
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

    const { data: role, error: roleError } = await userClient.rpc("current_staff_role");
    if (roleError || role !== "ADMINISTRATEUR") {
      return json({ error: "Seuls les administrateurs peuvent gérer les webhooks Discord." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = text(body.action, 20);
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    if (action === "list") {
      const [departmentsResult, configsResult] = await Promise.all([
        adminClient.from("rp_departments").select("code,name").order("code"),
        adminClient.from("department_discord_webhooks")
          .select("department_code,enabled,message_template,accreditation_message_template,grade_message_template,registration_closed_message_template,webhook_username,avatar_url,embed_color,webhook_url"),
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
        has_webhook: Boolean(row.webhook_url),
      }));
      return json({ success: true, departments: departmentsResult.data || [], configs });
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
        .select("webhook_url,enabled,message_template,accreditation_message_template,grade_message_template,registration_closed_message_template,webhook_username,avatar_url,embed_color")
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
          embeds: [{ description: testMessage, color: Number(config.embed_color) || 10893347 }],
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

      if (!departmentCode) return json({ error: "Département manquant." }, 400);
      if (!messageTemplate || !accreditationTemplate || !gradeTemplate || !closureTemplate) return json({ error: "Les quatre modèles de message sont obligatoires." }, 400);
      if (!username) return json({ error: "Le nom du bot est obligatoire." }, 400);
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
