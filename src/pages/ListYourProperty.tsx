import { useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * /list-your-property — the supply side's front door.
 *
 * Landlords reach out constantly and there has never been anywhere to put a property.
 * Penny routes them to the landlord portal; the portal has no form. So every landlord
 * ended in a manual email thread, and landlord_properties held zero rows.
 *
 * Deliberately NO account required. Asking a landlord to register before they can tell
 * you about a building is how you lose the building. The account can come later; the
 * property cannot wait.
 *
 * Photos are optional. A landlord who has to find photos before submitting often does
 * not come back, and the team can always ask.
 */

type Photo = { name: string; data: string };

export default function ListYourProperty() {
  const [f, setF] = useState({
    contact_name: '', contact_email: '', contact_phone: '',
    address: '', city: '', state: '', zip_code: '',
    bedrooms: '', bathrooms: '', monthly_rent: '', total_units: '',
    property_type: '', notes: '',
  });
  const [furnished, setFurnished] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [note, setNote] = useState('');
  const [problems, setProblems] = useState<string[]>([]);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setF((prev) => ({ ...prev, [k]: e.target.value }));

  async function onPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []).slice(0, 12);
    const read = await Promise.all(
      files.map(
        (file) =>
          new Promise<Photo | null>((resolve) => {
            const r = new FileReader();
            r.onload = () => resolve({ name: file.name, data: String(r.result).split(',').pop() || '' });
            r.onerror = () => resolve(null);
            r.readAsDataURL(file);
          }),
      ),
    );
    setPhotos(read.filter(Boolean) as Photo[]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote(''); setProblems([]);

    if (!f.contact_name.trim()) { setStatus('error'); setNote('Please tell us your name.'); return; }
    if (!f.contact_email.trim()) { setStatus('error'); setNote('Please add your email address — that is how we reply.'); return; }
    if (!f.contact_phone.trim()) { setStatus('error'); setNote('Please add a phone number so the team can call you.'); return; }
    if (!f.address.trim()) { setStatus('error'); setNote('Please add the property address.'); return; }
    if (!f.city.trim() || !f.state.trim()) { setStatus('error'); setNote('Please add the city and state.'); return; }

    setStatus('sending');
    try {
      const { data, error } = await supabase.functions.invoke('submit-landlord-property', {
        body: { ...f, is_furnished: furnished, photos: photos.map((p) => p.data) },
      });

      if (error) {
        const ctx = (error as any)?.context;
        const parsed = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json().catch(() => null) : null;
        setStatus('error');
        setNote(parsed?.error || 'We could not send that just now. Please email success@accessyourplace.com and we will take the details directly.');
        return;
      }
      if (data?.success) {
        setStatus('done');
        setNote(data.message || 'Got it. Someone from the team will review your property and call you.');
        // Photo failures are surfaced, not swallowed — the property is saved either way,
        // and the landlord should know if an image did not make it.
        if (Array.isArray(data.photo_problems) && data.photo_problems.length) setProblems(data.photo_problems);
        return;
      }
      setStatus('error');
      setNote(data?.error || 'We could not send that just now. Please email success@accessyourplace.com.');
    } catch {
      setStatus('error');
      setNote('We could not send that just now. Please email success@accessyourplace.com.');
    }
  }

  if (status === 'done') {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Thank you — we have your property</h1>
          <div role="status" aria-live="polite">
            <p className="mt-3 text-lg text-slate-800">{note}</p>
            {problems.length > 0 && (
              <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-amber-900">
                <p>Your property is saved, but some photos did not upload:</p>
                <ul className="mt-1 list-disc pl-5">
                  {problems.map((p) => <li key={p}>{p}</li>)}
                </ul>
                <p className="mt-1">You can reply to our email with those photos.</p>
              </div>
            )}
          </div>
          <p className="mt-4 text-slate-700">
            We look at every property and speak to every landlord before it goes to an operator.
          </p>
        </div>
      </main>
    );
  }

  const field = 'mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2';

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-slate-900">List your property with us</h1>
        <p className="mt-2 text-slate-700">
          Tell us about the property and we will review it and call you. No account needed.
          We vet every property and speak to every landlord before it goes in front of an operator.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="contact_name" className="block font-medium text-slate-900">Your name</label>
            <input id="contact_name" value={f.contact_name} onChange={set('contact_name')} required autoComplete="name" className={field} />
          </div>

          <div>
            <label htmlFor="contact_email" className="block font-medium text-slate-900">Email address</label>
            <p id="email-help" className="text-sm text-slate-600">We reply here.</p>
            <input id="contact_email" type="email" value={f.contact_email} onChange={set('contact_email')} required
              autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              aria-describedby="email-help" className={field} />
          </div>

          <div>
            <label htmlFor="contact_phone" className="block font-medium text-slate-900">Phone number</label>
            <p id="phone-help" className="text-sm text-slate-600">So the team can call you. We do not send text messages.</p>
            <input id="contact_phone" type="tel" value={f.contact_phone} onChange={set('contact_phone')} required
              autoComplete="tel" aria-describedby="phone-help" className={field} />
          </div>

          <div>
            <label htmlFor="address" className="block font-medium text-slate-900">Property address</label>
            <input id="address" value={f.address} onChange={set('address')} required autoComplete="street-address" className={field} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="city" className="block font-medium text-slate-900">City</label>
              <input id="city" value={f.city} onChange={set('city')} required className={field} />
            </div>
            <div>
              <label htmlFor="state" className="block font-medium text-slate-900">State</label>
              <input id="state" value={f.state} onChange={set('state')} required className={field} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="zip_code" className="block font-medium text-slate-900">
                ZIP <span className="font-normal text-slate-600">(optional)</span>
              </label>
              <input id="zip_code" value={f.zip_code} onChange={set('zip_code')} className={field} />
            </div>
            <div>
              <label htmlFor="property_type" className="block font-medium text-slate-900">
                Type <span className="font-normal text-slate-600">(optional)</span>
              </label>
              <input id="property_type" value={f.property_type} onChange={set('property_type')}
                placeholder="apartment, house, community" className={field} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label htmlFor="bedrooms" className="block font-medium text-slate-900">Beds</label>
              <input id="bedrooms" inputMode="numeric" value={f.bedrooms} onChange={set('bedrooms')} className={field} />
            </div>
            <div>
              <label htmlFor="bathrooms" className="block font-medium text-slate-900">Baths</label>
              <input id="bathrooms" inputMode="decimal" value={f.bathrooms} onChange={set('bathrooms')} className={field} />
            </div>
            <div>
              <label htmlFor="total_units" className="block font-medium text-slate-900">Units</label>
              <input id="total_units" inputMode="numeric" value={f.total_units} onChange={set('total_units')} className={field} />
            </div>
          </div>

          <div>
            <label htmlFor="monthly_rent" className="block font-medium text-slate-900">
              Asking rent per month <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input id="monthly_rent" inputMode="numeric" value={f.monthly_rent} onChange={set('monthly_rent')} className={field} />
          </div>

          <label htmlFor="furnished" className="flex min-h-[44px] items-center gap-3">
            <input id="furnished" type="checkbox" checked={furnished} onChange={(e) => setFurnished(e.target.checked)} className="h-5 w-5" />
            <span className="font-medium text-slate-900">The property is already furnished</span>
          </label>

          <div>
            <label htmlFor="photos" className="block font-medium text-slate-900">
              Photos <span className="font-normal text-slate-600">(optional, up to 12)</span>
            </label>
            <p id="photos-help" className="text-sm text-slate-600">
              PNG, JPEG or WebP. You can also send them later by replying to our email.
            </p>
            <input id="photos" type="file" accept="image/png,image/jpeg,image/webp" multiple
              onChange={onPhotos} aria-describedby="photos-help" className="mt-1 w-full min-h-[44px]" />
            <p role="status" aria-live="polite" className="text-sm text-slate-700">
              {photos.length > 0 ? `${photos.length} photo${photos.length === 1 ? '' : 's'} ready to send.` : ''}
            </p>
          </div>

          <div>
            <label htmlFor="notes" className="block font-medium text-slate-900">
              Anything we should know <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <textarea id="notes" rows={4} value={f.notes} onChange={set('notes')}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
          </div>

          <div aria-live="polite" role="status">
            {status === 'error' && note && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{note}</p>}
            {status === 'sending' && <p className="text-slate-600">Sending…</p>}
          </div>

          <button type="submit" disabled={status === 'sending'}
            className="w-full min-h-[44px] rounded-md bg-[#1a365d] px-4 py-3 font-medium text-white disabled:opacity-60">
            {status === 'sending' ? 'Sending…' : 'Send my property to the team'}
          </button>

          <p className="text-sm text-slate-600">
            Prefer email? Write to{' '}
            <a href="mailto:success@accessyourplace.com" className="underline underline-offset-2">success@accessyourplace.com</a>.
          </p>
        </form>
      </div>
    </main>
  );
}
