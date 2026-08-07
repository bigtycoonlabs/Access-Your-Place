import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * /staff/research-review — the acquisition manager checks Penny's work and confirms it.
 *
 * This is the human step the whole scoring system is built around. Penny drafts research
 * with a source for every figure; the AM reads each figure against its source and
 * confirms the ones that hold up.
 *
 * DELIBERATELY ONE FIELD AT A TIME. There is no "confirm all" button, and that is not an
 * oversight. A single button is how somebody rubber-stamps six numbers they checked two
 * of, and a confirmed figure is what turns a Penny scan into an Access Your Place number
 * a client will act on.
 *
 * Nothing here can create a score by itself. Confirming writes the value into the scored
 * column; the scorer still refuses until every required input is present, and still
 * refuses outright if regulation says prohibited.
 */

type Draft = Record<string, { value: unknown; source?: string }>;
type Research = {
  id: string;
  city: string;
  state: string;
  penny_draft: Draft;
  confirmed_fields: string[];
  confirmed_by: string | null;
};

const LABELS: Record<string, string> = {
  hotel_occupancy_pct: 'Hotel occupancy',
  hotel_adr: 'Hotel average daily rate',
  lodging_tax_revenue: 'Lodging tax collections',
  lodging_tax_yoy_pct: 'Lodging tax, year on year',
  regulation_status: 'Regulation status',
  travel_demand_note: 'Travel demand',
  peak_months: 'Peak season',
  slow_months: 'Slow season',
  traffic_spike_areas: 'Where traffic spikes',
  direct_booking_competitors: 'Direct booking competitors',
  submarket: 'Submarket',
};

export default function ResearchReview() {
  const [rows, setRows] = useState<Research[]>([]);
  const [active, setActive] = useState<Research | null>(null);
  const [busyField, setBusyField] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const staffId = (() => {
    try { return JSON.parse(localStorage.getItem('staffSession') || '{}')?.id || ''; }
    catch { return ''; }
  })();

  useEffect(() => {
    (async () => {
      const { data, error: err } = await supabase
        .from('deal_research')
        .select('id,city,state,penny_draft,confirmed_fields,confirmed_by')
        .order('created_at', { ascending: false })
        .limit(50);
      if (err) setError('Could not load research. Please refresh.');
      else setRows((data as Research[]) || []);
      setLoading(false);
    })();
  }, []);

  async function confirmField(field: string) {
    if (!active) return;
    if (!staffId) {
      setError('Your session is not sending an account id, so a confirmation cannot be recorded against you. Sign out and back in.');
      return;
    }
    setBusyField(field); setError(''); setNote('');
    try {
      // NOT a direct rpc call. confirm_research_field is SECURITY DEFINER and takes a
      // staff id, so it is revoked from anon and PUBLIC - otherwise anyone with the
      // publishable key could confirm research in someone else's name. This edge function
      // verifies the staff member server-side first.
      const { data, error: err } = await supabase.functions.invoke('staff-confirm-research', {
        body: { staff_id: staffId, research_id: active.id, field },
      });
      if (err) {
        const ctx = (err as any)?.context;
        const parsed = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json().catch(() => null) : null;
        setError(parsed?.error || 'Could not confirm that field.');
        return;
      }
      if ((data as any)?.ok) {
        setNote(`${LABELS[field] || field} confirmed.`);
        setActive({ ...active, confirmed_fields: [...(active.confirmed_fields || []), field] });
      } else {
        // The server's actual reason, not a generic failure.
        setError((data as any)?.error || 'Could not confirm that field.');
      }
    } catch {
      setError('Could not confirm that field.');
    } finally { setBusyField(''); }
  }

  const show = (v: unknown) => Array.isArray(v) ? v.join(', ') : String(v ?? '');

  if (loading) return <main className="p-8"><p role="status" aria-live="polite">Loading research…</p></main>;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8">
      <div className="mx-auto max-w-3xl">
        <h1 className="text-2xl font-semibold text-slate-900">Research review</h1>
        <p className="mt-2 text-slate-700">
          Penny drafts the research. You check each figure against its source and confirm the
          ones that hold up. Only confirmed figures count towards a score.
        </p>

        <div aria-live="polite" role="status" className="mt-3">
          {note && <p className="rounded-md bg-green-50 px-3 py-2 text-green-900">{note}</p>}
          {error && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">{error}</p>}
        </div>

        {!active && (
          <section aria-labelledby="markets-h" className="mt-6">
            <h2 id="markets-h" className="text-lg font-semibold text-slate-900">Markets</h2>
            {rows.length === 0 ? (
              <p className="mt-2 text-slate-700">
                No research packs yet. Penny builds one when a market is scanned.
              </p>
            ) : (
              <ul className="mt-2 space-y-2">
                {rows.map((r) => {
                  const drafted = Object.keys(r.penny_draft || {}).length;
                  const done = (r.confirmed_fields || []).length;
                  return (
                    <li key={r.id}>
                      <button type="button" onClick={() => setActive(r)}
                        className="block w-full min-h-[44px] rounded-lg border border-slate-300 bg-white p-3 text-left hover:border-slate-500">
                        <span className="block font-medium text-slate-900">{r.city}, {r.state}</span>
                        <span className="block text-sm text-slate-600">
                          {done} of {drafted} figures confirmed
                          {r.confirmed_by ? '' : ' — nothing confirmed yet'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}

        {active && (
          <section aria-labelledby="review-h" className="mt-6">
            <button type="button" onClick={() => { setActive(null); setNote(''); setError(''); }}
              className="min-h-[44px] text-[#1a365d] underline underline-offset-2">
              Back to all markets
            </button>

            <h2 id="review-h" className="mt-3 text-lg font-semibold text-slate-900">
              {active.city}, {active.state}
            </h2>

            {Object.keys(active.penny_draft || {}).length === 0 ? (
              <p className="mt-2 text-slate-700">
                Penny has not drafted anything for this market yet. She only records figures she
                can source, so if this is empty it means the approved sources for this market
                have not been added.
              </p>
            ) : (
              <ul className="mt-4 space-y-3">
                {Object.entries(active.penny_draft).map(([field, entry]) => {
                  const confirmed = (active.confirmed_fields || []).includes(field);
                  return (
                    <li key={field} className="rounded-lg border border-slate-300 bg-white p-4">
                      <h3 className="font-medium text-slate-900">{LABELS[field] || field}</h3>
                      <p className="mt-1 text-lg text-slate-900">{show(entry?.value)}</p>
                      {entry?.source && (
                        <p className="mt-1 text-sm text-slate-600">Source: {entry.source}</p>
                      )}
                      {confirmed ? (
                        <p className="mt-2 font-medium text-green-800">Confirmed</p>
                      ) : (
                        <button type="button" onClick={() => confirmField(field)} disabled={busyField === field}
                          className="mt-2 min-h-[44px] rounded-md bg-[#1a365d] px-4 py-2 font-medium text-white disabled:opacity-60">
                          {busyField === field ? 'Confirming…' : `Confirm ${LABELS[field] || field}`}
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <p className="mt-4 text-sm text-slate-600">
              Confirm each figure separately, after checking it against its source. There is no
              confirm-all on purpose — a confirmed number is one a client will act on.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
