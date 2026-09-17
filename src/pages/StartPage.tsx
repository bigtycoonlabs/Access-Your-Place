import { useState } from 'react';
import { supabase } from '@/lib/supabase';
// This page had no SEO block, so it inherited the generic site title. It is a
// lead-capture page, which is exactly what a promotion drives traffic to, and for a
// screen reader every page announcing the same sentence is no title at all.
import SEO from '@/components/SEO';
import { trackEvent, trackOnce } from '@/lib/analytics';

/**
 * /start — the front door.
 *
 * Built because the company has demand it cannot service: clients calling the owner's
 * phone, landlords asking for properties to be moved, operators with live emergencies in
 * other cities. None of it reached the platform, because there was no way in. The leads
 * table had the right columns and zero rows.
 *
 * This is a link the owner can text someone mid-call. No login, no invitation, no portal.
 * Name, a way to reach them, what they need. That is the whole thing, on purpose — every
 * extra field is a lead lost.
 *
 * Accessibility is not decoration here. The owners are blind, and so may be the people
 * they send this to: one h1, real <label> elements tied to inputs, a polite live region
 * for status, errors announced rather than only coloured, 44px targets, and the door
 * choice as real radio inputs in a fieldset rather than clickable divs.
 */

type Kind = 'sell_operation' | 'need_property' | 'setup_services' | 'teardown_services' | 'have_property' | 'live_operation_help';

type FieldType = 'text' | 'number' | 'date' | 'textarea' | 'select' | 'checkboxes';
type Field = { key: string; label: string; type: FieldType; help?: string; options?: string[]; required?: boolean; money?: boolean };
type Door = {
  kind: Kind; title: string; blurb: string;
  section: string; intro?: string;
  address?: { label: string; help: string; required: boolean };
  fields: Field[];
  photos?: { label: string; help: string; min: number };
  messageLabel?: string;
};

// One linear form. The door chosen at the top decides which questions appear below it, in
// the order a person would answer them. Not a wizard: a screen reader user can hear the
// whole shape of it and go back without losing their place.
const DOORS: Door[] = [
  {
    kind: 'sell_operation',
    title: 'I want to sell an operation I already run',
    blurb: 'You have a furnished rental running and want to hand it to a new operator.',
    section: 'About the operation you are selling',
    intro: 'Our team uses this to evaluate the listing. Your address and landlord details are never shown publicly.',
    address: { label: 'Unit address', help: 'Include the unit number. Kept private.', required: true },
    fields: [
      { key: 'unit_type', label: 'Type of unit', type: 'select', required: true, options: ['Apartment or condo', 'House', 'Townhome', 'Rooms in a shared home', 'Several units'] },
      { key: 'units_count', label: 'How many units are you selling?', type: 'number' },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number', required: true },
      { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
      { key: 'sleeps', label: 'How many guests it sleeps', type: 'number' },
      { key: 'platforms', label: 'Where you take bookings', type: 'checkboxes', options: ['Airbnb', 'VRBO', 'Direct bookings', 'Furnished Finder', 'Corporate or insurance stays', 'Other'] },
      { key: 'listing_links', label: 'Links to your listings', type: 'textarea', help: 'One per line. Optional, but it speeds up our review.' },
      { key: 'monthly_rent', label: 'Monthly rent you pay', type: 'number', required: true, money: true },
      { key: 'avg_monthly_revenue', label: 'Average monthly revenue', type: 'number', required: true, money: true },
      { key: 'peak_month_revenue', label: 'Revenue in your best month', type: 'number', money: true },
      { key: 'slow_month_revenue', label: 'Revenue in your slowest month', type: 'number', money: true },
      { key: 'asking_price', label: 'What you are asking for it', type: 'number', money: true, help: 'Leave blank if you want our advice.' },
      { key: 'years_operating', label: 'How long you have run it', type: 'text', help: 'For example, 2 years.' },
      { key: 'landlord_approval', label: 'Can the lease pass to a new operator?', type: 'select', required: true, options: ['Yes, the landlord has approved it', 'The lease allows it, landlord not asked yet', 'I am not sure', 'No'] },
      { key: 'lease_end', label: 'When the lease ends', type: 'date' },
      { key: 'deposit', label: 'Deposit, and whether it stays in place', type: 'text' },
      { key: 'bookings_transfer', label: 'Upcoming bookings', type: 'select', options: ['They transfer to the new operator', 'There are none right now', 'I will keep or cancel them'] },
      { key: 'furnished_items', label: 'What transfers with it', type: 'textarea', help: 'Furniture, supplies, smart locks, cameras, cleaners, and anything else.' },
      { key: 'available_date', label: 'Date you need it handed over by', type: 'date' },
      { key: 'reason', label: 'Why you are selling', type: 'textarea' },
    ],
    photos: { label: 'Photos of the unit', help: 'At least 3. Rooms, kitchen, bathroom and anything that makes it stand out. Please do not include screenshots showing guest names.', min: 3 },
  },
  {
    kind: 'need_property',
    title: 'I want to acquire a property to operate',
    blurb: 'You want a furnished rental opportunity. We find it, vet it, and negotiate the lease.',
    section: 'What you are looking for',
    fields: [
      { key: 'markets', label: 'Cities or markets you want', type: 'text', required: true, help: 'Or write "open to the best numbers".' },
      { key: 'property_preference', label: 'What you want to pick up', type: 'select', required: true, options: ['A running operation I can take over now', 'A new unit set up for me', 'Either'] },
      { key: 'strategy', label: 'How you want to rent it', type: 'checkboxes', options: ['Short-term', 'Mid-term, 30 days or more', 'Corporate housing', 'Co-living', 'Not sure yet'] },
      { key: 'bedrooms', label: 'Bedrooms', type: 'text', help: 'For example, 1 to 2.' },
      { key: 'budget', label: 'Budget to acquire', type: 'select', required: true, options: ['Under $5,000', '$5,000 to $10,000', '$10,000 to $25,000', 'Over $25,000'] },
      { key: 'timeline', label: 'When you want to start', type: 'select', options: ['Right away', 'In 1 to 3 months', 'In 3 to 6 months', 'Just researching'] },
      { key: 'experience', label: 'Units you run today', type: 'select', options: ['None yet', '1 to 2', '3 to 10', 'More than 10'] },
      { key: 'has_llc', label: 'Do you have an LLC?', type: 'select', options: ['Yes', 'No', 'In progress'] },
    ],
  },
  {
    kind: 'setup_services',
    title: 'I need a unit set up',
    blurb: 'Furniture, supplies and launch for a unit you have leased.',
    section: 'About the unit',
    address: { label: 'Unit address', help: 'Kept private.', required: true },
    fields: [
      { key: 'units_count', label: 'How many units', type: 'number' },
      { key: 'bedrooms', label: 'Bedrooms', type: 'number', required: true },
      { key: 'bathrooms', label: 'Bathrooms', type: 'number' },
      { key: 'unit_status', label: 'Condition right now', type: 'select', required: true, options: ['Empty', 'Partly furnished', 'Furnished, needs a refresh'] },
      { key: 'lease_start', label: 'Lease start or key date', type: 'date' },
      { key: 'needed_by', label: 'Date you need it ready', type: 'date' },
      { key: 'budget', label: 'Budget for furniture and supplies', type: 'text' },
      { key: 'style', label: 'Style or guests you are aiming for', type: 'text', help: 'For example, modern, family-friendly, business travellers.' },
    ],
    photos: { label: 'Photos or a floor plan', help: 'Optional. Helps us plan the layout.', min: 0 },
  },
  {
    kind: 'teardown_services',
    title: 'I need a unit taken down or moved',
    blurb: 'Packing up an operation, moving it to a new unit, or into storage.',
    section: 'About the move',
    address: { label: 'Address of the unit being taken down', help: 'Kept private.', required: true },
    fields: [
      { key: 'units_count', label: 'How many units', type: 'number' },
      { key: 'service_needed', label: 'What you need', type: 'checkboxes', required: true, options: ['Take it down and pack it', 'Move it to a new unit', 'Move it to storage', 'Remove, donate or dispose of items'] },
      { key: 'destination', label: 'Where it is going', type: 'text' },
      { key: 'needed_by', label: 'Date it must be done by', type: 'date', required: true },
      { key: 'furnished_items', label: 'Roughly what needs to move', type: 'textarea' },
    ],
    photos: { label: 'Photos of what needs to move', help: 'Optional. Helps us quote accurately.', min: 0 },
  },
  {
    kind: 'have_property',
    title: 'I am a landlord or apartment community',
    blurb: 'You have units and want reliable operators or corporate tenants in them.',
    section: 'About your property',
    address: { label: 'Property address', help: 'Kept private until you agree otherwise.', required: true },
    fields: [
      { key: 'role', label: 'You are', type: 'select', required: true, options: ['An individual landlord', 'A property manager', 'An apartment community or leasing office', 'A corporate housing owner'] },
      { key: 'company', label: 'Company or community name', type: 'text' },
      { key: 'units_count', label: 'Units available', type: 'number', required: true },
      { key: 'unit_type', label: 'Unit types', type: 'text', help: 'For example, studios and 2 bedrooms.' },
      { key: 'rent_range', label: 'Rent range', type: 'text' },
      { key: 'furnished', label: 'Are they furnished?', type: 'select', options: ['Furnished', 'Unfurnished', 'Some of each'] },
      { key: 'allowed_uses', label: 'Uses you would allow', type: 'checkboxes', options: ['Short-term', 'Mid-term, 30 days or more', 'Corporate leases', 'Co-living', 'Not sure yet'] },
      { key: 'available_date', label: 'Date units are available', type: 'date' },
      { key: 'amenities', label: 'Amenities and parking', type: 'textarea' },
    ],
    photos: { label: 'Photos of the property', help: 'Optional.', min: 0 },
  },
  {
    kind: 'live_operation_help',
    title: 'I need help with a live operation right now',
    blurb: 'Something is going wrong in a unit you are already running. This goes to the team as urgent.',
    section: 'What is happening',
    address: { label: 'Unit address', help: '', required: false },
    fields: [{ key: 'issue', label: 'What is wrong', type: 'textarea', required: true }],
    photos: { label: 'Photos of the problem', help: 'Optional.', min: 0 },
  },
];

const inputCls = 'mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2';

// Shrink a photo in the browser so uploads are quick on a phone connection. If the browser
// cannot decode it (some HEIC files), the original is sent as long as it is small enough.
async function prepareImage(file: File): Promise<{ data: string; type: string }> {
  const toB64 = (buf: ArrayBuffer) => {
    let bin = ''; const b = new Uint8Array(buf);
    for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode(...b.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const blob: Blob | null = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.82));
    if (!blob) throw new Error('encode');
    return { data: toB64(await blob.arrayBuffer()), type: 'image/jpeg' };
  } catch {
    if (file.size > 8_000_000 || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new Error('unreadable');
    return { data: toB64(await file.arrayBuffer()), type: file.type };
  }
}

export default function StartPage() {
  const [kind, setKind] = useState<Kind | ''>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [message, setMessage] = useState('');
  const [answers, setAnswers] = useState<Record<string, string | string[]>>({});
  const [photos, setPhotos] = useState<File[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [note, setNote] = useState('');
  const [progress, setProgress] = useState('');

  const door = DOORS.find((d) => d.kind === kind);
  const setAnswer = (k: string, v: string | string[]) => setAnswers((a) => ({ ...a, [k]: v }));

  function toggle(k: string, opt: string) {
    const cur = Array.isArray(answers[k]) ? (answers[k] as string[]) : [];
    setAnswer(k, cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt]);
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const imgs = Array.from(list).filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    setPhotos((p) => [...p, ...imgs].slice(0, 30));
  }

  function fail(msg: string) { setStatus('error'); setNote(msg); trackEvent('start_form_error', { kind: kind || 'none', reason: msg.slice(0, 80) }); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(''); setProgress('');
    if (!door) return fail('Please choose what you need help with.');
    if (!name.trim()) return fail('Please tell us your name.');
    if (!email.trim()) return fail('Please add your email address. That is how we reply and send your sign-in link.');
    if (!phone.trim()) return fail('Please add a phone number so the team can call you.');
    if (door.address?.required && !propertyAddress.trim()) return fail(`Please add the ${door.address.label.toLowerCase()}.`);
    for (const f of door.fields) {
      const v = answers[f.key];
      if (f.required && (!v || (Array.isArray(v) && v.length === 0) || (typeof v === 'string' && !v.trim()))) {
        return fail(`Please answer: ${f.label}.`);
      }
    }
    if (door.photos && photos.length < door.photos.min) {
      return fail(`Please add at least ${door.photos.min} photos of the unit. You have added ${photos.length}.`);
    }

    const details: Record<string, unknown> = {};
    for (const f of door.fields) {
      const v = answers[f.key];
      if (v == null || (Array.isArray(v) && !v.length) || (typeof v === 'string' && !v.trim())) continue;
      details[f.key] = f.type === 'number' && typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : v;
    }

    setStatus('sending');
    setProgress('Sending your details.');
    let leadId = ''; let token = ''; let reply = '';
    try {
      const { data, error } = await supabase.functions.invoke('capture-lead', {
        body: {
          kind, name, email, phone, city,
          property_address: propertyAddress,
          message: kind === 'live_operation_help' ? String(answers.issue || message) : message,
          details, source: 'start_page',
        },
      });
      if (error || !data?.success) {
        const ctx = (error as any)?.context;
        const parsed = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json().catch(() => null) : null;
        return fail(parsed?.error || data?.error || 'We could not send that just now. Please email success@accessyourplace.com and we will pick it up.');
      }
      leadId = data.lead_id; token = data.upload_token || ''; reply = data.message || 'Got it. Someone from the team will be in touch.';
    } catch {
      return fail('We could not send that just now. Please email success@accessyourplace.com and we will pick it up.');
    }

    // The details are saved at this point. Photos go up one at a time, and the result is
    // reported as it actually happened rather than assumed.
    let sent = 0; const failed: string[] = [];
    if (photos.length && token) {
      for (let i = 0; i < photos.length; i++) {
        setProgress(`Your details are saved. Uploading photo ${i + 1} of ${photos.length}.`);
        try {
          const img = await prepareImage(photos[i]);
          const { data } = await supabase.functions.invoke('capture-lead', {
            body: { action: 'photo', lead_id: leadId, upload_token: token, content_type: img.type, data: img.data },
          });
          if (data?.success) sent++; else failed.push(photos[i].name);
        } catch { failed.push(photos[i].name); }
      }
    }
    let photoNote = '';
    if (photos.length) {
      photoNote = failed.length
        ? ` ${sent} of ${photos.length} photos uploaded. These did not: ${failed.join(', ')}. Please email them to success@accessyourplace.com.`
        : ` All ${sent} photos uploaded.`;
    }
    trackEvent('start_form_submitted', { kind, photos: photos.length, photos_uploaded: sent, photos_failed: failed.length });
    setStatus('done');
    setProgress('');
    setNote(reply + photoNote);
  }

  const seo = <SEO title="Get started with Access Your Place" description="Sell an operation, acquire a property, book setup or teardown, or list your property. Tell us what you need. No account required." />;

  if (status === 'done') {
    return (
      <>
        {seo}
        <main className="min-h-screen bg-slate-50 px-4 py-12">
          <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6">
            <h1 className="text-2xl font-semibold text-slate-900">Thank you. We have it.</h1>
            <p role="status" aria-live="polite" className="mt-3 text-lg text-slate-800">{note}</p>
            <p className="mt-4 text-slate-700">
              If you need us sooner, email{' '}
              <a href="mailto:success@accessyourplace.com" className="underline underline-offset-2">success@accessyourplace.com</a>.
            </p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {seo}
      <main className="min-h-screen bg-slate-50 px-4 py-10">
        <div className="mx-auto max-w-xl">
          <h1 className="text-2xl font-semibold text-slate-900">Let's get you to the right person</h1>
          <p className="mt-2 text-slate-700">
            Choose what you need, and the questions for it appear below. No account required. We reply by email, and someone from the team may call.
          </p>

          <form onSubmit={submit} className="mt-6 space-y-6" noValidate onFocusCapture={() => trackOnce('start_form_started', { kind: kind || 'none' })}>
            <fieldset className="space-y-2">
              <legend className="text-base font-medium text-slate-900">What do you need?</legend>
              {DOORS.map((d) => (
                <label key={d.kind} htmlFor={d.kind}
                  className="flex min-h-[44px] cursor-pointer gap-3 rounded-lg border border-slate-300 bg-white p-3 hover:border-slate-500">
                  <input type="radio" id={d.kind} name="kind" value={d.kind} checked={kind === d.kind}
                    onChange={() => { setKind(d.kind); setStatus('idle'); setNote(''); trackEvent('start_door_selected', { kind: d.kind }); }} className="mt-1 h-5 w-5 shrink-0" />
                  <span>
                    <span className="block font-medium text-slate-900">{d.title}</span>
                    <span className="block text-sm text-slate-600">{d.blurb}</span>
                  </span>
                </label>
              ))}
            </fieldset>

            {kind === 'live_operation_help' && (
              <p role="status" aria-live="polite" className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                This will be flagged as urgent and sent to the team straight away.
              </p>
            )}

            <fieldset className="space-y-4">
              <legend className="text-base font-medium text-slate-900">How to reach you</legend>
              <div>
                <label htmlFor="name" className="block font-medium text-slate-900">Your name</label>
                <input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required aria-required="true" className={inputCls} />
              </div>
              <div>
                <label htmlFor="email" className="block font-medium text-slate-900">Email address</label>
                <p id="email-help" className="text-sm text-slate-600">We reply here and send your sign-in link to this address.</p>
                <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                  required aria-required="true" aria-describedby="email-help" className={inputCls} />
              </div>
              <div>
                <label htmlFor="phone" className="block font-medium text-slate-900">Phone number</label>
                <p id="phone-help" className="text-sm text-slate-600">So someone from the team can call you. We do not send text messages.</p>
                <input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" required aria-required="true" aria-describedby="phone-help" className={inputCls} />
              </div>
              <div>
                <label htmlFor="city" className="block font-medium text-slate-900">City and state <span className="font-normal text-slate-600">(optional)</span></label>
                <input id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
              </div>
            </fieldset>

            {door && (
              <fieldset className="space-y-4" aria-describedby={door.intro ? 'door-intro' : undefined}>
                <legend className="text-lg font-semibold text-slate-900">{door.section}</legend>
                {door.intro && <p id="door-intro" className="text-slate-700">{door.intro}</p>}

                {door.address && (
                  <div>
                    <label htmlFor="property" className="block font-medium text-slate-900">
                      {door.address.label}{!door.address.required && <span className="font-normal text-slate-600"> (optional)</span>}
                    </label>
                    {door.address.help && <p id="property-help" className="text-sm text-slate-600">{door.address.help}</p>}
                    <input id="property" type="text" value={propertyAddress} onChange={(e) => setPropertyAddress(e.target.value)}
                      autoComplete="street-address" required={door.address.required} aria-required={door.address.required}
                      aria-describedby={door.address.help ? 'property-help' : undefined} className={inputCls} />
                  </div>
                )}

                {door.fields.map((f) => {
                  const id = `f-${f.key}`;
                  const helpId = f.help ? `${id}-help` : undefined;
                  const optional = !f.required && <span className="font-normal text-slate-600"> (optional)</span>;
                  if (f.type === 'checkboxes') {
                    const cur = Array.isArray(answers[f.key]) ? (answers[f.key] as string[]) : [];
                    return (
                      <fieldset key={f.key} className="space-y-1">
                        <legend className="font-medium text-slate-900">{f.label}{optional}</legend>
                        {f.options!.map((o, i) => (
                          <label key={o} htmlFor={`${id}-${i}`} className="flex min-h-[44px] items-center gap-3">
                            <input type="checkbox" id={`${id}-${i}`} checked={cur.includes(o)} onChange={() => toggle(f.key, o)} className="h-5 w-5" />
                            <span>{o}</span>
                          </label>
                        ))}
                      </fieldset>
                    );
                  }
                  const v = typeof answers[f.key] === 'string' ? (answers[f.key] as string) : '';
                  return (
                    <div key={f.key}>
                      <label htmlFor={id} className="block font-medium text-slate-900">
                        {f.label}{f.money && ' in dollars'}{optional}
                      </label>
                      {f.help && <p id={helpId} className="text-sm text-slate-600">{f.help}</p>}
                      {f.type === 'select' ? (
                        <select id={id} value={v} onChange={(e) => setAnswer(f.key, e.target.value)} required={f.required} aria-required={f.required} aria-describedby={helpId} className={inputCls + ' bg-white'}>
                          <option value="">Choose one</option>
                          {f.options!.map((o) => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : f.type === 'textarea' ? (
                        <textarea id={id} rows={3} value={v} onChange={(e) => setAnswer(f.key, e.target.value)} required={f.required} aria-required={f.required} aria-describedby={helpId} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
                      ) : (
                        <input id={id} type={f.type === 'number' ? 'text' : f.type} inputMode={f.type === 'number' ? 'decimal' : undefined}
                          value={v} onChange={(e) => setAnswer(f.key, f.type === 'number' ? e.target.value.replace(/[^0-9.]/g, '') : e.target.value)}
                          required={f.required} aria-required={f.required} aria-describedby={helpId} className={inputCls} />
                      )}
                    </div>
                  );
                })}

                {door.photos && (
                  <div>
                    <label htmlFor="photos" className="block font-medium text-slate-900">
                      {door.photos.label}{door.photos.min === 0 && <span className="font-normal text-slate-600"> (optional)</span>}
                    </label>
                    <p id="photos-help" className="text-sm text-slate-600">{door.photos.help} Up to 30.</p>
                    <input id="photos" type="file" accept="image/*" multiple aria-describedby="photos-help photos-count"
                      onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
                      className="mt-1 block w-full min-h-[44px] text-slate-800" />
                    <p id="photos-count" aria-live="polite" className="mt-2 text-slate-800">
                      {photos.length === 0 ? 'No photos added yet.' : `${photos.length} photo${photos.length === 1 ? '' : 's'} added.`}
                    </p>
                    {photos.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {photos.map((p, i) => (
                          <li key={`${p.name}-${i}`} className="flex items-center justify-between gap-2">
                            <span className="truncate">{p.name}</span>
                            <button type="button" onClick={() => setPhotos((x) => x.filter((_, j) => j !== i))}
                              className="min-h-[44px] rounded-md border border-slate-300 px-3" aria-label={`Remove photo ${p.name}`}>
                              Remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </fieldset>
            )}

            <div>
              <label htmlFor="message" className="block font-medium text-slate-900">
                {door?.messageLabel || 'Anything else you want us to know'} <span className="font-normal text-slate-600">(optional)</span>
              </label>
              <textarea id="message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
            </div>

            <div aria-live="polite" role="status">
              {status === 'error' && note && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{note}</p>}
              {status === 'sending' && <p className="text-slate-700">{progress || 'Sending.'}</p>}
            </div>

            <button type="submit" disabled={status === 'sending'}
              className="w-full min-h-[44px] rounded-md bg-[#1a365d] px-4 py-3 font-medium text-white disabled:opacity-60">
              {status === 'sending' ? 'Sending…' : 'Send this to the team'}
            </button>

            <p className="text-sm text-slate-600">
              Prefer email? Write to{' '}
              <a href="mailto:success@accessyourplace.com" className="underline underline-offset-2">success@accessyourplace.com</a>.
            </p>
          </form>
        </div>
      </main>
    </>
  );
}
