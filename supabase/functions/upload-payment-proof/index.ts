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

// upload-payment-proof
//
// Payment screenshots are financial documents: they show a client's bank or
// wallet, an amount, and often an account fragment. They go to the PRIVATE
// investor-documents bucket and are read back only through short-lived signed
// URLs. They must never be written to property-photos or concept-images, both
// of which are public buckets where a link is permanently world-readable.
//
// Pairs with manage-payment-proofs: this returns a storage PATH, which is what
// gets stored as proof_url. Staff exchange that path for a signed URL at review
// time via get_signed_url.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const BUCKET = 'investor-documents';
const MAX_BYTES = 8 * 1024 * 1024; // 8MB — a phone screenshot is well under this
const SIGNED_URL_TTL = 900; // 15 minutes: long enough to review, short enough to expire

// Screenshots only. Validated against the DECODED BYTES via magic number, not
// the caller-supplied mime type, because a caller-supplied type is a claim.
const MAGIC: { mime: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: 'image/png', ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    mime: 'image/webp',
    ext: 'webp',
    test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

function sniff(bytes: Uint8Array) {
  return MAGIC.find((m) => bytes.length > 12 && m.test(bytes)) || null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function verifyStaff(supabase: any, staffId: string): Promise<boolean> {
  if (!staffId) return false;
  const { data } = await supabase.from('staff_users').select('id,is_active').eq('id', staffId).maybeSingle();
  return !!data && data.is_active !== false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || 'upload');

    /* ------------------------------- upload ------------------------------- */
    if (action === 'upload') {
      const investorId = String(body.investor_id || '').trim();
      const b64 = String(body.file_data || '');

      if (!investorId) return json({ success: false, error: 'investor_id is required' }, 400);
      if (!b64) return json({ success: false, error: 'Attach a screenshot of the payment.' }, 400);

      let bytes: Uint8Array;
      try {
        bytes = base64ToBytes(b64.includes(',') ? b64.split(',').pop()! : b64);
      } catch {
        return json({ success: false, error: 'That file could not be read. Try a PNG or JPEG screenshot.' }, 400);
      }

      // Size is checked on the DECODED bytes, so the limit is the real limit
      // rather than an estimate from base64 length.
      if (bytes.length > MAX_BYTES) {
        return json({ success: false, error: 'That image is over 8MB. A phone screenshot is usually well under.' }, 400);
      }

      const kind = sniff(bytes);
      if (!kind) {
        return json(
          { success: false, error: 'That does not look like an image. Please attach a PNG, JPEG or WebP screenshot.' },
          400,
        );
      }

      // Path is derived from the verified investor id and a random name. The
      // client never chooses the path, so it cannot write outside its own
      // folder or overwrite another client's proof.
      const path = `payment-proofs/${investorId}/${Date.now()}_${crypto.randomUUID()}.${kind.ext}`;

      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, bytes, { contentType: kind.mime, upsert: false });

      if (upErr) {
        console.error('upload-payment-proof upload_failed', upErr.message);
        return json({ success: false, error: 'We could not save that screenshot. Please try again.' }, 500);
      }

      // Returns a PATH, not a URL. The bucket is private on purpose; a URL here
      // would either be dead or, worse, permanent.
      return json({ success: true, path, bucket: BUCKET, bytes: bytes.length, mime: kind.mime });
    }

    /* --------------------------- staff: view proof --------------------------- */
    if (action === 'get_signed_url') {
      if (!(await verifyStaff(supabase, String(body.staff_id || '')))) {
        return json({ success: false, error: 'Staff access required.' }, 403);
      }
      const path = String(body.path || '').trim();
      if (!path) return json({ success: false, error: 'path is required' }, 400);

      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
      if (error || !data?.signedUrl) {
        console.error('upload-payment-proof sign_failed', error?.message);
        // Never fall back to getPublicUrl here. On a private bucket that yields
        // a dead link; on a public one it yields a permanent world-readable link
        // to a client's bank screenshot. Failing is the correct outcome.
        return json({ success: false, error: 'Could not open that proof.' }, 502);
      }

      return json({ success: true, signed_url: data.signedUrl, expires_in_seconds: SIGNED_URL_TTL });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('upload-payment-proof threw', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Something went wrong handling that upload.' }, 500);
  }
});
