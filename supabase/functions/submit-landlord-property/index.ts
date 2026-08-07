// submit-landlord-property — the supply side's front door.
//
// Landlords reach out constantly and there has never been anywhere to put a property.
// Penny routes them to the landlord portal and the portal has no form, so every landlord
// ends in a manual email thread. landlord_applications, landlord_properties and
// landlord_inquiries all exist and all hold zero rows.
//
// This writes into `properties` rather than a parallel table, on purpose. properties
// already models exactly this workflow: submitted_by_type, submitted_by_client_name,
// submitted_by_client_email, approved_by_staff_id, approved_at, denial_reason,
// workflow_stage. All 21 existing rows are submitted_by_type = 'staff'. A landlord
// submission is the same object arriving through a different door, so it lands in the
// same queue the team already works instead of a second one nobody opens.
//
// NOT PUBLISHED ON ARRIVAL. status is 'pending_review'. The company vets every property
// and speaks to every landlord personally before it goes to an operator — that is the
// product, and nothing here bypasses it.
//
// NO Accept-Profile header: PostgREST here serves only the public schema
// (authenticator: pgrst.db_schemas = public). Anything written must also be exposed on
// the matching public view or the write is rejected. That has bitten this project twice.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const SUCCESS_INBOX = 'success@accessyourplace.com';
const BUCKET = 'property-photos';
const MAX_PHOTOS = 12;
const MAX_BYTES = 8 * 1024 * 1024;

// Validated against the DECODED BYTES, never the caller's claimed mime type.
const MAGIC: { mime: string; ext: string; test: (b: Uint8Array) => boolean }[] = [
  { mime: 'image/png', ext: 'png', test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 },
  { mime: 'image/jpeg', ext: 'jpg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: 'image/webp', ext: 'webp', test: (b) =>
      b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
      b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50 },
];

function sniff(bytes: Uint8Array<ArrayBuffer>) {
  return MAGIC.find((m) => bytes.length > 12 && m.test(bytes)) || null;
}

function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64.includes(',') ? b64.split(',').pop()! : b64);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) {
      console.error('submit-landlord-property missing_config');
      return json({ success: false, error: 'Something is wrong on our side. Please email success@accessyourplace.com.' }, 500);
    }

    const body = await req.json().catch(() => ({}));
    const contactName = String(body.contact_name || '').trim();
    const contactEmail = String(body.contact_email || '').trim().toLowerCase();
    const contactPhone = String(body.contact_phone || '').trim();
    const address = String(body.address || '').trim();
    const city = String(body.city || '').trim();
    const state = String(body.state || '').trim();
    const zip = String(body.zip_code || '').trim();
    const notes = String(body.notes || '').trim();

    if (!contactName) return json({ success: false, error: 'Please tell us your name.' }, 400);
    // Email is the only channel that actually works here — there is no SMS on this
    // platform. Phone is required because an acquisition manager rings landlords.
    if (!contactEmail) return json({ success: false, error: 'Please add your email address — that is how we reply.' }, 400);
    if (!contactPhone) return json({ success: false, error: 'Please add a phone number so the team can call you.' }, 400);
    if (!address) return json({ success: false, error: 'Please add the property address.' }, 400);
    if (!city || !state) return json({ success: false, error: 'Please add the city and state.' }, 400);

    const headers = {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    };

    // ---- photos first, so a storage failure never creates a listing with no images ----
    const rawPhotos: string[] = Array.isArray(body.photos) ? body.photos.slice(0, MAX_PHOTOS) : [];
    const photoUrls: string[] = [];
    const photoErrors: string[] = [];

    for (const [i, raw] of rawPhotos.entries()) {
      let bytes: Uint8Array<ArrayBuffer>;
      try {
        bytes = b64ToBytes(String(raw));
      } catch {
        photoErrors.push(`Photo ${i + 1} could not be read.`);
        continue;
      }
      if (bytes.length > MAX_BYTES) { photoErrors.push(`Photo ${i + 1} is over 8MB.`); continue; }
      const kind = sniff(bytes);
      if (!kind) { photoErrors.push(`Photo ${i + 1} is not a PNG, JPEG or WebP image.`); continue; }

      const path = `landlord-submissions/${Date.now()}_${crypto.randomUUID()}.${kind.ext}`;
      const up = await fetch(`${url}/storage/v1/object/${BUCKET}/${path}`, {
        method: 'POST',
        headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': kind.mime },
        // Uint8Array is not a BodyInit in this type set; a Blob is, and it also lets the
        // storage API see the sniffed content type rather than the caller's claim.
        body: new Blob([bytes], { type: kind.mime }),
      });
      if (!up.ok) {
        console.error('submit-landlord-property photo_upload_failed', up.status, (await up.text()).slice(0, 150));
        photoErrors.push(`Photo ${i + 1} could not be saved.`);
        continue;
      }
      photoUrls.push(`${url}/storage/v1/object/public/${BUCKET}/${path}`);
    }

    // ---- the submission itself ----
    const insert = await fetch(`${url}/rest/v1/properties`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        address, city, state,
        zip_code: zip || null,
        title: `${city}, ${state} — landlord submission`,
        bedrooms: num(body.bedrooms),
        bathrooms: num(body.bathrooms),
        monthly_rent: num(body.monthly_rent),
        property_type: String(body.property_type || '').trim() || null,
        total_units: num(body.total_units),
        is_furnished: body.is_furnished === true,
        description: notes || null,
        photos: photoUrls,
        // Never live on arrival. Every property is vetted and every landlord spoken to.
        status: 'pending_review',
        is_published: false,
        is_verified: false,
        workflow_stage: 'submitted',
        submitted_by_type: 'landlord',
        submitted_by_client_name: contactName,
        submitted_by_client_email: contactEmail,
        landlord_name: contactName,
        landlord_email: contactEmail,
        landlord_phone: contactPhone,
        source: 'landlord_submission',
      }),
    });

    if (!insert.ok) {
      const detail = (await insert.text()).slice(0, 300);
      console.error('submit-landlord-property insert_failed', insert.status, detail);
      return json({
        success: false,
        error: 'We could not save that just now. Please email success@accessyourplace.com and we will take the details directly.',
      }, 502);
    }
    const rows = await insert.json().catch(() => []);
    const prop = Array.isArray(rows) ? rows[0] : null;
    if (!prop?.id) {
      console.error('submit-landlord-property insert_no_rows');
      return json({
        success: false,
        error: 'We could not save that just now. Please email success@accessyourplace.com and we will take the details directly.',
      }, 502);
    }

    console.log('submit-landlord-property saved', JSON.stringify({
      property_id: prop.id, photos: photoUrls.length, photo_errors: photoErrors.length,
    }));

    // ---- notify, only after it is safely stored ----
    const resendKey = Deno.env.get('RESEND_API_KEY');
    let notified = false;
    if (resendKey) {
      const lines = [
        'A landlord has submitted a property for review.', '',
        `Contact: ${contactName}`, `Email: ${contactEmail}`, `Phone: ${contactPhone}`, '',
        `Address: ${address}`, `${city}, ${state} ${zip}`.trim(),
        body.bedrooms ? `Bedrooms: ${body.bedrooms}` : null,
        body.bathrooms ? `Bathrooms: ${body.bathrooms}` : null,
        body.monthly_rent ? `Asking rent: ${body.monthly_rent}` : null,
        body.total_units ? `Units: ${body.total_units}` : null,
        `Furnished: ${body.is_furnished === true ? 'yes' : 'no'}`,
        '', notes ? `Notes from the landlord:\n${notes}` : 'No notes left.',
        '', `Photos received: ${photoUrls.length}`,
        photoErrors.length ? `Photo problems: ${photoErrors.join(' ')}` : null,
        '', `It is saved as pending_review and is NOT published.`,
        `Property id: ${prop.id}`,
      ].filter(Boolean).join('\n');

      try {
        const r = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'Penny <penny@accessyourplace.com>',
            reply_to: [contactEmail],
            to: [SUCCESS_INBOX],
            subject: `Landlord property submitted — ${city}, ${state}`,
            text: lines,
          }),
        });
        notified = r.ok;
        if (!r.ok) console.error('submit-landlord-property notify_failed', r.status, (await r.text()).slice(0, 200));
      } catch (e) {
        console.error('submit-landlord-property notify_threw', e instanceof Error ? e.message : String(e));
      }

      // Confirmation to the landlord. Deliberately says a human will review it — this
      // company vets every property personally and the message should match reality.
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
          body: JSON.stringify({
            from: 'Penny <penny@accessyourplace.com>',
            reply_to: [SUCCESS_INBOX],
            to: [contactEmail],
            subject: 'We have your property — here is what happens next',
            text: [
              `Hi ${contactName.split(' ')[0] || 'there'},`, '',
              `Thanks for sending over ${address}, ${city}. We have it.`, '',
              'What happens now: someone from our team reviews it and calls you. We speak to every landlord and look at every property properly before it goes in front of an operator — we do not list anything we have not vetted.',
              '', 'If anything changes or you want to add photos or details, just reply to this email.',
              '', 'Penny', 'Client Success | Access Your Place',
            ].join('\n'),
          }),
        });
      } catch { /* the submission is already safe; a missing confirmation is not fatal */ }
    } else {
      console.error('submit-landlord-property missing RESEND_API_KEY');
    }

    return json({
      success: true,
      property_id: prop.id,
      photos_saved: photoUrls.length,
      photo_problems: photoErrors,
      notified,
      message: 'Got it. Someone from the team will review your property and call you.',
    });
  } catch (e) {
    console.error('submit-landlord-property threw', e instanceof Error ? e.message : String(e));
    return json({ success: false, error: 'Something went wrong. Please email success@accessyourplace.com.' }, 500);
  }
});
