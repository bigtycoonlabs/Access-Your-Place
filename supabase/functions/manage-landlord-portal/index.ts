import { gate, whoIsAsking } from '../_shared/identity.ts';
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://accessyourplace.com",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-staff-session, x-investor-session, x-landlord-session",
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

  // Signing was silent in both directions: a landlord only learned a document was waiting if
  // they happened to open the portal, and staff only learned it was signed or declined from an
  // in-app notice. These emails close that. Plain text, from Penny, replies to success@.
  // Best effort: a failed send never fails the signing itself, but it is logged, not swallowed.
  const SUCCESS_INBOX = "success@accessyourplace.com";
  const sendEmail = async (to: string, subject: string, text: string): Promise<boolean> => {
    const key = Deno.env.get("RESEND_API_KEY");
    if (!key || !to || !to.includes("@")) {
      console.error("manage-landlord-portal email_not_sent", !key ? "no RESEND_API_KEY" : "no recipient", subject);
      return false;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
        body: JSON.stringify({ from: "Penny <penny@accessyourplace.com>", reply_to: [SUCCESS_INBOX], to: [to], subject, text }),
      });
      if (!res.ok) console.error("manage-landlord-portal email_refused", res.status, (await res.text()).slice(0, 300));
      return res.ok;
    } catch (e) {
      console.error("manage-landlord-portal email_failed", e instanceof Error ? e.message : e);
      return false;
    }
  };

  // Landlord files live in the private seller-documents bucket. The database keeps a
  // reference ("storage:seller-documents/<path>") and every read hands out a short-lived
  // link, so a document is never reachable by a permanent public URL.
  const FILE_BUCKET = "seller-documents";
  const REF_PREFIX = `storage:${FILE_BUCKET}/`;
  const encodePath = (p: string) => p.split("/").map(encodeURIComponent).join("/");
  const signedUrl = async (path: string, seconds = 3600): Promise<string | null> => {
    const res = await fetch(`${supabaseUrl}/storage/v1/object/sign/${FILE_BUCKET}/${encodePath(path)}`, {
      method: "POST", headers, body: JSON.stringify({ expiresIn: seconds }),
    });
    if (!res.ok) return null;
    const out = await res.json().catch(() => null);
    return out?.signedURL ? `${supabaseUrl}/storage/v1${out.signedURL}` : null;
  };
  const resolveRef = async (ref: unknown) =>
    typeof ref === "string" && ref.startsWith(REF_PREFIX) ? await signedUrl(ref.slice(REF_PREFIX.length)) : ref;
  const removeRef = async (ref: unknown) => {
    if (typeof ref !== "string" || !ref.startsWith(REF_PREFIX)) return;
    await fetch(`${supabaseUrl}/storage/v1/object/${FILE_BUCKET}`, {
      method: "DELETE", headers, body: JSON.stringify({ prefixes: [ref.slice(REF_PREFIX.length)] }),
    }).catch(() => {});
  };
  // A path the caller uploaded must sit in that landlord's own folder.
  const ownPath = (path: unknown, folder: string, landlordId: unknown) =>
    typeof path === "string" && !path.includes("..") && path.startsWith(`${folder}/${landlordId}/`);

  try {
    const body = await req.json();
    // Sign-in check: see _shared/identity.ts. This function used to trust whoever called it.
    { const denied = await gate(req, body, String(body?.action || ''), corsHeaders, {"landlordActions": ["create_upload_url", "decline_signature", "delete_document", "get_applications", "get_documents", "get_landlord_properties", "get_messages", "get_signature_requests", "landlord_overview", "mark_messages_read", "mark_signature_viewed", "remove_corporate_app_pdf", "save_corporate_app_pdf", "save_property_details", "send_message", "set_lease_preference", "sign_document", "submit_property", "update_application_status", "update_profile", "update_property_application_handling", "upload_document"],
      // A landlord may only touch rows on their own account, whatever id they send.
      "ownRow": {
        "delete_document": { "table": "landlord_documents", "field": "document_id" },
        "update_application_status": { "table": "corporate_applications", "field": "application_id" },
        "mark_signature_viewed": { "table": "landlord_signatures", "field": "signature_id" },
        "sign_document": { "table": "landlord_signatures", "field": "signature_id" },
        "decline_signature": { "table": "landlord_signatures", "field": "signature_id" },
        "save_corporate_app_pdf": { "table": "landlord_properties", "field": "property_id" },
        "remove_corporate_app_pdf": { "table": "landlord_properties", "field": "property_id" },
        "update_property_application_handling": { "table": "landlord_properties", "field": "property_id" },
      }});
      if (denied) return denied; }
    const action = body.action;

    // ---- LANDLORD-FACING. THIS PORTAL IS ABOUT THEM. ----
    //
    // A landlord pays us nothing. We find and verify a corporate lease partner for their
    // property. Every response here says where things stand in plain words and what, if
    // anything, is needed from them — because the alternative is a landlord refreshing a
    // page wondering whether anybody is working on it.

    if (action === "landlord_overview") {
      const { landlord_id } = body;
      if (!landlord_id) return json({ success: false, error: "landlord_id is required." }, 400);
      const res = await fetch(`${supabaseUrl}/rest/v1/rpc/ayp_landlord_overview`, {
        method: "POST", headers, body: JSON.stringify({ p_landlord_id: landlord_id }),
      });
      if (!res.ok) {
        console.error("landlord_overview failed", res.status);
        return json({ success: false, error: "We could not load your properties just now." }, 502);
      }
      const out = await res.json();
      if (out?.ok === false) return json({ success: false, error: out.error }, 404);
      return json({ success: true, ...out });
    }

    if (action === "set_lease_preference") {
      const { property_id, landlord_id, lease_preference, onboarding_style } = body;
      if (!property_id || !landlord_id) {
        return json({ success: false, error: "property_id and landlord_id are required." }, 400);
      }
      const allowed = ["master_lease", "direct_with_partner", "open_to_both", "undecided"];
      if (lease_preference && !allowed.includes(String(lease_preference))) {
        return json({ success: false, error: `Choose one of: ${allowed.join(", ")}.` }, 400);
      }
      const styles = ["we_handle_paperwork", "landlord_handles", "their_own_process", "undecided"];
      if (onboarding_style && !styles.includes(String(onboarding_style))) {
        return json({ success: false, error: `Choose one of: ${styles.join(", ")}.` }, 400);
      }
      const patch: Record<string, unknown> = {};
      if (lease_preference) {
        patch.lease_preference = lease_preference;
        patch.lease_preference_set_at = new Date().toISOString();
      }
      if (onboarding_style) patch.onboarding_style = onboarding_style;
      if (!Object.keys(patch).length) {
        return json({ success: false, error: "Nothing was chosen, so nothing was saved." }, 400);
      }
      // Scoped to THEIR property. A landlord must not be able to set a preference on
      // somebody else's building by passing its id.
      const res = await fetch(
        `${supabaseUrl}/rest/v1/landlord_properties?id=eq.${property_id}&landlord_id=eq.${landlord_id}`,
        { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(patch) });
      if (!res.ok) return json({ success: false, error: "We could not save that. Nothing was changed." }, 502);
      const rows = await res.json();
      if (!rows?.length) return json({ success: false, error: "That property is not on your account." }, 403);
      return json({ success: true, property: rows[0],
        note: "Saved. You can change this at any time before anything is signed." });
    }

    if (action === "save_property_details") {
      const { property_id, landlord_id } = body;
      if (!property_id || !landlord_id) {
        return json({ success: false, error: "property_id and landlord_id are required." }, 400);
      }
      // Only what a landlord owns about their own building.
      const allowed = ["community_rules_note", "property_rules_note", "maintenance_contact_name",
                       "maintenance_contact_phone", "maintenance_contact_email", "maintenance_notes",
                       "photos", "videos", "community_website", "unit_count", "submission_notes"];
      const patch: Record<string, unknown> = {};
      for (const k of allowed) if (k in body) patch[k] = body[k];
      if (!Object.keys(patch).length) {
        return json({ success: false, error: `Nothing updatable was sent. You can set: ${allowed.join(", ")}.` }, 400);
      }
      const res = await fetch(
        `${supabaseUrl}/rest/v1/landlord_properties?id=eq.${property_id}&landlord_id=eq.${landlord_id}`,
        { method: "PATCH", headers: { ...headers, Prefer: "return=representation" }, body: JSON.stringify(patch) });
      if (!res.ok) return json({ success: false, error: "We could not save that. Nothing was changed." }, 502);
      const rows = await res.json();
      if (!rows?.length) return json({ success: false, error: "That property is not on your account." }, 403);
      return json({ success: true, property: rows[0] });
    }

    if (action === "create_upload_url") {
      // A one-time upload link into the landlord's own folder. The browser never gets
      // general write access to storage.
      const { landlord_id } = body;
      if (!landlord_id || !body.file_name) return json({ success: false, error: "landlord_id and file_name are required." }, 400);
      const safe = String(body.file_name).replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";
      let path: string;
      if (body.purpose === "application_pdf") {
        if (!body.property_id) return json({ success: false, error: "property_id is required." }, 400);
        const props = await read("landlord_properties",
          `select=id&id=eq.${encodeURIComponent(body.property_id)}&landlord_id=eq.${encodeURIComponent(landlord_id)}&limit=1`);
        if (!props[0]) return json({ success: false, error: "That property is not on your account." }, 403);
        path = `landlord-apps/${landlord_id}/${body.property_id}/${Date.now()}-${safe}`;
      } else {
        path = `landlord-docs/${landlord_id}/${Date.now()}-${safe}`;
      }
      const res = await fetch(`${supabaseUrl}/storage/v1/object/upload/sign/${FILE_BUCKET}/${encodePath(path)}`, {
        method: "POST", headers, body: "{}",
      });
      const out = await res.json().catch(() => null);
      const token = out?.url ? new URL(out.url, supabaseUrl).searchParams.get("token") : null;
      if (!res.ok || !token) {
        console.error("create_upload_url failed", res.status, out);
        return json({ success: false, error: "We could not prepare the upload. Please try again." }, 502);
      }
      return json({ success: true, bucket: FILE_BUCKET, path, token });
    }

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
      // A landlord sees their own corporate applications, which is what the portal renders.
      // This used to return every row of landlord_applications to any signed-in landlord.
      if (body.landlord_id) {
        return json({ success: true, applications: await read("corporate_applications",
          `select=*&landlord_id=eq.${encodeURIComponent(body.landlord_id)}&order=created_at.desc`) });
      }
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
      const properties = await read("landlord_properties",
        `select=*&landlord_id=eq.${encodeURIComponent(body.landlord_id)}&order=created_at.desc`);
      for (const p of properties) p.corporate_app_pdf_url = await resolveRef(p.corporate_app_pdf_url);
      return json({ success: true, properties });
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
        metadata: { landlord_property_id: row?.id, landlord_id },
      }).catch((e) => console.error("staff notification not saved", e instanceof Error ? e.message : e));
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
        `id=eq.${encodeURIComponent(body.property_id)}${body.landlord_id ? `&landlord_id=eq.${encodeURIComponent(body.landlord_id)}` : ""}`,
        { application_handling: body.application_handling });
      return json({ success: true, property: Array.isArray(data) ? data[0] : data });
    }

    if (action === "save_corporate_app_pdf" || action === "remove_corporate_app_pdf") {
      if (!body.property_id) return json({ success: false, error: "property_id is required" }, 400);
      const removing = action === "remove_corporate_app_pdf";
      let pdfUrl = body.pdf_url ?? null;
      if (!removing && body.storage_path) {
        if (!ownPath(body.storage_path, "landlord-apps", body.landlord_id)) {
          return json({ success: false, error: "That file is not in your folder." }, 403);
        }
        pdfUrl = REF_PREFIX + body.storage_path;
      }
      const scope = body.landlord_id ? `&landlord_id=eq.${encodeURIComponent(body.landlord_id)}` : "";
      if (removing) {
        const prior = await read("landlord_properties", `select=corporate_app_pdf_url&id=eq.${encodeURIComponent(body.property_id)}${scope}&limit=1`);
        await removeRef(prior[0]?.corporate_app_pdf_url);
      }
      const data = await write("landlord_properties", "PATCH",
        `id=eq.${encodeURIComponent(body.property_id)}${scope}`, {
          corporate_app_pdf_url: removing ? null : pdfUrl,
          corporate_app_pdf_filename: removing ? null : body.filename,
          corporate_app_requirements_note: removing ? null : (body.requirements_note ?? null),
        });
      const saved = Array.isArray(data) ? data[0] : data;
      if (saved) saved.corporate_app_pdf_url = await resolveRef(saved.corporate_app_pdf_url);
      return json({ success: true, property: saved });
    }

    if (action === "get_documents") {
      if (!body.landlord_id) return json({ success: false, error: "landlord_id is required" }, 400);
      const documents = await read("landlord_documents",
        `select=*&landlord_id=eq.${encodeURIComponent(body.landlord_id)}&order=created_at.desc`);
      for (const d of documents) d.file_url = await resolveRef(d.file_url);
      return json({ success: true, documents });
    }

    if (action === "upload_document") {
      const { landlord_id, file_name } = body;
      let file_url = body.file_url;
      if (body.storage_path) {
        if (!ownPath(body.storage_path, "landlord-docs", landlord_id)) {
          return json({ success: false, error: "That file is not in your folder." }, 403);
        }
        file_url = REF_PREFIX + body.storage_path;
      }
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
      const doc = await read("landlord_documents", `select=file_url&id=eq.${encodeURIComponent(body.document_id)}&limit=1`);
      await write("landlord_documents", "DELETE", `id=eq.${encodeURIComponent(body.document_id)}`, null);
      await removeRef(doc[0]?.file_url);
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
          metadata: { landlord_id },
        }).catch((e) => console.error("staff notification not saved", e instanceof Error ? e.message : e));
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
      // A lease is generated by us and signed through sign_document, which records the
      // signature. A landlord pressing a button is not a signed lease.
      if (["lease_generated", "lease_signed"].includes(String(body.status))) {
        const who = await whoIsAsking(req);
        if (who.kind === "landlord") {
          return json({ success: false, error: "Leases are signed from the lease itself. Open the lease and choose Review and sign." }, 403);
        }
      }
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

    // ---- SIGNING (24 Sep 2026) ----
    //
    // Staff send a landlord a document to sign; the landlord signs it in their portal. The
    // row records who signed, when, from where, how (drawn or typed), and a hash of exactly
    // what they were shown. Signing a lease moves its corporate application to lease_signed.

    const SIGNATURE_LIST_COLUMNS = "id,landlord_id,corporate_application_id,landlord_property_id,document_name,document_type,document_url,document_content,message,status,sent_by_name,sent_at,viewed_at,expires_at,signed_at,signer_name,signature_type,signature_image,initials,document_hash,declined_at,decline_reason,countersign_role,countersigned_by_name,countersigned_at,signing_order,released_to_client_at";
    const isExpired = (row: any) => row?.expires_at && new Date(row.expires_at).getTime() < Date.now();
    const sha256 = async (text: string) => {
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
    };
    const signatureRow = async (id: unknown, landlordId: unknown) => {
      if (!id || !landlordId) return null;
      const rows = await read("landlord_signatures",
        `select=*&id=eq.${encodeURIComponent(String(id))}&landlord_id=eq.${encodeURIComponent(String(landlordId))}&limit=1`);
      return rows[0] || null;
    };

    if (action === "send_for_signature") {
      // Staff only: not in landlordActions, so the gate requires a staff sign-in.
      const { landlord_id, document_name } = body;
      if (!landlord_id || !document_name) {
        return json({ success: false, error: "landlord_id and document_name are required." }, 400);
      }
      if (!body.document_url && !body.document_content) {
        return json({ success: false, error: "Attach the document: a link to it, or its text." }, 400);
      }
      if (body.document_url && !/^https:\/\//i.test(String(body.document_url))) {
        return json({ success: false, error: "The document link must start with https://" }, 400);
      }
      const landlords = await read("landlord_contacts",
        `select=id,name,email&id=eq.${encodeURIComponent(landlord_id)}&limit=1`);
      if (!landlords[0]) return json({ success: false, error: "No such landlord." }, 404);

      let application: any = null;
      if (body.corporate_application_id) {
        const apps = await read("corporate_applications",
          `select=id,landlord_id,client_name,current_stage&id=eq.${encodeURIComponent(body.corporate_application_id)}&limit=1`);
        application = apps[0];
        if (!application || String(application.landlord_id) !== String(landlord_id)) {
          return json({ success: false, error: "That application is not on this landlord's account." }, 400);
        }
      }

      const who = await whoIsAsking(req);
      const days = Number(body.expires_in_days);
      const docType = ["lease", "lease_addendum", "agreement", "disclosure", "other"].includes(String(body.document_type))
        ? String(body.document_type) : "other";
      const created = await write("landlord_signatures", "POST", "", {
        landlord_id,
        corporate_application_id: application?.id ?? null,
        landlord_property_id: body.landlord_property_id ?? null,
        document_name: String(document_name).slice(0, 200),
        document_type: docType,
        document_url: body.document_url ?? null,
        document_content: body.document_content ?? null,
        message: body.message ?? null,
        sent_by: who.kind === "staff" ? who.id : (body.sent_by ?? null),
        sent_by_name: body.sent_by_name ?? null,
        expires_at: Number.isFinite(days) && days > 0 ? new Date(Date.now() + days * 86400000).toISOString() : null,
      });
      const row = Array.isArray(created) ? created[0] : created;

      // A lease sent for signature is the lease being generated: the application shows it.
      if (application && docType === "lease") {
        const patch: Record<string, unknown> = {
          current_stage: "lease_generated", status: "lease_generated",
          stage_lease_generated_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        };
        if (body.document_url) {
          patch.lease_url = body.document_url;
          patch.lease_filename = String(document_name).slice(0, 200);
        }
        await write("corporate_applications", "PATCH", `id=eq.${encodeURIComponent(application.id)}`, patch);
      }

      await write("landlord_messages", "POST", "", {
        landlord_id, application_id: application?.id ?? null,
        sender_type: "staff", sender_name: body.sent_by_name ?? "Access Your Place",
        sender_id: who.kind === "staff" ? who.id : null,
        message: `We've sent you "${row?.document_name}" to sign. Open Documents in your portal to review and sign it.`,
        is_read: false, created_at: new Date().toISOString(),
      }).catch(() => {});

      const landlordName = String(landlords[0].name || "").trim();
      const emailed = await sendEmail(String(landlords[0].email || ""),
        `A document is waiting for your signature: ${row?.document_name}`,
        [
          `Hi${landlordName ? ` ${landlordName}` : ""},`,
          "",
          `We've sent you "${row?.document_name}" to sign.`,
          ...(body.message ? ["", String(body.message).slice(0, 1000)] : []),
          "",
          "To review and sign it, sign in to your landlord portal and open Documents:",
          "https://accessyourplace.com/landlord/login",
          "",
          "If anything in it looks wrong, reply to this email before signing.",
          "",
          "Penny, Access Your Place",
        ].join("\n"));

      return json({ success: true, signature: row, emailed });
    }

    if (action === "get_signature_requests") {
      if (!body.landlord_id) return json({ success: false, error: "landlord_id is required." }, 400);
      const rows = await read("landlord_signatures",
        `select=${SIGNATURE_LIST_COLUMNS}&landlord_id=eq.${encodeURIComponent(body.landlord_id)}&status=neq.cancelled&order=sent_at.desc`);
      // Expiry is decided when it is read, so a request past its date never shows a Sign button.
      for (const r of rows) if (isExpired(r) && (r.status === "pending" || r.status === "viewed")) r.status = "expired";
      return json({ success: true, signatures: rows });
    }

    if (action === "mark_signature_viewed") {
      const row = await signatureRow(body.signature_id, body.landlord_id);
      if (!row) return json({ success: false, error: "That document is not on your account." }, 404);
      if (row.status === "pending") {
        await write("landlord_signatures", "PATCH", `id=eq.${encodeURIComponent(row.id)}`,
          { status: "viewed", viewed_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
      return json({ success: true });
    }

    if (action === "sign_document") {
      const row = await signatureRow(body.signature_id, body.landlord_id);
      if (!row) return json({ success: false, error: "That document is not on your account." }, 404);
      if (row.status === "signed") return json({ success: false, error: "You have already signed this document." }, 409);
      if (row.status === "declined" || row.status === "cancelled") {
        return json({ success: false, error: "This document is no longer waiting for your signature." }, 409);
      }
      if (isExpired(row)) {
        return json({ success: false, error: "This signing request has expired. Message us and we will send it again." }, 410);
      }
      if (body.consent !== true) {
        return json({ success: false, error: "Tick the box to agree to sign electronically." }, 400);
      }
      const signerName = String(body.signer_name || "").trim();
      if (signerName.length < 2) return json({ success: false, error: "Type your full legal name." }, 400);
      const type = body.signature_type === "drawn" ? "drawn" : "typed";
      const image = typeof body.signature_image === "string" ? body.signature_image : null;
      if (type === "drawn") {
        if (!image || !/^data:image\/png;base64,/.test(image)) {
          return json({ success: false, error: "Draw your signature, or switch to a typed signature." }, 400);
        }
        if (image.length > 400_000) return json({ success: false, error: "That signature image is too large. Clear it and draw again." }, 413);
      }
      const now = new Date().toISOString();
      const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("cf-connecting-ip") || null;
      const documentHash = await sha256(`${row.document_url || ""}\n${row.document_content || ""}`);

      // Only flips a row that is still open, so two tabs cannot both sign it.
      const updated = await write("landlord_signatures", "PATCH",
        `id=eq.${encodeURIComponent(row.id)}&status=in.(pending,viewed)`, {
          status: "signed", signed_at: now, signer_name: signerName.slice(0, 200),
          signature_type: type, signature_image: type === "drawn" ? image : null,
          initials: body.initials ? String(body.initials).slice(0, 10) : null,
          signed_ip: ip, signed_user_agent: (req.headers.get("user-agent") || "").slice(0, 500),
          document_hash: documentHash, viewed_at: row.viewed_at || now, updated_at: now,
        });
      const signed = Array.isArray(updated) ? updated[0] : updated;
      if (!signed) return json({ success: false, error: "This document was already signed or withdrawn." }, 409);

      if (row.corporate_application_id && row.document_type === "lease") {
        await write("corporate_applications", "PATCH", `id=eq.${encodeURIComponent(row.corporate_application_id)}`, {
          current_stage: "lease_signed", status: "lease_signed",
          stage_lease_signed_at: now, updated_at: now,
        }).catch((e) => console.error("lease stage update failed", e));
      }

      await write("staff_notifications", "POST", "", {
        type: "landlord_document_signed",
        title: "A landlord signed a document",
        message: `${signerName} signed "${row.document_name}".`,
        metadata: { landlord_id: row.landlord_id, signature_id: row.id, corporate_application_id: row.corporate_application_id },
      }).catch((e) => console.error("staff notification not saved", e instanceof Error ? e.message : e));

      await sendEmail(SUCCESS_INBOX, `Signed by landlord: ${row.document_name}`, [
        `${signerName} signed "${row.document_name}" in the landlord portal on ${new Date(signed.signed_at || Date.now()).toUTCString()}.`,
        "",
        "If this needs a company countersignature, it is now in the staff countersign queue.",
        "Open the staff workspace to see it: https://accessyourplace.com/staff/workspace",
      ].join("\n"));

      return json({ success: true, signature: {
        id: signed.id, status: signed.status, signed_at: signed.signed_at,
        signer_name: signed.signer_name, document_name: signed.document_name,
      } });
    }

    if (action === "decline_signature") {
      const row = await signatureRow(body.signature_id, body.landlord_id);
      if (!row) return json({ success: false, error: "That document is not on your account." }, 404);
      if (row.status !== "pending" && row.status !== "viewed") {
        return json({ success: false, error: "This document is not waiting for your signature." }, 409);
      }
      const reason = String(body.reason || "").trim();
      if (!reason) return json({ success: false, error: "Tell us why, so we can fix it." }, 400);
      const now = new Date().toISOString();
      await write("landlord_signatures", "PATCH", `id=eq.${encodeURIComponent(row.id)}`,
        { status: "declined", declined_at: now, decline_reason: reason.slice(0, 1000), updated_at: now });
      await write("staff_notifications", "POST", "", {
        type: "landlord_document_declined",
        title: "A landlord declined to sign",
        message: `"${row.document_name}": ${reason.slice(0, 200)}`,
        metadata: { landlord_id: row.landlord_id, signature_id: row.id },
      }).catch((e) => console.error("staff notification not saved", e instanceof Error ? e.message : e));

      await sendEmail(SUCCESS_INBOX, `Declined by landlord: ${row.document_name}`, [
        `A landlord declined to sign "${row.document_name}".`,
        "",
        `Their reason: ${reason.slice(0, 1000)}`,
        "",
        "Open the staff workspace to follow up: https://accessyourplace.com/staff/workspace",
      ].join("\n"));
      return json({ success: true });
    }

    if (action === "get_landlord_applications") {
      // Staff: a landlord's corporate applications, to tie a lease to one when sending it.
      if (!body.landlord_id) return json({ success: false, error: "landlord_id is required." }, 400);
      return json({ success: true, applications: await read("corporate_applications",
        `select=id,client_name,client_business_name,community_name,unit_number,property_name,current_stage&landlord_id=eq.${encodeURIComponent(body.landlord_id)}&order=created_at.desc`) });
    }

    return json({ success: false, error: `Unsupported action: ${String(action)}` }, 400);
  } catch (error) {
    console.error("manage-landlord-portal", error);
    return json({ success: false, error: error instanceof Error ? error.message : "Landlord portal request failed" }, 500);
  }
});
