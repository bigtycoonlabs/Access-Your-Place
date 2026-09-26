import { gate, whoIsAsking } from '../_shared/identity.ts';
// deliver-document
//
// THE ONE PATH for putting a document in front of a client or a landlord.
//
// WHY THIS EXISTS
// There was no way to attach a file to an outbound email. Getting a master lease to a
// landlord meant writing the PDF to the PUBLIC property-photos bucket behind temporary
// row-level-security policies, letting the mail provider fetch it from there, then
// deleting the file and dropping the policies again. That left client contracts on a
// public URL, opened the photos bucket to anonymous writes for the duration, and depended
// on somebody remembering to undo both. It also left no record anywhere that the document
// had been sent.
//
// This function does it properly: the file goes into a PRIVATE bucket, it is attached to
// the email as bytes, the body carries a time-limited signed link as a fallback, and the
// delivery is written down with the file's SHA-256 so we can prove what was sent.
//
// WHAT THIS WILL NOT DO
//   - It will not report a document as delivered when the provider refused it.
//   - It will not write anything to a public bucket.
//   - It will not silently skip the log. A delivered document with no record is the
//     failure this was built to end, so a log failure comes back as a warning.

const DATA_SCHEMA = 'public';
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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-staff-session, x-investor-session, x-landlord-session',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') || '';

// Private. Never a public bucket, whatever the caller asks for.
const BUCKET = 'seller-documents';
const PREFIX = 'outbound';

// Only verified sending domains. A From on an unverified domain silently lands in spam.
const ALLOWED_FROM: Record<string, string> = {
  success: 'Access Your Place Success Team <success@accessyourplace.com>',
  penny: 'Penny at Access Your Place <penny@accessyourplace.com>',
  vission: 'Vission Cooper <vission@accessyourplace.com>',
};

const TERMS_URL = 'https://accessyourplace.com/terms-of-service';
const DEFAULT_LINK_TTL = 604800; // 7 days
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 30 * 1024 * 1024; // the provider caps one message at 40MB

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  csv: 'text/csv',
  txt: 'text/plain',
};

const rest = (path: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });

const safeName = (n: string) =>
  String(n || 'document').trim().replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'document';

const extOf = (n: string) => (n.includes('.') ? n.split('.').pop()!.toLowerCase() : '');

const sha256 = async (bytes: Uint8Array) => {
  const d = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

const decodeB64 = (b64: string) => {
  const clean = String(b64).replace(/^data:[^;]+;base64,/, '').replace(/\s+/g, '');
  const bin = atob(clean);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
};

// Chunked: fromCharCode.apply on a multi-megabyte array blows the stack.
const encodeB64 = (bytes: Uint8Array) => {
  let bin = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
};

const esc = (s: string) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// A signed URL is minted relative. It is useless without the storage prefix back on it.
const signPath = async (path: string, ttl: number) => {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/${BUCKET}/${path}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: ttl }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.signedURL) {
    throw new Error(`Could not mint a signed link (HTTP ${res.status}) ${JSON.stringify(data).slice(0, 200)}`);
  }
  return String(data.signedURL).startsWith('http')
    ? String(data.signedURL)
    : `${SUPABASE_URL}/storage/v1${data.signedURL}`;
};

const uploadBytes = async (path: string, bytes: Uint8Array, contentType: string) => {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': contentType,
      'x-upsert': 'false',
      'cache-control': 'max-age=0',
    },
    body: bytes,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Storage refused the file (HTTP ${res.status}) ${t.slice(0, 200)}`);
  }
};

const downloadBytes = async (path: string) => {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  });
  if (!res.ok) throw new Error(`Could not read ${path} from storage (HTTP ${res.status}).`);
  return new Uint8Array(await res.arrayBuffer());
};

const htmlBody = (bodyText: string, docs: { filename: string; link: string }[], ttlDays: number) => {
  const paras = String(bodyText || '')
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 14px;line-height:1.55;">${esc(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const links = docs.length
    ? `<div style="margin:22px 0 8px;">${docs
        .map(
          (d) =>
            `<a href="${esc(d.link)}" style="display:inline-block;margin:0 8px 8px 0;padding:11px 18px;background:#13161a;color:#e8d9b5;text-decoration:none;border-radius:6px;font-weight:600;">Download ${esc(d.filename)}</a>`,
        )
        .join('')}</div><p style="margin:0 0 18px;color:#666;font-size:12px;">Each document is attached to this email. The download links above expire in ${ttlDays} days.</p>`
    : '';
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f5f5f4;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#13161a;font-size:15px;">\n<div style="max-width:620px;margin:0 auto;background:#fff;padding:30px 32px;border-radius:10px;">\n${paras}${links}\n<p style="margin:26px 0 0;padding-top:16px;border-top:1px solid #e6e4e0;color:#666;font-size:12px;">\n<a href="${TERMS_URL}" style="color:#666;">Terms of Service</a> &middot; Access Your Place &middot; success@accessyourplace.com\n</p></div></body></html>`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (d: unknown, status = 200) =>
    new Response(JSON.stringify(d), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body?.action || 'deliver');

    // Staff and system only. No client and no landlord sends a document to themselves.
    { const denied = await gate(req, body, action, corsHeaders, {}); if (denied) return denied; }
    const who = await whoIsAsking(req).catch(() => null);

    if (action === 'list') {
      const limit = Math.min(Number(body.limit) || 50, 200);
      let q = `document_deliveries?select=*&order=created_at.desc&limit=${limit}`;
      if (body.recipient_email) q += `&recipient_email=eq.${encodeURIComponent(String(body.recipient_email))}`;
      if (body.landlord_id) q += `&landlord_id=eq.${encodeURIComponent(String(body.landlord_id))}`;
      const r = await rest(q);
      const rows = await r.json().catch(() => []);
      if (!r.ok) return json({ success: false, error: 'Could not read the delivery log.' }, 500);
      return json({ success: true, deliveries: rows });
    }

    if (action === 'refresh_link') {
      const id = String(body.delivery_id || '');
      if (!id) return json({ success: false, error: 'delivery_id required' }, 400);
      const r = await rest(`document_deliveries?select=*&id=eq.${encodeURIComponent(id)}&limit=1`);
      const rows = await r.json().catch(() => []);
      const row = Array.isArray(rows) ? rows[0] : null;
      if (!row?.file_path) return json({ success: false, error: 'No such delivery, or it has no stored file.' }, 404);
      const ttl = Math.min(Number(body.link_ttl_seconds) || DEFAULT_LINK_TTL, 604800);
      const link = await signPath(row.file_path, ttl);
      const expires = new Date(Date.now() + ttl * 1000).toISOString();
      await rest(`document_deliveries?id=eq.${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify({ download_link: link, link_expires_at: expires }),
      }).catch(() => {});
      return json({ success: true, link, expires_at: expires });
    }

    if (action !== 'deliver') return json({ success: false, error: `Unknown action: ${action}` }, 400);

    // ---- deliver ----
    const to = String(body.to_email || '').trim();
    const subject = String(body.subject || '').trim();
    const bodyText = String(body.body_text || '').trim();
    if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return json({ success: false, error: 'A valid to_email is required.' }, 400);
    if (!subject) return json({ success: false, error: 'subject is required.' }, 400);
    if (!bodyText) return json({ success: false, error: 'body_text is required.' }, 400);
    if (!RESEND_KEY) return json({ success: false, error: 'No mail provider key is configured. Nothing was sent.' }, 500);

    const from = ALLOWED_FROM[String(body.from || 'penny')] || ALLOWED_FROM.penny;
    const replyTo = String(body.reply_to || 'success@accessyourplace.com');
    const ttl = Math.min(Number(body.link_ttl_seconds) || DEFAULT_LINK_TTL, 604800);
    const ttlDays = Math.max(1, Math.round(ttl / 86400));
    const attach = body.attach !== false;
    const docsIn = Array.isArray(body.documents) ? body.documents : [];
    if (docsIn.length > 10) return json({ success: false, error: 'Ten documents is the limit for one delivery.' }, 400);

    const now = new Date();
    const stored: { filename: string; path: string; size: number; sha: string; link: string; b64: string; contentType: string }[] = [];
    let total = 0;

    for (const d of docsIn) {
      const filename = safeName(d?.filename || 'document.pdf');
      const ext = extOf(filename);
      const contentType = String(d?.content_type || MIME[ext] || 'application/octet-stream');

      let path: string;
      let bytes: Uint8Array;

      if (d?.path) {
        // Already in the private bucket. Do not copy it, read it back to attach it.
        path = String(d.path).replace(/^\/+/, '');
        if (path.includes('..')) return json({ success: false, error: 'Bad document path.' }, 400);
        bytes = await downloadBytes(path);
      } else if (d?.content_base64) {
        bytes = decodeB64(d.content_base64);
        if (!bytes.length) return json({ success: false, error: `${filename} decoded to nothing.` }, 400);
        if (bytes.length > MAX_BYTES) return json({ success: false, error: `${filename} is over the 20MB limit.` }, 413);
        path = `${PREFIX}/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, '0')}/${crypto.randomUUID()}-${filename}`;
        await uploadBytes(path, bytes, contentType);
      } else {
        return json({ success: false, error: `${filename} has neither content_base64 nor path.` }, 400);
      }

      total += bytes.length;
      if (total > MAX_TOTAL_BYTES) {
        return json({ success: false, error: 'Those documents come to more than 30MB together. Send them in two emails.' }, 413);
      }

      const link = await signPath(path, ttl);
      stored.push({ filename, path, size: bytes.length, sha: await sha256(bytes), link, b64: encodeB64(bytes), contentType });
    }

    const payload: Record<string, unknown> = {
      from,
      to: [to],
      reply_to: replyTo,
      subject,
      text: `${bodyText}\n\n---\nTerms of Service: ${TERMS_URL}`,
      html: body.body_html || htmlBody(bodyText, stored, ttlDays),
    };
    if (attach && stored.length) {
      // Bytes, not a remote URL. The provider never has to reach our storage.
      payload.attachments = stored.map((s) => ({ filename: s.filename, content: s.b64, content_type: s.contentType }));
    }

    const sr = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const provider = await sr.json().catch(() => ({}));
    const sent = sr.ok && !!provider?.id;
    const providerError = sent ? null : `Provider refused: HTTP ${sr.status} ${JSON.stringify(provider).slice(0, 300)}`;

    const expiresAt = new Date(Date.now() + ttl * 1000).toISOString();
    const base = {
      kind: String(body.kind || 'other'),
      recipient_kind: String(body.recipient_kind || 'other'),
      recipient_email: to,
      recipient_name: body.to_name ? String(body.to_name) : null,
      landlord_id: body.landlord_id || null,
      investor_id: body.investor_id || null,
      subject,
      attached: attach && stored.length > 0,
      from_email: from,
      resend_id: provider?.id || null,
      status: sent ? 'sent' : 'failed',
      error_message: providerError,
      sent_by: who?.kind === 'staff' ? who.id : null,
      sent_by_name: body.sent_by_name ? String(body.sent_by_name) : null,
      metadata: body.metadata && typeof body.metadata === 'object' ? body.metadata : {},
    };
    const rows = stored.length
      ? stored.map((s) => ({
          ...base,
          document_name: s.filename,
          bucket: BUCKET,
          file_path: s.path,
          file_size: s.size || null,
          sha256: s.sha || null,
          download_link: s.link,
          link_expires_at: expiresAt,
        }))
      : [base];

    let logWarning: string | null = null;
    const lr = await rest('document_deliveries', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify(rows),
    });
    const logged = await lr.json().catch(() => null);
    if (!lr.ok) logWarning = `The document went out but the delivery log failed: ${JSON.stringify(logged).slice(0, 200)}`;

    if (!sent) return json({ success: false, error: providerError, documents: stored.map((s) => s.filename) }, 502);

    return json({
      success: true,
      resend_id: provider.id,
      delivered: stored.map((s) => ({ filename: s.filename, path: s.path, size: s.size, sha256: s.sha, link_expires_at: expiresAt })),
      delivery_ids: Array.isArray(logged) ? logged.map((r: any) => r.id) : [],
      warning: logWarning,
    });
  } catch (e) {
    // The detail (storage responses, paths) goes to the function log, not back to the
    // caller. The reference ties the two together.
    const ref = crypto.randomUUID().slice(0, 8);
    console.error('deliver-document failed', ref, e instanceof Error ? (e.stack || e.message) : String(e));
    return json({
      success: false,
      error: `The delivery did not complete. Check the delivery log before sending again. Reference ${ref}.`,
      reference: ref,
    }, 500);
  }
});
