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

function accreditationRank(value: string | null | undefined): number {
  const ranks: Record<string, number> = {
    "ACC 0": 0,
    "ACC 1": 1,
    "ACC 2": 2,
    "ACC 3": 3,
    "ACC 4": 4,
    "ACC 5": 5,
    "O5": 6,
  };
  return ranks[value || "ACC 0"] ?? -1;
}

function safeText(value: unknown, max = 500): string {
  return String(value ?? "").trim().slice(0, max);
}

function renderDiscordTemplate(
  template: string,
  values: Record<string, string>,
): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{${key}}`, value);
  }
  return output.trim().slice(0, 1900);
}

const DEFAULT_DISCORD_TEMPLATES: Record<string, string> = {
  document_published: "**NOUVEAU DOCUMENT PUBLIÉ**\n\n**{titre}**\n{resume}\n\n[Consulter le document]({lien})",
  document_updated: "**DOCUMENT MIS À JOUR**\n\n**{titre}**\n{resume}\n\n[Consulter le document]({lien})",
  training_published: "**NOUVELLE FORMATION DISPONIBLE**\n\n**{titre}**\n{resume}\n\n[Accéder à la formation]({lien})",
  training_updated: "**FORMATION MISE À JOUR**\n\n**{titre}**\n{resume}\n\n[Accéder à la formation]({lien})",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    const origin = req.headers.get("Origin") || "";
    if (origin !== SITE_ORIGIN) return new Response("Origin refusée.", { status: 403 });
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
    const publishableKey =
      Deno.env.get("SUPABASE_ANON_KEY") ||
      readKey("SUPABASE_PUBLISHABLE_KEYS");
    const secretKey =
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      readKey("SUPABASE_SECRET_KEYS");

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
    const event = safeText(body.event, 40);
    const sourceId = safeText(body.sourceId, 80);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(sourceId)) return json({ error: "Identifiant de ressource invalide." }, 400);

    const isDocument = ["document_published", "document_updated"].includes(event);
    const isTraining = ["training_published", "training_updated"].includes(event);
    if (!isDocument && !isTraining) return json({ error: "Type de notification invalide." }, 400);

    const moduleCode = isDocument ? "documentation" : "training";
    const { data: canWrite, error: permissionError } = await userClient.rpc(
      "has_staff_module_permission",
      { p_module_code: moduleCode, p_action: "write" },
    );
    if (permissionError || canWrite !== true) {
      return json({ error: "Vous ne disposez pas des droits de publication nécessaires." }, 403);
    }

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    let source: Record<string, unknown>;
    let recipients = new Set<string>();
    let notificationType: "document" | "training";
    let title: string;
    let message: string;
    let href: string;
    let discordText: string | null = null;
    let discordEnabled = true;
    let discordLink = "";
    let sourceCategory = "";

    const { data: profiles, error: profilesError } = await adminClient
      .from("rp_member_profiles")
      .select("user_id, department, accreditation")
      .eq("status", "authorized");
    if (profilesError) throw profilesError;

    const profileRows = profiles || [];
    const profileIds = profileRows.map((p: any) => p.user_id);

    if (isDocument) {
      const { data, error } = await adminClient
        .from("member_documents")
        .select("id,title,summary,category,is_global,is_published,required_accreditation,updated_at")
        .eq("id", sourceId)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.is_published !== true) {
        return json({ success: true, skipped: true, reason: "Document non publié." });
      }
      source = data;
      notificationType = "document";
      title = event === "document_published"
        ? "Nouveau document publié"
        : "Document mis à jour";
      message = event === "document_published"
        ? "Le document « " + safeText(data.title, 180) + " » est maintenant disponible."
        : "Le document « " + safeText(data.title, 180) + " » a été mis à jour.";
      href = "document.html?id=" + encodeURIComponent(sourceId);
      sourceCategory = safeText(data.category, 100);
      discordLink = "https://fragmentz431.github.io/zone.431.rp/membre/" + href;

      const requiredRank = accreditationRank(data.required_accreditation);
      const eligibleProfiles = profileRows.filter(
        (p: any) => accreditationRank(p.accreditation) >= requiredRank,
      );

      if (data.is_global) {
        eligibleProfiles.forEach((p: any) => recipients.add(p.user_id));
      } else {
        const { data: links, error: linksError } = await adminClient
          .from("member_document_departments")
          .select("department_code")
          .eq("document_id", sourceId);
        if (linksError) throw linksError;
        const departmentCodes = [...new Set((links || []).map((row: any) => row.department_code))];
        if (departmentCodes.length && profileIds.length) {
          const { data: extraAccess, error: accessError } = await adminClient
            .from("rp_member_department_access")
            .select("user_id,department_code")
            .in("user_id", profileIds)
            .in("department_code", departmentCodes);
          if (accessError) throw accessError;
          const accessByUser = new Map<string, Set<string>>();
          (extraAccess || []).forEach((row: any) => {
            if (!accessByUser.has(row.user_id)) accessByUser.set(row.user_id, new Set());
            accessByUser.get(row.user_id)!.add(row.department_code);
          });
          eligibleProfiles.forEach((p: any) => {
            if (departmentCodes.includes(p.department) ||
                departmentCodes.some((code: string) => accessByUser.get(p.user_id)?.has(code))) {
              recipients.add(p.user_id);
            }
          });
        }
      }
    } else {
      const { data, error } = await adminClient
        .from("training_courses")
        .select("id,title,summary,is_published,updated_at")
        .eq("id", sourceId)
        .maybeSingle();
      if (error) throw error;
      if (!data || data.is_published !== true) {
        return json({ success: true, skipped: true, reason: "Formation non publiée." });
      }
      source = data;
      notificationType = "training";
      title = event === "training_published"
        ? "Nouvelle formation disponible"
        : "Formation mise à jour";
      message = event === "training_published"
        ? "La formation « " + safeText(data.title, 180) + " » est maintenant disponible."
        : "La formation « " + safeText(data.title, 180) + " » a été mise à jour.";
      href = "formations.html";
      discordLink = "https://fragmentz431.github.io/zone.431.rp/membre/" + href;

      const { data: targets, error: targetsError } = await adminClient
        .from("rp_training_course_targets")
        .select("target_type,target_code")
        .eq("course_id", sourceId);
      if (targetsError) throw targetsError;

      const departmentTargets = [...new Set((targets || [])
        .filter((t: any) => t.target_type === "department")
        .map((t: any) => t.target_code))];
      const nodeTargets = [...new Set((targets || [])
        .filter((t: any) => t.target_type === "node")
        .map((t: any) => t.target_code))];

      const extraByUser = new Map<string, Set<string>>();
      const nodeByUser = new Map<string, Set<string>>();

      if (profileIds.length && departmentTargets.length) {
        const { data: extra, error: extraError } = await adminClient
          .from("rp_member_department_access")
          .select("user_id,department_code")
          .in("user_id", profileIds)
          .in("department_code", departmentTargets);
        if (extraError) throw extraError;
        (extra || []).forEach((row: any) => {
          if (!extraByUser.has(row.user_id)) extraByUser.set(row.user_id, new Set());
          extraByUser.get(row.user_id)!.add(row.department_code);
        });
      }

      if (profileIds.length && nodeTargets.length) {
        const { data: nodeAccess, error: nodeError } = await adminClient
          .from("rp_member_organization_access")
          .select("user_id,node_code")
          .in("user_id", profileIds)
          .in("node_code", nodeTargets);
        if (nodeError) throw nodeError;
        (nodeAccess || []).forEach((row: any) => {
          if (!nodeByUser.has(row.user_id)) nodeByUser.set(row.user_id, new Set());
          nodeByUser.get(row.user_id)!.add(row.node_code);
        });
      }

      for (const p of profileRows) {
        // Les cours RP suivent strictement la règle RLS :
        // accès départemental explicite ou accès à une division/filière.
        const departmentMatch = departmentTargets.some(
          (code: string) => extraByUser.get(p.user_id)?.has(code)
        );
        const nodeMatch = nodeTargets.some((code: string) => nodeByUser.get(p.user_id)?.has(code));
        if (departmentMatch || nodeMatch) recipients.add(p.user_id);
      }
    }

    const { data: templateRow, error: templateError } = await adminClient
      .from("site_notification_templates")
      .select("discord_content,enabled")
      .eq("event_key", event)
      .maybeSingle();
    if (templateError) throw templateError;

    discordEnabled = templateRow?.enabled !== false;
    if (discordEnabled) {
      const template = safeText(
        templateRow?.discord_content || DEFAULT_DISCORD_TEMPLATES[event],
        1900,
      );
      discordText = renderDiscordTemplate(template, {
        titre: safeText(source.title, 180),
        resume: safeText(source.summary, 450) || "Aucun résumé renseigné.",
        categorie: sourceCategory,
        lien: discordLink,
      });
    }

    const sourceUpdatedAt = safeText(source.updated_at, 80) || new Date().toISOString();
    const eventKey = event + ":" + sourceId + ":" + sourceUpdatedAt;
    const rows = [...recipients].map((userId) => ({
      user_id: userId,
      notification_type: notificationType,
      title,
      message,
      href,
      source_id: sourceId,
      event_key: eventKey,
    }));

    let inserted = 0;
    if (rows.length) {
      const { data, error } = await adminClient
        .from("member_notifications")
        .upsert(rows, { onConflict: "user_id,event_key", ignoreDuplicates: true })
        .select("id");
      if (error) throw error;
      inserted = data?.length || 0;
    }

    let discordSent = false;
    let discordConfigured = false;
    if (discordText && discordEnabled) {
      const webhook = Deno.env.get("DISCORD_WEBHOOK_SITE");
      discordConfigured = Boolean(webhook);
      if (webhook) {
        const response = await fetch(webhook, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: discordText,
            allowed_mentions: { parse: [] },
          }),
        });
        discordSent = response.ok;
        if (!response.ok) {
          console.error("Discord webhook error:", response.status, await response.text());
        }
      }
    }

    return json({
      success: true,
      recipients: recipients.size,
      notificationsInserted: inserted,
      discordConfigured,
      discordSent,
    });
  } catch (error) {
    console.error("publish-site-notification:", error);
    const message = error instanceof Error ? error.message : "Erreur interne.";
    return json({ error: message }, 500);
  }
});