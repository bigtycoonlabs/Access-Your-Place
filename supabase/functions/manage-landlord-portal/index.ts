import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://accessyourplace.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ success: false, error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceKey) return json({ success: false, error: "Server configuration error" }, 500);

  const auth = req.headers.get("authorization") || "";
  if (!auth.startsWith("Bearer ")) return json({ success: false, error: "Authentication required" }, 401);

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
    "Accept-Profile": "public",
    "Content-Profile": "public",
  };

  const read = async (table: string, query: string) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}?${query}`, { headers });
    const text = await res.text();
    const data = text ? JSON.parse(text) : [];
    if (!res.ok) throw new Error(data?.message || `Database read failed (${res.status})`);
    return Array.isArray(data) ? data : [];
  };

  const write = async (table: string, method: string, query: string, payload: unknown) => {
    const res = await fetch(`${supabaseUrl}/rest/v1/${table}${query ? `?${query}` : ""}`, {
      method,
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(payload),
    });
    const text = await res.text();
    const data = text ? JSON.parse(text) : null;
    if (!res.ok) throw new Error(data?.message || `Database write failed (${res.status})`);
    return data;
  };

  try {
    const body = await req.json();
    const action = body.action;

    if (action === "get_all_portal_landlords") {
      return json({ success: true, landlords: await read("landlord_contacts", "select=*&portal_enabled=eq.true&order=created_at.desc") });
    }
    if (action === "get_unassigned_landlords") {
      return json({ success: true, landlords: await read("landlord_contacts", "select=*&portal_enabled=eq.true&assigned_am_id=is.null&order=created_at.desc") });
    }
    if (action === "get_landlord_properties_for_review") {
      return json({ success: true, properties: await read("landlord_properties", "select=*&submission_status=eq.pending_analysis&order=created_at.desc") });
    }
    if (action === "get_applications") {
      return json({ success: true, applications: await read("landlord_applications", "select=*&order=created_at.desc") });
    }
    if (action === "get_landlord") {
      if (!body.landlord_id) return json({ success: false, error: "landlord_id is required" }, 400);
      const rows = await read("landlord_contacts", `select=*&id=eq.${encodeURIComponent(body.landlord_id)}&limit=1`);
      return json({ success: true, landlord: rows[0] || null });
    }
    if (action === "update_landlord") {
      if (!body.landlord_id || !body.updates) return json({ success: false, error: "landlord_id and updates are required" }, 400);
      const data = await write("landlord_contacts", "PATCH", `id=eq.${encodeURIComponent(body.landlord_id)}`, { ...body.updates, updated_at: new Date().toISOString() });
      return json({ success: true, landlord: Array.isArray(data) ? data[0] : data });
    }
    if (action === "update_property") {
      if (!body.property_id || !body.updates) return json({ success: false, error: "property_id and updates are required" }, 400);
      const data = await write("landlord_properties", "PATCH", `id=eq.${encodeURIComponent(body.property_id)}`, { ...body.updates, updated_at: new Date().toISOString() });
      return json({ success: true, property: Array.isArray(data) ? data[0] : data });
    }
    if (action === "assign_landlord") {
      if (!body.landlord_id || !body.staff_id) return json({ success: false, error: "landlord_id and staff_id are required" }, 400);
      const data = await write("landlord_contacts", "PATCH", `id=eq.${encodeURIComponent(body.landlord_id)}`, { assigned_am_id: body.staff_id, assigned_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      return json({ success: true, landlord: Array.isArray(data) ? data[0] : data });
    }

    return json({ success: false, error: `Unsupported action: ${String(action)}` }, 400);
  } catch (error) {
    console.error("manage-landlord-portal", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Landlord portal request failed" }, 500);
  }
});
