const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};

// manage-investor-documents v2.1 - REST API approach for reliability
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return json({ success: false, error: 'Server configuration error' }, 500);
    }

    const getH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
    const mutH = { ...getH, 'Prefer': 'return=representation' };

    const body = await req.json();
    const { action, ...params } = body;
    console.log('[manage-investor-documents v2.1] Action:', action);

    // Helper: send email
    const sendEmail = async (to: string, subject: string, html: string) => {
      if (!RESEND_API_KEY || !to) return false;
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Access Your Place <notifications@accessyourplace.com>', to: [to], subject, html })
        });
        return res.ok;
      } catch (e) {
        console.warn('[v2.1] Email failed:', e);
        return false;
      }
    };

    // Helper: generate signed URL via Storage REST API
    async function generateSignedUrl(filePath: string, expirySeconds: number = 3600): Promise<{ url: string | null; error: string | null }> {
      if (!filePath || filePath.trim() === '') {
        return { url: null, error: 'file_path is empty or missing' };
      }

      const cleanPath = filePath.trim();
      const bucket = 'investor-documents';

      // Try creating signed URL via Supabase Storage REST API
      // POST /storage/v1/object/sign/{bucket}/{path}
      const paths = [
        cleanPath,
        cleanPath.startsWith('/') ? cleanPath.substring(1) : cleanPath,
        decodeURIComponent(cleanPath)
      ];

      // Remove duplicates
      const uniquePaths = [...new Set(paths)];

      for (const path of uniquePaths) {
        try {
          const signUrl = `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${path}`;
          const signRes = await fetch(signUrl, {
            method: 'POST',
            headers: {
              'apikey': SUPABASE_KEY,
              'Authorization': `Bearer ${SUPABASE_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({ expiresIn: expirySeconds })
          });

          if (signRes.ok) {
            const signData = await signRes.json();
            if (signData?.signedURL) {
              const fullUrl = signData.signedURL.startsWith('http') 
                ? signData.signedURL 
                : `${SUPABASE_URL}/storage/v1${signData.signedURL}`;
              console.log('[v2.1] Signed URL generated for path:', path);
              return { url: fullUrl, error: null };
            }
          } else {
            const errText = await signRes.text().catch(() => '');
            console.warn(`[v2.1] Sign attempt failed for path "${path}":`, signRes.status, errText.substring(0, 200));
          }
        } catch (e: any) {
          console.warn(`[v2.1] Sign exception for path "${path}":`, e.message);
        }
      }

      // If path contains bucket name, try stripping it
      if (cleanPath.includes('investor-documents/')) {
        const extractedPath = cleanPath.split('investor-documents/').pop() || '';
        if (extractedPath && !uniquePaths.includes(extractedPath)) {
          try {
            const signUrl = `${SUPABASE_URL}/storage/v1/object/sign/${bucket}/${extractedPath}`;
            const signRes = await fetch(signUrl, {
              method: 'POST',
              headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({ expiresIn: expirySeconds })
            });
            if (signRes.ok) {
              const signData = await signRes.json();
              if (signData?.signedURL) {
                const fullUrl = signData.signedURL.startsWith('http') ? signData.signedURL : `${SUPABASE_URL}/storage/v1${signData.signedURL}`;
                return { url: fullUrl, error: null };
              }
            }
          } catch {}
        }
      }

      return { url: null, error: `Could not generate signed URL for: ${cleanPath}` };
    }

    // ==================== DOWNLOAD / GET_SIGNED_URL ====================
    if (action === 'download' || action === 'get_signed_url') {
      let targetPath = params.file_path;
      const expiry = params.expiry_seconds || 3600;

      // If no file_path but document_id provided, look it up
      if (!targetPath && params.document_id) {
        try {
          const docRes = await fetch(
            `${SUPABASE_URL}/rest/v1/investor_documents?id=eq.${params.document_id}&select=file_path,document_url`,
            { headers: getH }
          );
          if (docRes.ok) {
            const docs = await docRes.json();
            const doc = docs?.[0];
            if (doc?.file_path) {
              targetPath = doc.file_path;
            } else if (doc?.document_url && doc.document_url.includes('investor-documents')) {
              const parts = doc.document_url.split('investor-documents/');
              if (parts.length > 1) targetPath = decodeURIComponent(parts[1].split('?')[0]);
            }
          }
        } catch (e: any) {
          console.warn('[v2.1] Document lookup failed:', e.message);
        }
      }

      if (!targetPath) {
        return json({ success: false, error: 'file_path or document_id required', url: null }, 400);
      }

      const result = await generateSignedUrl(targetPath, expiry);
      if (result.url) {
        return json({
          success: true,
          url: result.url,
          file_path: targetPath,
          expires_in: expiry,
          expires_at: new Date(Date.now() + expiry * 1000).toISOString()
        });
      } else {
        return json({ success: false, error: result.error, url: null, file_path: targetPath }, 404);
      }
    }

    // ==================== LIST ====================
    if (action === 'list') {
      const { investor_id, acquisition_id, document_type, status, limit: queryLimit, offset, order_by, order_direction } = params;

      if (!investor_id && !acquisition_id) {
        return json({ success: false, error: 'investor_id or acquisition_id required', documents: [] }, 400);
      }

      let url = `${SUPABASE_URL}/rest/v1/investor_documents?select=*`;
      if (investor_id) url += `&investor_id=eq.${investor_id}`;
      if (acquisition_id) url += `&acquisition_id=eq.${acquisition_id}`;
      if (document_type) url += `&document_type=eq.${document_type}`;
      if (status) url += `&status=eq.${status}`;

      const orderField = order_by || 'created_at';
      const ascending = order_direction === 'asc';
      url += `&order=${orderField}.${ascending ? 'asc' : 'desc'}`;
      if (queryLimit) url += `&limit=${queryLimit}`;
      if (offset) url += `&offset=${offset}`;

      const res = await fetch(url, { headers: getH });
      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[v2.1] List query failed:', errText.substring(0, 300));
        return json({ success: false, error: 'Failed to fetch documents', documents: [] }, 500);
      }

      const documents = await res.json();
      const enriched = (documents || []).map((doc: any) => ({
        ...doc,
        has_file: !!(doc.file_path || (doc.document_url && doc.document_url.trim() !== '')),
        can_download: !!doc.file_path,
        display_type: (doc.document_type || 'other').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      }));

      console.log(`[v2.1] Listed ${enriched.length} documents for investor ${investor_id || 'N/A'}`);
      return json({ success: true, documents: enriched, total: enriched.length, investor_id });
    }

    // ==================== LIST_BY_TYPE ====================
    if (action === 'list_by_type') {
      const { investor_id, document_type } = params;
      if (!investor_id) return json({ success: false, error: 'investor_id required', documents: [] }, 400);

      const url = `${SUPABASE_URL}/rest/v1/investor_documents?investor_id=eq.${investor_id}&document_type=eq.${document_type || 'other'}&order=created_at.desc`;
      const res = await fetch(url, { headers: getH });
      const data = res.ok ? await res.json() : [];
      return json({ success: true, documents: data });
    }

    // ==================== COUNT ====================
    if (action === 'count') {
      const { investor_id } = params;
      if (!investor_id) return json({ success: false, error: 'investor_id required' }, 400);

      const url = `${SUPABASE_URL}/rest/v1/investor_documents?investor_id=eq.${investor_id}&select=id`;
      const res = await fetch(url, { headers: { ...getH, 'Prefer': 'count=exact' } });
      const countHeader = res.headers.get('content-range');
      let count = 0;
      if (countHeader) {
        const match = countHeader.match(/\/(\d+)/);
        if (match) count = parseInt(match[1]);
      } else {
        const data = res.ok ? await res.json() : [];
        count = Array.isArray(data) ? data.length : 0;
      }
      return json({ success: true, count });
    }

    // ==================== UPLOAD ====================
    if (action === 'upload') {
      const { acquisition_id, investor_id, document_type, document_name, file_data, mime_type, uploaded_by, uploaded_by_name, investor_email, investor_name, property_id } = params;

      if (!investor_id || !document_name) {
        return json({ success: false, error: 'investor_id and document_name required' }, 400);
      }

      // Upload file to storage
      const fileBuffer = Uint8Array.from(atob(file_data), c => c.charCodeAt(0));
      const filePath = `${investor_id}/${acquisition_id || property_id || 'general'}/${Date.now()}_${document_name.replace(/\s+/g, '_')}`;

      const uploadUrl = `${SUPABASE_URL}/storage/v1/object/investor-documents/${filePath}`;
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': mime_type || 'application/octet-stream',
          'x-upsert': 'false'
        },
        body: fileBuffer
      });

      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => '');
        return json({ success: false, error: `Storage upload failed: ${errText}` }, 500);
      }

      // Insert document record
      const docData = {
        acquisition_id: acquisition_id || null,
        investor_id,
        document_type: document_type || 'other',
        document_name,
        file_path: filePath,
        file_size: fileBuffer.length,
        mime_type: mime_type || 'application/octet-stream',
        uploaded_by: uploaded_by || 'staff',
        uploaded_by_name: uploaded_by_name || 'Success Team',
        status: (uploaded_by === 'staff') ? 'approved' : 'pending',
        created_at: new Date().toISOString()
      };

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/investor_documents`, {
        method: 'POST', headers: mutH, body: JSON.stringify(docData)
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text().catch(() => '');
        return json({ success: false, error: `DB insert failed: ${errText}` }, 500);
      }

      const newDoc = (await insertRes.json())?.[0];

      // Send notification if uploaded by staff
      if (uploaded_by === 'staff' && investor_email) {
        const firstName = (investor_name || 'Investor').split(' ')[0];
        await sendEmail(investor_email, `New Document Available: ${document_name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:30px;text-align:center;">
              <h1 style="color:#f59e0b;margin:0;font-size:24px;">Access Your Place</h1>
            </div>
            <div style="padding:30px;">
              <p>Hi ${firstName},</p>
              <p>A new document has been uploaded to your portal:</p>
              <div style="background:#f8f9fa;border-left:4px solid #22c55e;padding:15px;margin:20px 0;border-radius:4px;">
                <strong>${document_name}</strong><br/>
                <span style="color:#64748b;">Type: ${(document_type || 'Document').replace(/_/g, ' ')}</span>
              </div>
              <div style="text-align:center;margin:30px 0;">
                <a href="https://accessyourplace.com/investor" style="background:#d4a574;color:#1a365d;padding:14px 36px;text-decoration:none;border-radius:8px;font-weight:700;">View Document</a>
              </div>
            </div>
          </div>`);
      }

      return json({ success: true, document: newDoc });
    }

    // ==================== SEND_DOCUMENT ====================
    if (action === 'send_document') {
      const { property_id, investor_id, document_type, document_name, file_path, investor_email, investor_name } = params;

      const signResult = await generateSignedUrl(file_path, 604800); // 7 days
      const downloadLink = signResult.url;
      const expiresAt = new Date(Date.now() + 604800000).toISOString();

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/acquisition_documents`, {
        method: 'POST', headers: mutH,
        body: JSON.stringify({
          property_id, investor_id, document_type, document_name, file_path,
          status: 'sent', sent_at: new Date().toISOString(),
          download_link: downloadLink, link_expires_at: expiresAt
        })
      });

      const doc = insertRes.ok ? (await insertRes.json())?.[0] : null;

      if (investor_email && downloadLink) {
        const firstName = (investor_name || 'Investor').split(' ')[0];
        await sendEmail(investor_email, `Action Required: ${document_name}`,
          `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:30px;text-align:center;">
              <h1 style="color:#f59e0b;margin:0;">Access Your Place</h1>
            </div>
            <div style="padding:30px;">
              <h2 style="color:#1a365d;">Document Ready</h2>
              <p>Hi ${firstName},</p>
              <p>Your <strong>${(document_type || '').replace(/_/g, ' ')}</strong> document is ready.</p>
              <p><strong>Document:</strong> ${document_name}</p>
              <a href="${downloadLink}" style="display:inline-block;background:#d4a574;color:white;padding:12px 24px;text-decoration:none;border-radius:6px;margin:16px 0;">Download Document</a>
              <p style="color:#666;font-size:12px;">This link expires in 7 days.</p>
            </div>
          </div>`);
      }

      return json({ success: true, document: doc, download_link: downloadLink });
    }

    // ==================== LIST_ACQUISITION_DOCS ====================
    if (action === 'list_acquisition_docs') {
      let url = `${SUPABASE_URL}/rest/v1/acquisition_documents?select=*&order=created_at.desc`;
      if (params.property_id) url += `&property_id=eq.${params.property_id}`;
      if (params.investor_id) url += `&investor_id=eq.${params.investor_id}`;
      const res = await fetch(url, { headers: getH });
      const data = res.ok ? await res.json() : [];
      return json({ success: true, documents: data });
    }

    // ==================== MARK_VIEWED ====================
    if (action === 'mark_viewed') {
      if (!params.document_id) return json({ success: false, error: 'document_id required' }, 400);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/acquisition_documents?id=eq.${params.document_id}`, {
        method: 'PATCH', headers: mutH,
        body: JSON.stringify({ status: 'viewed', viewed_at: new Date().toISOString() })
      });
      const data = res.ok ? (await res.json())?.[0] : null;
      return json({ success: true, document: data });
    }

    // ==================== MARK_SIGNED ====================
    if (action === 'mark_signed') {
      if (!params.document_id) return json({ success: false, error: 'document_id required' }, 400);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/acquisition_documents?id=eq.${params.document_id}`, {
        method: 'PATCH', headers: mutH,
        body: JSON.stringify({ status: 'signed', signed_at: new Date().toISOString(), signed_by: params.signed_by })
      });
      const data = res.ok ? (await res.json())?.[0] : null;
      return json({ success: true, document: data });
    }

    // ==================== UPDATE_STATUS ====================
    if (action === 'update_status') {
      if (!params.document_id) return json({ success: false, error: 'document_id required' }, 400);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_documents?id=eq.${params.document_id}`, {
        method: 'PATCH', headers: mutH,
        body: JSON.stringify({ status: params.status, reviewed_by: params.reviewed_by, reviewed_at: new Date().toISOString() })
      });
      const data = res.ok ? (await res.json())?.[0] : null;
      return json({ success: true, document: data });
    }

    // ==================== DELETE ====================
    if (action === 'delete') {
      if (!params.document_id) return json({ success: false, error: 'document_id required' }, 400);
      if (params.file_path) {
        try {
          await fetch(`${SUPABASE_URL}/storage/v1/object/investor-documents/${params.file_path}`, {
            method: 'DELETE',
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
          });
        } catch {}
      }
      await fetch(`${SUPABASE_URL}/rest/v1/investor_documents?id=eq.${params.document_id}`, {
        method: 'DELETE', headers: getH
      });
      return json({ success: true });
    }

    // ==================== GET_DOCUMENT ====================
    if (action === 'get_document' || action === 'get') {
      if (!params.document_id) return json({ success: false, error: 'document_id required' }, 400);
      const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_documents?id=eq.${params.document_id}&select=*`, { headers: getH });
      const doc = res.ok ? (await res.json())?.[0] : null;
      if (!doc) return json({ success: false, error: 'Document not found' }, 404);

      let signedUrl = null;
      if (doc.file_path) {
        const result = await generateSignedUrl(doc.file_path, 3600);
        signedUrl = result.url;
      }

      return json({ success: true, document: { ...doc, signed_url: signedUrl, has_file: !!(doc.file_path || doc.document_url) } });
    }

    // ==================== BULK_DOWNLOAD ====================
    if (action === 'bulk_download') {
      const targets: Array<{ id?: string; file_path?: string }> = [];

      if (params.file_paths && Array.isArray(params.file_paths)) {
        params.file_paths.forEach((fp: string) => targets.push({ file_path: fp }));
      } else if (params.document_ids && Array.isArray(params.document_ids)) {
        const idsFilter = params.document_ids.map((id: string) => `id.eq.${id}`).join(',');
        const res = await fetch(`${SUPABASE_URL}/rest/v1/investor_documents?or=(${idsFilter})&select=id,file_path`, { headers: getH });
        const docs = res.ok ? await res.json() : [];
        docs.forEach((d: any) => targets.push({ id: d.id, file_path: d.file_path }));
      }

      if (targets.length === 0) {
        return json({ success: false, error: 'No valid targets', urls: [] }, 400);
      }

      const results = await Promise.all(
        targets.map(async (t) => {
          if (!t.file_path) return { id: t.id, url: null, error: 'No file_path' };
          const result = await generateSignedUrl(t.file_path, 3600);
          return { id: t.id, file_path: t.file_path, url: result.url, error: result.error };
        })
      );

      return json({
        success: true,
        urls: results,
        generated: results.filter(r => r.url).length,
        failed: results.filter(r => !r.url).length
      });
    }

    return json({ 
      success: false, 
      error: `Invalid action: ${action}. Valid: upload, download, get_signed_url, list, list_by_type, list_acquisition_docs, bulk_download, send_document, get_document, get, count, mark_viewed, mark_signed, update_status, delete` 
    }, 400);
  } catch (error: any) {
    console.error('[manage-investor-documents v2.1] Error:', error.message);
    return json({ success: false, error: error.message }, 500);
  }
});

