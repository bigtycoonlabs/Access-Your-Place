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


    // ---- ADDED 6 Aug 2026 ----
    //
    // Everything a LANDLORD can do in their own portal threw "Unsupported action". The
    // existing handlers were all staff-side reads. So the supply side — the constraint on
    // this whole business — had a portal that could show a landlord their record and let
    // them do nothing with it.
    //
    // Written against the real columns of landlord_properties, landlord_documents,
    // landlord_messages and corporate_applications.

    if (action === "get_landlord_properties") {
      if (!body.landlord_id) return json({ success: false, error: "landlord_id is required" }, 400);
      return json({ success: true, properties: await read("landlord_properties",
        `select=*&landlord_id=eq.${encodeURIComponent(body.landlord_id)}&order=created_at.desc`) });
    }

    if (action === "submit_property") {
      const { landlord_id, address, city, state } = body;
      if (!landlord_id || !address || !city || !state) {
        return json({ success: false, error: "landlord_id, address, city and state are all required" }, 400);
      }
      const data = await write("landlord_properties", "POST", "", {
        landlord_id, address, city, state,
        zip_code: body.zip_code ?? null, unit_count: body.unit_count ?? null,
        community_name: body.community_name ?? null, community_website: body.community_website ?? null,
        corporate_leasing_available: body.corporate_leasing_available ?? null,
        requirements: body.requirements ?? null, submission_notes: body.notes ?? null,
        photos: body.photos ?? null,
        // Lands for review. A landlord submitting a property does not put it on the
        // marketplace — everything there has had a human speak to the landlord first.
        submission_status: "pending_analysis", status: "pending_review",
        created_at: new Date().toISOString(),
      });
      const row = Array.isArray(data) ? data[0] : data;
      await write("staff_notifications", "POST", "", {
        type: "landlord_property_submitted",
        title: "A landlord submitted a property",
        message: `${address}, ${city} ${state} is waiting for review.`,
        data: { landlord_property_id: row?.id, landlord_id },
      }).catch(() => {});
      return json({ success: true, property: row,
        note: "Submitted for review. It is not listed yet — someone will speak to you first." });
    }

    if (action === "review_property") {
      if (!body.property_id || !body.staff_id) {
        return json({ success: false, error: "property_id and staff_id are required" }, 400);
      }
      const approving = body.decision === "approve";
      if (!approving && !body.reason) {
        return json({ success: false, error: "A reason is required when declining — a landlord cannot act on a decision with no reason." }, 400);
      }
      const data = await write("landlord_properties", "PATCH",
        `id=eq.${encodeURIComponent(body.property_id)}`, {
          submission_status: approving ? "approved" : "rejected",
          status: approving ? "approved" : "rejected",
          rejection_reason: approving ? null : body.reason,
          reviewed_by: body.staff_id, reviewed_at: new Date().toISOString(),
        });
      return json({ success: true, property: Array.isArray(data) ? data[0] : data });
    }

    if (action === "update_property_application_handling") {
      if (!body.property_id || !body.application_handling) {
        return json({ success: false, error: "property_id and application_handling are required" }, 400);
      }
      const data = await write("landlord_properties", "PATCH",
        `id=eq.${encodeURIComponent(body.property_id)}`,
        { application_handling: body.application_handling });
      return json({ success: true, property: Array.isArray(data) ? data[0] : data });
    }

    if (action === "save_corporate_app_pdf" || action === "remove_corporate_app_pdf") {
      if (!body.property_id) return json({ success: false, error: "property_id is required" }, 400);
      const removing = action === "remove_corporate_app_pdf";
      const data = await write("landlord_properties", "PATCH",
        `id=eq.${encodeURIComponent(body.property_id)}`, {
          corporate_app_pdf_url: removing ? null : body.pdf_url,
          corporate_app_pdf_filename: removing ? null : body.filename,
          corporate_app_requirements_note: removing ? null : (body.requirements_note ?? null),
        });
      return json({ success: true, property: Array.isArray(data) ? data[0] : data });
    }

    if (action === "get_documents") {
      if (!body.landlord_id) return json({ success: false, error: "landlord_id is required" }, 400);
      return json({ success: true, documents: await read("landlord_documents",
        `select=*&landlord_id=eq.${encodeURIComponent(body.landlord_id)}&order=created_at.desc`) });
    }

    if (action === "upload_document") {
      const { landlord_id, file_url, file_name } = body;
      if (!landlord_id || !file_url || !file_name) {
        return json({ success: false, error: "landlord_id, file_url and file_name are required" }, 400);
      }
      const data = await write("landlord_documents", "POST", "", {
        landlord_id, landlord_property_id: body.property_id ?? null,
        document_type: body.document_type ?? "other", title: body.title ?? file_name,
        description: body.description ?? null, file_url, file_name,
        file_size: body.file_size ?? null, uploaded_by: body.uploaded_by ?? "landlord",
        created_at: new Date().toISOString(),
      });
      return json({ success: true, document: Array.isArray(data) ? data[0] : data });
    }

    if (action === "delete_document") {
      if (!body.document_id) return json({ success: false, error: "document_id is required" }, 400);
      await write("landlord_documents", "DELETE", `id=eq.${encodeURIComponent(body.document_id)}`, null);
      return json({ success: true, deleted: body.document_id });
    }

    if (action === "get_messages") {
      if (!body.landlord_id) return json({ success: false, error: "landlord_id is required" }, 400);
      return json({ success: true, messages: await read("landlord_messages",
        `select=*&landlord_id=eq.${encodeURIComponent(body.landlord_id)}&order=created_at.asc`) });
    }

    if (action === "send_message") {
      const { landlord_id, message } = body;
      if (!landlord_id || !message) {
        return json({ success: false, error: "landlord_id and message are required" }, 400);
      }
      const data = await write("landlord_messages", "POST", "", {
        landlord_id, application_id: body.application_id ?? null,
        sender_type: body.sender_type ?? "landlord",
        sender_name: body.sender_name ?? null, sender_id: body.sender_id ?? null,
        message, is_read: false, created_at: new Date().toISOString(),
      });
      if ((body.sender_type ?? "landlord") === "landlord") {
        await write("staff_notifications", "POST", "", {
          type: "landlord_message",
          title: "A landlord sent a message",
          message: String(message).slice(0, 200),
          data: { landlord_id },
        }).catch(() => {});
      }
      return json({ success: true, message: Array.isArray(data) ? data[0] : data });
    }

    if (action === "mark_messages_read") {
      if (!body.landlord_id) return json({ success: false, error: "landlord_id is required" }, 400);
      await write("landlord_messages", "PATCH",
        `landlord_id=eq.${encodeURIComponent(body.landlord_id)}&is_read=eq.false`, { is_read: true });
      return json({ success: true });
    }

    if (action === "submit_application") {
      const { landlord_id, client_name } = body;
      if (!landlord_id || !client_name) {
        return json({ success: false, error: "landlord_id and client_name are required" }, 400);
      }
      const data = await write("corporate_applications", "POST", "", {
        landlord_id, landlord_property_id: body.property_id ?? null,
        client_name, client_business_name: body.client_business_name ?? null,
        community_name: body.community_name ?? null, unit_number: body.unit_number ?? null,
        property_name: body.property_name ?? null,
        pdf_url: body.pdf_url ?? null, pdf_filename: body.pdf_filename ?? null,
        status: "received", current_stage: "received",
        stage_received_at: new Date().toISOString(),
        submitted_by: body.submitted_by ?? "landlord", submitted_by_id: body.submitted_by_id ?? null,
        created_at: new Date().toISOString(),
      });
      return json({ success: true, application: Array.isArray(data) ? data[0] : data });
    }

    if (action === "update_application_status") {
      if (!body.application_id || !body.status) {
        return json({ success: false, error: "application_id and status are required" }, 400);
      }
      const stamps: Record<string, string> = {
        under_review: "stage_under_review_at", approved: "stage_approved_at",
        denied: "stage_denied_at", lease_generated: "stage_lease_generated_at",
        lease_signed: "stage_lease_signed_at",
      };
      const patch: Record<string, unknown> = {
        status: body.status, current_stage: body.status,
        status_notes: body.notes ?? null, updated_at: new Date().toISOString(),
      };
      if (stamps[body.status]) patch[stamps[body.status]] = new Date().toISOString();
      if (body.status === "denied") {
        if (!body.reason) return json({ success: false, error: "A reason is required to deny an application." }, 400);
        patch.denial_reason = body.reason;
      }
      const data = await write("corporate_applications", "PATCH",
        `id=eq.${encodeURIComponent(body.application_id)}`, patch);
      return json({ success: true, application: Array.isArray(data) ? data[0] : data });
    }

    if (action === "update_profile") {
      if (!body.landlord_id || !body.updates) {
        return json({ success: false, error: "landlord_id and updates are required" }, 400);
      }
      // Allowlist. A landlord updating their own profile must not be able to set
      // assigned_am_id, portal_enabled or anything else that is ours to decide.
      const allowed = ["name","company_name","phone","preferred_contact_method","city","state","linkedin"];
      const updates: Record<string, unknown> = {};
      for (const k of allowed) if (k in body.updates) updates[k] = body.updates[k];
      if (!Object.keys(updates).length) {
        return json({ success: false, error: `Nothing updatable was sent. Allowed: ${allowed.join(", ")}.` }, 400);
      }
      updates.updated_at = new Date().toISOString();
      const data = await write("landlord_contacts", "PATCH",
        `id=eq.${encodeURIComponent(body.landlord_id)}`, updates);
      return json({ success: true, landlord: Array.isArray(data) ? data[0] : data });
    }

    if (action === "create_deal_from_property") {
      if (!body.property_id || !body.staff_id) {
        return json({ success: false, error: "property_id and staff_id are required" }, 400);
      }
      const rows = await read("landlord_properties", `select=*&id=eq.${encodeURIComponent(body.property_id)}&limit=1`);
      const lp = rows[0];
      if (!lp) return json({ success: false, error: "No such landlord property." }, 404);
      const data = await write("properties", "POST", "", {
        address: lp.address, city: lp.city, state: lp.state,
        bedrooms: body.bedrooms ?? null, monthly_rent: body.monthly_rent ?? null,
        // NOT published. A marketplace deal means a human has spoken to the landlord and
        // validated the numbers; creating one from a form submission does not clear that.
        status: "pending_review", is_published: false, is_verified: false,
        verification_tier: "penny_scan", workflow_stage: "submitted",
        submitted_by_type: "landlord_portal", added_by_staff_id: body.staff_id,
        source: "landlord_portal", created_at: new Date().toISOString(),
      });
      const row = Array.isArray(data) ? data[0] : data;
      await write("landlord_properties", "PATCH", `id=eq.${encodeURIComponent(body.property_id)}`,
        { property_id: row?.id, submission_status: "converted" });
      return json({ success: true, property: row,
        note: "Created as pending review, not published. A human still needs to speak to the landlord and validate the numbers." });
    }

    return json({ success: false, error: `Unsupported action: ${String(action)}` }, 400);
  } catch (error) {
    console.error("manage-landlord-portal", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Landlord portal request failed" }, 500);
  }
});
