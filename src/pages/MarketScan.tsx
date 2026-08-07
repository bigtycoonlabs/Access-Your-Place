import { useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * /market-scan — free market research, open to anyone.
 *
 * NAMING: this is NOT Property Forge. Property Forge / LeadForge is the owner's existing
 * lead-generation system (StaffLeadForge, InvestorLeadForge, admin/LeadForge, the
 * leadforge and apollo-leadforge functions) where an operator sources their own deals.
 * This page is the market research scan and is named for what it is.
 *
 * The flow is deliberately two steps, because Penny asks before she answers:
 *
 *   1. person enters a market
 *   2. Penny asks WHICH scan - short-term, shared living, mid-term, or all three
 *   3. only then does she calculate
 *
 * That is not interface polish. These are three different businesses in the same
 * building, using different data and sometimes different tax treatment. And a wall of
 * figures becomes a wall of speech in a screen reader.
 *
 * NOTHING HERE IS AN ACCESS YOUR PLACE VERIFIED DEAL. A scan is Penny's research; nobody
 * has spoken to the landlord. The disclosure comes from the server so the wording cannot
 * drift, and the free verification call is offered as an option rather than a warning.
 */

type Choice = { value: string; label: string; blurb: string };

export default function MarketScan() {
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [rooms, setRooms] = useState('');
  const [choices, setChoices] = useState<Choice[]>([]);
  const [question, setQuestion] = useState('');
  const [scan, setScan] = useState('');
  const [result, setResult] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // call-request state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [callSent, setCallSent] = useState(false);
  const [callError, setCallError] = useState('');

  async function readErr(e: any, fallback: string) {
    const ctx = e?.context;
    const parsed = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json().catch(() => null) : null;
    return parsed?.error || fallback;
  }

  async function askPenny(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setResult(null); setChoices([]); setScan('');
    if (!city.trim() || !state.trim()) { setError('Please enter a city and state.'); return; }
    setBusy(true);
    try {
      const { data, error: err } = await supabase.functions.invoke('penny-market-scan', {
        body: { city, state },
      });
      if (err) { setError(await readErr(err, 'Could not reach Penny just now. Please try again.')); return; }
      if (data?.needs_choice) {
        setQuestion(data.question || '');
        setChoices(data.options || []);
      } else if (data?.success) {
        setResult(data);
      } else {
        setError(data?.error || 'Could not run that just now.');
      }
    } catch {
      setError('Could not reach Penny just now. Please try again.');
    } finally { setBusy(false); }
  }

  async function runScan(kind: string) {
    setScan(kind); setError(''); setResult(null); setBusy(true);
    try {
      const { data, error: err } = await supabase.functions.invoke('penny-market-scan', {
        body: { city, state, scan_type: kind, rooms: rooms ? Number(rooms) : null },
      });
      if (err) { setError(await readErr(err, 'Could not run that scan just now.')); return; }
      setResult(data);
    } catch {
      setError('Could not run that scan just now.');
    } finally { setBusy(false); }
  }

  async function requestCall(e: React.FormEvent) {
    e.preventDefault();
    setCallError('');
    if (!name.trim()) { setCallError('Please tell us your name.'); return; }
    if (!email.trim()) { setCallError('Please add your email address — that is how we reply.'); return; }
    if (!phone.trim()) { setCallError('Please add a phone number so the team can call you.'); return; }
    setBusy(true);
    try {
      const { data, error: err } = await supabase.functions.invoke('capture-lead', {
        body: {
          kind: 'verify_scan', name, email, phone, city,
          message: `Asked for verification of a ${scan || 'market'} scan in ${city}, ${state}.`,
          source: 'market_scan',
        },
      });
      if (err) { setCallError(await readErr(err, 'Could not send that just now. Email success@accessyourplace.com.')); return; }
      if (data?.success) setCallSent(true);
      else setCallError(data?.error || 'Could not send that just now.');
    } catch {
      setCallError('Could not send that just now. Email success@accessyourplace.com.');
    } finally { setBusy(false); }
  }

  const money = (n: unknown) =>
    typeof n === 'number' ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' }) : String(n ?? '');

  const field = 'mt-1 w-full min-h-[44px] rounded-md border border-slate-300 px-3 py-2';

  function Strategy({ id, title, data }: { id: string; title: string; data: any }) {
    if (!data) return null;
    if (!data.scored) {
      // A refusal is a real answer and is shown as one, not hidden.
      return (
        <section aria-labelledby={`${id}-h`} className="rounded-lg border border-slate-200 bg-white p-4">
          <h3 id={`${id}-h`} className="font-semibold text-slate-900">{title}</h3>
          <p className="mt-1 text-slate-700">{data.reason || 'Not enough research yet.'}</p>
          {Array.isArray(data.missing) && data.missing.length > 0 && (
            <>
              <p className="mt-2 text-slate-700">Still needed for this market:</p>
              <ul className="mt-1 list-disc pl-5 text-slate-700">
                {data.missing.map((m: string) => <li key={m}>{m}</li>)}
              </ul>
            </>
          )}
        </section>
      );
    }
    return (
      <section aria-labelledby={`${id}-h`} className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 id={`${id}-h`} className="font-semibold text-slate-900">{title}</h3>
        {id === 'str' && (
          <p className="mt-1 text-slate-800">
            Score {data.score} out of 100. Blended rate {money(data.blended_adr)} a night at{' '}
            {data.blended_occupancy_pct}% occupancy, which works out around{' '}
            {money(data.projected_monthly_revenue)} a month.
          </p>
        )}
        {id === 'mtr' && (
          <>
            <p className="mt-1 text-slate-800">
              {money(data.monthly_rate)} a month at {data.occupancy_pct}% occupancy, around{' '}
              {money(data.projected_monthly_revenue)} a month.
            </p>
            {data.tax_note && <p className="mt-2 text-slate-700">{data.tax_note}</p>}
          </>
        )}
        {id === 'shared_living' && data.house_monthly_gross && (
          <>
            <p className="mt-1 text-slate-800">
              Across {data.rooms} rooms, per month: {money(data.house_monthly_gross.budget)} at the budget end,{' '}
              {money(data.house_monthly_gross.median)} median, {money(data.house_monthly_gross.luxury)} if the
              rooms are set up well.
            </p>
            <p className="mt-2 text-slate-700">
              That spread is what you earn by putting more into each room.
            </p>
          </>
        )}
        {data.source && <p className="mt-2 text-sm text-slate-600">Source: {data.source}</p>}
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-slate-900">Market scan</h1>
        <p className="mt-2 text-slate-700">
          Free market research. Tell us where you are looking and Penny will run the numbers
          on real market data — hotel occupancy, lodging tax collections, travel demand,
          seasonality and local regulation.
        </p>

        <form onSubmit={askPenny} className="mt-6 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="city" className="block font-medium text-slate-900">City</label>
              <input id="city" value={city} onChange={(e) => setCity(e.target.value)} required
                autoCapitalize="words" className={field} />
            </div>
            <div>
              <label htmlFor="state" className="block font-medium text-slate-900">State</label>
              <input id="state" value={state} onChange={(e) => setState(e.target.value)} required
                placeholder="TX" autoCapitalize="characters" autoCorrect="off" className={field} />
            </div>
          </div>
          <button type="submit" disabled={busy}
            className="w-full min-h-[44px] rounded-md bg-[#1a365d] px-4 py-3 font-medium text-white disabled:opacity-60">
            {busy ? 'Working…' : 'Look at this market'}
          </button>
        </form>

        <div aria-live="polite" role="status" className="mt-4">
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{error}</p>}
        </div>

        {/* Penny asks which scan, rather than answering everything at once. */}
        {choices.length > 0 && !result && (
          <section aria-labelledby="choice-h" className="mt-6">
            <h2 id="choice-h" className="text-lg font-semibold text-slate-900">{question}</h2>
            <div className="mt-3 space-y-2">
              {choices.map((c) => (
                <button key={c.value} type="button" onClick={() => runScan(c.value)} disabled={busy}
                  className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white p-3 text-left hover:border-slate-500 disabled:opacity-60">
                  <span className="block font-medium text-slate-900">{c.label}</span>
                  <span className="block text-sm text-slate-600">{c.blurb}</span>
                </button>
              ))}
            </div>
            <div className="mt-3">
              <label htmlFor="rooms" className="block font-medium text-slate-900">
                Bedrooms <span className="font-normal text-slate-600">(optional, helps the shared living figures)</span>
              </label>
              <input id="rooms" inputMode="numeric" value={rooms} onChange={(e) => setRooms(e.target.value)}
                className={field} />
            </div>
          </section>
        )}

        {result && (
          <section aria-labelledby="results-h" className="mt-6 space-y-4">
            <h2 id="results-h" className="text-lg font-semibold text-slate-900">
              {result.market}
            </h2>

            {result.scored === false && result.reason && (
              <p className="rounded-md bg-amber-50 px-3 py-3 text-amber-900">{result.reason}</p>
            )}

            <Strategy id="str" title="Short-term rental" data={result.results?.str} />
            <Strategy id="shared_living" title="Shared living" data={result.results?.shared_living} />
            <Strategy id="mtr" title="Mid-term rental" data={result.results?.mtr} />

            {/* Server-supplied wording, so it cannot drift screen to screen. */}
            {result.disclosure?.body && (
              <div className="rounded-lg border border-slate-300 bg-white p-4">
                <h3 className="font-semibold text-slate-900">{result.disclosure.label}</h3>
                <p className="mt-1 text-slate-700">{result.disclosure.body}</p>
              </div>
            )}

            {result.offer_call && !callSent && (
              <form onSubmit={requestCall} className="rounded-lg border border-slate-300 bg-white p-4 space-y-3">
                <h3 className="font-semibold text-slate-900">
                  {result.call_cta || 'Book a free call with an acquisition manager'}
                </h3>
                <div>
                  <label htmlFor="cname" className="block font-medium text-slate-900">Your name</label>
                  <input id="cname" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className={field} />
                </div>
                <div>
                  <label htmlFor="cemail" className="block font-medium text-slate-900">Email address</label>
                  <input id="cemail" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} className={field} />
                </div>
                <div>
                  <label htmlFor="cphone" className="block font-medium text-slate-900">Phone number</label>
                  <p id="cphone-help" className="text-sm text-slate-600">We do not send text messages.</p>
                  <input id="cphone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel" aria-describedby="cphone-help" className={field} />
                </div>
                <div aria-live="polite" role="status">
                  {callError && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{callError}</p>}
                </div>
                <button type="submit" disabled={busy}
                  className="w-full min-h-[44px] rounded-md bg-[#d4a574] px-4 py-3 font-medium text-[#1a365d] disabled:opacity-60">
                  {busy ? 'Sending…' : 'Request the call'}
                </button>
              </form>
            )}

            {callSent && (
              <p role="status" aria-live="polite" className="rounded-md bg-green-50 px-3 py-3 text-green-900">
                Got it. An acquisition manager will be in touch to arrange a time. There is no charge for this.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
