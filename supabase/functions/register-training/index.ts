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

function safeText(value: unknown, max = 180): string {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim().slice(0, max);
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

function renderTemplate(template: string, values: Record<string, string>): string {
  let output = template;
  for (const [key, value] of Object.entries(values)) {
    output = output.replaceAll(`{${key}}`, value);
  }
  return output.trim().slice(0, 1900);
}

function isDiscordWebhook(value: string): boolean {
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
    const origin = req.headers.get("Origin") || "";
    if (origin !== SITE_ORIGIN) return new Response("Origine refusée.", { status: 403 });
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

    const { data: currentSession, error: sessionError } =
      await userClient.rpc("rp_validate_current_session");
    if (sessionError || currentSession !== true) {
      return json({ error: "Session RP invalide. Reconnectez-vous." }, 401);
    }

    const body = await req.json().catch(() => ({}));
    const courseId = safeText(body.courseId, 80);
    const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidPattern.test(courseId)) return json({ error: "Identifiant de formation invalide." }, 400);

    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userId = userData.user.id;
    const { data: profile, error: profileError } = await adminClient
      .from("rp_member_profiles")
      .select("user_id,rp_name,display_name,status")
      .eq("user_id", userId)
      .maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.status !== "authorized") {
      return json({ error: "Seuls les membres autorisés peuvent s'inscrire." }, 403);
    }

    const { data: course, error: courseError } = await adminClient
      .from("training_courses")
      .select("id,title,is_published")
      .eq("id", courseId)
      .maybeSingle();
    if (courseError) throw courseError;
    if (!course || course.is_published !== true) {
      return json({ error: "Cette formation n'est pas disponible." }, 404);
    }

    const { data: targets, error: targetsError } = await adminClient
      .from("rp_training_course_targets")
      .select("target_type,target_code")
      .eq("course_id", courseId);
    if (targetsError) throw targetsError;
    if (!targets?.length) {
      return json({ error: "Cette formation ne possède aucune affectation." }, 403);
    }

    const departmentTargets = [...new Set(
      targets.filter((item: any) => item.target_type === "department").map((item: any) => item.target_code)
    )];
    const nodeTargets = [...new Set(
      targets.filter((item: any) => item.target_type === "node").map((item: any) => item.target_code)
    )];

    const [departmentAccess, nodeAccess] = await Promise.all([
      departmentTargets.length
        ? adminClient.from("rp_member_department_access")
            .select("department_code")
            .eq("user_id", userId)
            .in("department_code", departmentTargets)
        : Promise.resolve({ data: [], error: null }),
      nodeTargets.length
        ? adminClient.from("rp_member_organization_access")
            .select("node_code")
            .eq("user_id", userId)
            .in("node_code", nodeTargets)
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (departmentAccess.error) throw departmentAccess.error;
    if (nodeAccess.error) throw nodeAccess.error;

    if (!(departmentAccess.data || []).length && !(nodeAccess.data || []).length) {
      return json({ error: "Cette formation n'est pas destinée à votre affectation." }, 403);
    }

    const { data: existing, error: existingError } = await adminClient
      .from("training_enrollments")
      .select("id,status")
      .eq("user_id", userId)
      .eq("course_id", courseId)
      .maybeSingle();
    if (existingError) throw existingError;

    if (existing?.status === "registered" || existing?.status === "completed") {
      return json({ success: true, alreadyRegistered: true, message: "Vous êtes déjà inscrit à cette formation." });
    }

    let enrollment;
    if (existing?.status === "cancelled") {
      const { data, error } = await adminClient
        .from("training_enrollments")
        .update({ status: "registered", updated_at: new Date().toISOString() })
        .eq("id", existing.id)
        .select("id")
        .single();
      if (error) throw error;
      enrollment = data;
    } else {
      const { data, error } = await adminClient
        .from("training_enrollments")
        .insert({ user_id: userId, course_id: courseId })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") {
          return json({ success: true, alreadyRegistered: true, message: "Vous êtes déjà inscrit à cette formation." });
        }
        throw error;
      }
      enrollment = data;
    }

    const departmentCodes = new Set<string>(departmentTargets);
    if (nodeTargets.length) {
      const { data: nodes, error: nodesError } = await adminClient
        .from("rp_organization_nodes")
        .select("code,root_department_code")
        .in("code", nodeTargets);
      if (nodesError) throw nodesError;
      (nodes || []).forEach((node: any) => {
        if (node.root_department_code) departmentCodes.add(node.root_department_code);
      });
    }

    const codes = [...departmentCodes];
    let notificationsSent = 0;
    let notificationsConfigured = 0;
    if (codes.length) {
      const { data: configurations, error: configError } = await adminClient
        .from("department_discord_webhooks")
        .select("department_code,webhook_url,enabled,message_template")
        .in("department_code", codes)
        .eq("enabled", true);
      if (configError) throw configError;

      const pseudo = safeText(profile.rp_name || profile.display_name || "Membre", 100);
      for (const config of configurations || []) {
        if (!config.webhook_url || !isDiscordWebhook(config.webhook_url)) {
          console.warn("Webhook Discord absent ou invalide pour", config.department_code);
          continue;
        }
        notificationsConfigured++;
        const { data: department } = await adminClient
          .from("rp_departments")
          .select("name")
          .eq("code", config.department_code)
          .maybeSingle();

        const content = renderTemplate(config.message_template, {
          pseudo,
          formation: safeText(course.title, 180),
          departement: safeText(department?.name || config.department_code, 120),
        });
        if (!content) continue;

        const response = await fetch(config.webhook_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, allowed_mentions: { parse: [] } }),
        });

        if (response.ok) {
          notificationsSent++;
        } else {
          console.error("Discord webhook error:", config.department_code, response.status, await response.text());
        }
      }
    }

    return json({
      success: true,
      alreadyRegistered: false,
      enrollmentId: enrollment.id,
      notificationsSent,
      notificationsConfigured,
      message: "Votre inscription a bien été enregistrée.",
    });
  } catch (error) {
    console.error("register-training:", error);
    return json({ error: error instanceof Error ? error.message : "Erreur interne." }, 500);
  }
});
