import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { trackEvent } from '@/lib/analytics';

// One accessible form for the company site. It goes to the same place as the start form:
// the success inbox and the staff "New submissions" screen.

export type FormField = { key: string; label: string; type?: 'text' | 'textarea' | 'select' | 'date'; options?: string[]; required?: boolean; help?: string };

const input = 'mt-1 w-full min-h-[44px] rounded-md border border-white/25 bg-white/5 px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#d4a574]';

export default function CompanyForm({ kind, idPrefix, fields, submitLabel, phoneLabel }: {
  kind: 'career_interest' | 'press_inquiry'; idPrefix: string; fields: FormField[]; submitLabel: string; phoneLabel: string;
}) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [note, setNote] = useState('');
  const id = (k: string) => `${idPrefix}-${k}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const fail = (m: string) => { setStatus('error'); setNote(m); };
    if (!name.trim()) return fail('Please tell us your name.');
    if (!email.trim()) return fail('Please add your email address so we can reply.');
    for (const f of fields) if (f.required && !String(values[f.key] || '').trim()) return fail(`Please answer: ${f.label}.`);
    setStatus('sending'); setNote('');
    const details: Record<string, string> = {};
    for (const f of fields) if (values[f.key]?.trim()) details[f.key] = values[f.key].trim();
    try {
      const { data, error } = await supabase.functions.invoke('capture-lead', {
        body: { kind, name, email, phone, message, details, source: 'company_site' },
      });
      if (error || !data?.success) {
        const ctx = (error as any)?.context;
        const parsed = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json().catch(() => null) : null;
        return fail(parsed?.error || data?.error || 'That did not send. Please email success@accessyourplace.com and we will pick it up.');
      }
      trackEvent(kind === 'press_inquiry' ? 'press_request_sent' : 'career_interest_sent', { type: details.media_type || details.interest || '' });
      setStatus('done');
      setNote('Thank you. It is with the team, and we have sent you a confirmation email.');
    } catch {
      fail('That did not send. Please email success@accessyourplace.com and we will pick it up.');
    }
  }

  if (status === 'done') {
    return <p role="status" aria-live="polite" className="rounded-lg bg-white/10 p-5 text-lg">{note}</p>;
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-5 max-w-2xl">
      <div>
        <label htmlFor={id('name')} className="block font-medium">Your name</label>
        <input id={id('name')} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required aria-required="true" className={input} />
      </div>
      <div>
        <label htmlFor={id('email')} className="block font-medium">Email address</label>
        <input id={id('email')} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} required aria-required="true" className={input} />
      </div>
      <div>
        <label htmlFor={id('phone')} className="block font-medium">{phoneLabel} <span className="font-normal text-white/60">(optional)</span></label>
        <input id={id('phone')} type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" className={input} />
      </div>
      {fields.map((f) => {
        const v = values[f.key] || '';
        const set = (x: string) => setValues((o) => ({ ...o, [f.key]: x }));
        const helpId = f.help ? id(`${f.key}-help`) : undefined;
        return (
          <div key={f.key}>
            <label htmlFor={id(f.key)} className="block font-medium">
              {f.label}{!f.required && <span className="font-normal text-white/60"> (optional)</span>}
            </label>
            {f.help && <p id={helpId} className="text-sm text-white/65">{f.help}</p>}
            {f.type === 'select' ? (
              <select id={id(f.key)} value={v} onChange={(e) => set(e.target.value)} required={f.required} aria-required={f.required} aria-describedby={helpId} className={input}>
                <option value="" className="text-black">Choose one</option>
                {f.options!.map((o) => <option key={o} value={o} className="text-black">{o}</option>)}
              </select>
            ) : f.type === 'textarea' ? (
              <textarea id={id(f.key)} rows={4} value={v} onChange={(e) => set(e.target.value)} required={f.required} aria-required={f.required} aria-describedby={helpId} className={input} />
            ) : (
              <input id={id(f.key)} type={f.type === 'date' ? 'date' : 'text'} value={v} onChange={(e) => set(e.target.value)} required={f.required} aria-required={f.required} aria-describedby={helpId} className={input} />
            )}
          </div>
        );
      })}
      <div>
        <label htmlFor={id('message')} className="block font-medium">Anything else <span className="font-normal text-white/60">(optional)</span></label>
        <textarea id={id('message')} rows={4} value={message} onChange={(e) => setMessage(e.target.value)} className={input} />
      </div>
      <div role="status" aria-live="polite">
        {status === 'error' && <p className="rounded-md bg-red-900/40 px-3 py-2 text-red-100">{note}</p>}
        {status === 'sending' && <p>Sending.</p>}
      </div>
      <button type="submit" disabled={status === 'sending'} className="min-h-[44px] rounded-md bg-[#d4a574] px-6 py-3 font-semibold text-[#0a0f1a] hover:bg-[#c49464] disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-white">
        {status === 'sending' ? 'Sending…' : submitLabel}
      </button>
    </form>
  );
}
