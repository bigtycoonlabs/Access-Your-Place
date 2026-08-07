import { useState } from 'react';
import { supabase } from '@/lib/supabase';

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

type Kind = 'need_property' | 'have_property' | 'live_operation_help' | 'sell_operation';

const DOORS: { kind: Kind; title: string; blurb: string }[] = [
  {
    kind: 'need_property',
    title: "I'm looking for a property to operate",
    blurb: 'You want a furnished rental opportunity. We find it, vet it, and negotiate the lease.',
  },
  {
    kind: 'have_property',
    title: 'I have a property to fill',
    blurb: "You're a landlord or manage a building and want reliable operators in your units.",
  },
  {
    kind: 'live_operation_help',
    title: 'I need help with a live operation right now',
    blurb: 'Something is going wrong in a unit you are already running. This goes to the team as urgent.',
  },
  {
    kind: 'sell_operation',
    title: 'I want to sell an operation I already run',
    blurb: 'You have units running and want to hand them to a new operator.',
  },
];

export default function StartPage() {
  const [kind, setKind] = useState<Kind | ''>('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [propertyAddress, setPropertyAddress] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [note, setNote] = useState('');

  const isEmergency = kind === 'live_operation_help';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setNote('');

    if (!kind) { setStatus('error'); setNote('Please choose what you need help with.'); return; }
    if (!name.trim()) { setStatus('error'); setNote('Please tell us your name.'); return; }
    // Email is required because it is the only channel that actually works: there is no
    // SMS on this platform, and Penny's reply, the sign-in link and the account
    // invitation all go by email. Phone is required because an acquisition manager rings
    // clients, and a lead with no number is one the team cannot work.
    if (!email.trim()) {
      setStatus('error');
      setNote('Please add your email address — that is how we reply and send your sign-in link.');
      return;
    }
    if (!phone.trim()) {
      setStatus('error');
      setNote('Please add a phone number so the team can call you.');
      return;
    }

    setStatus('sending');
    try {
      const { data, error } = await supabase.functions.invoke('capture-lead', {
        body: {
          kind, name, email, phone, city,
          property_address: propertyAddress,
          message,
          source: 'start_page',
        },
      });

      // Read the server's real reason instead of inventing a generic one.
      if (error) {
        const ctx = (error as any)?.context;
        const parsed = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json().catch(() => null) : null;
        setStatus('error');
        setNote(parsed?.error || 'We could not send that just now. Please email success@accessyourplace.com and we will pick it up.');
        return;
      }
      if (data?.success) {
        setStatus('done');
        setNote(data.message || 'Got it. Someone from the team will be in touch.');
        return;
      }
      setStatus('error');
      setNote(data?.error || 'We could not send that just now. Please email success@accessyourplace.com and we will pick it up.');
    } catch {
      setStatus('error');
      setNote('We could not send that just now. Please email success@accessyourplace.com and we will pick it up.');
    }
  }

  if (status === 'done') {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-xl rounded-xl border border-slate-200 bg-white p-6">
          <h1 className="text-2xl font-semibold text-slate-900">Thank you — we have it</h1>
          <p role="status" aria-live="polite" className="mt-3 text-lg text-slate-800">{note}</p>
          <p className="mt-4 text-slate-700">
            If you need us sooner, email{' '}
            <a href="mailto:success@accessyourplace.com" className="underline underline-offset-2">
              success@accessyourplace.com
            </a>.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-xl">
        <h1 className="text-2xl font-semibold text-slate-900">Let's get you to the right person</h1>
        <p className="mt-2 text-slate-700">
          Tell us what you need and how to reach you. That's all we need to start — no account required. We reply by email, and someone from the team may call.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-6">
          <fieldset className="space-y-2">
            <legend className="text-base font-medium text-slate-900">What do you need?</legend>
            {DOORS.map((d) => (
              <label
                key={d.kind}
                htmlFor={d.kind}
                className="flex min-h-[44px] cursor-pointer gap-3 rounded-lg border border-slate-300 bg-white p-3 hover:border-slate-500"
              >
                <input
                  type="radio"
                  id={d.kind}
                  name="kind"
                  value={d.kind}
                  checked={kind === d.kind}
                  onChange={() => setKind(d.kind)}
                  className="mt-1 h-5 w-5 shrink-0"
                />
                <span>
                  <span className="block font-medium text-slate-900">{d.title}</span>
                  <span className="block text-sm text-slate-600">{d.blurb}</span>
                </span>
              </label>
            ))}
          </fieldset>

          {isEmergency && (
            <p role="status" aria-live="polite" className="rounded-md bg-amber-50 px-3 py-2 text-amber-900">
              This will be flagged as urgent and sent to the team straight away.
            </p>
          )}

          <div>
            <label htmlFor="name" className="block font-medium text-slate-900">Your name</label>
            <input
              id="name" type="text" value={name} onChange={(e) => setName(e.target.value)}
              autoComplete="name" required
              className="mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="email" className="block font-medium text-slate-900">Email address</label>
            <p id="email-help" className="text-sm text-slate-600">We reply here and send your sign-in link to this address.</p>
            <input
              id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
              required aria-describedby="email-help"
              className="mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block font-medium text-slate-900">Phone number</label>
            <p id="phone-help" className="text-sm text-slate-600">So someone from the team can call you. We do not send text messages.</p>
            <input
              id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel" required aria-describedby="phone-help"
              className="mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="city" className="block font-medium text-slate-900">
              City or market <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <input
              id="city" type="text" value={city} onChange={(e) => setCity(e.target.value)}
              className="mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          {(kind === 'have_property' || kind === 'live_operation_help' || kind === 'sell_operation') && (
            <div>
              <label htmlFor="property" className="block font-medium text-slate-900">
                Property address <span className="font-normal text-slate-600">(optional)</span>
              </label>
              <input
                id="property" type="text" value={propertyAddress}
                onChange={(e) => setPropertyAddress(e.target.value)}
                className="mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2"
              />
            </div>
          )}

          <div>
            <label htmlFor="message" className="block font-medium text-slate-900">
              Anything you want us to know <span className="font-normal text-slate-600">(optional)</span>
            </label>
            <textarea
              id="message" rows={4} value={message} onChange={(e) => setMessage(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
            />
          </div>

          {/* Errors are announced, not just coloured. */}
          <div aria-live="polite" role="status">
            {status === 'error' && note && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{note}</p>
            )}
            {status === 'sending' && <p className="text-slate-600">Sending…</p>}
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full min-h-[44px] rounded-md bg-[#1a365d] px-4 py-3 font-medium text-white disabled:opacity-60"
          >
            {status === 'sending' ? 'Sending…' : 'Send this to the team'}
          </button>

          <p className="text-sm text-slate-600">
            Prefer email? Write to{' '}
            <a href="mailto:success@accessyourplace.com" className="underline underline-offset-2">
              success@accessyourplace.com
            </a>.
          </p>
        </form>
      </div>
    </main>
  );
}
