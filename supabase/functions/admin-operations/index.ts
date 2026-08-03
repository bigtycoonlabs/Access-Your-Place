import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://accessyourplace.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !service) return json({ success: false, error: "Server configuration error" }, 500);

  const headers = { apikey: service, Authorization: `Bearer ${service}`, "Content-Type": "application/json", "Accept-Profile": "public", "Content-Profile": "public" };

  try {
    const body = await req.json().catch(() => ({}));
    const staffId = String(body.staff_id || body.staffId || "");
    if (!staffId) return json({ success: false, error: "Staff identity required" }, 401);

    const staffRes = await fetch(`${url}/rest/v1/staff_users?id=eq.${encodeURIComponent(staffId)}&is_active=eq.true&select=id,role,department,permissions&limit=1`, { headers });
    const staffRows = await staffRes.json();
    const staff = Array.isArray(staffRows) ? staffRows[0] : null;
    const permissions = Array.isArray(staff?.permissions) ? staff.permissions : [];
    const isAdmin = staff && (staff.role === "admin" || staff.role === "super_admin" || staff.department === "success_managers" || permissions.includes("all") || permissions.includes("admin"));
    if (!isAdmin) return json({ success: false, error: "Administrator access required" }, 403);

    if (body.action !== "get_penny_score_refresh_log") return json({ success: false, error: "Unsupported action" }, 400);
    const res = await fetch(`${url}/rest/v1/penny_score_refresh_log?select=*&order=started_at.desc&limit=${Math.min(Number(body.limit) || 5, 50)}`, { headers });
    const text = await res.text();
    const data = text ? JSON.parse(text) : [];
    if (!res.ok) return json({ success: false, error: data?.message || "Could not load refresh history" }, res.status);
    return json({ success: true, runs: Array.isArray(data) ? data : [] });
  } catch (error) {
    console.error("admin-operations", error);
    return json({ success: false, error: "Administrator request failed" }, 500);
  }
});
