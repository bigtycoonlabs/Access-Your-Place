import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PennyStaffChat } from '@/components/staff/PennyStaffChat';

/**
 * Success Team — operations console.
 *
 * WHAT MY FIRST ATTEMPT GOT WRONG
 *
 * I read "the dashboard is messy" as "show less" and built something minimal. The
 * correction was right: the answer is not fewer features, it is the SAME information
 * ORGANISED. A marketplace operator needs the whole operation at once — they just should
 * not have to assemble it in their head from twenty-one unrelated cards.
 *
 * ORGANISED BY HOW THE BUSINESS RUNS, not by the order features were built:
 *
 *   DEMAND    people who want a deal
 *   SUPPLY    the constraint — listings, landlord submissions, unassigned landlords
 *   RESALE    the third-party sale pipeline
 *   CLIENTS   who is on the platform and what they hold
 *   CONTENT   the only thing that reaches strangers
 *   TEAM      the Success Team
 *
 * Every number is live, and every number is a BUTTON that asks Penny about it. A count says
 * there are four inquiries; she says which one to call. That is the difference between a
 * dashboard and an operations console.
 *
 * ACCESSIBILITY: one section per area with a real heading, so a screen reader user can jump
 * between areas instead of walking a grid. Each tile is read as one phrase — "4 open
 * inquiries, needs attention" — never as a bare number. Anything needing attention says so
 * in WORDS as well as colour.
 */

type StaffLite = {
  id: string; name?: string; first_name?: string; email?: string;
  role?: string; team?: string; is_owner?: boolean;
};

type Snapshot = {
  book: Record<string, number>;
  demand: Record<string, number>; supply: Record<string, number>;
  resale: Record<string, number>; clients: Record<string, number>;
  content: Record<string, number>; team: Record<string, number>;
};

type Metric = { label: string; value: number; ask: string; alert?: boolean };

function Area({
  title, metrics, onAsk,
}: { title: string; metrics: Metric[]; onAsk: (q: string) => void }) {
  const id = `area-${title.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <section aria-labelledby={id} className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 id={id} className="text-sm font-semibold uppercase tracking-wide text-slate-500">{title}</h2>
      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {metrics.map((m) => (
          <li key={m.label}>
            <button
              type="button"
              onClick={() => onAsk(m.ask)}
              className={`min-h-[44px] w-full rounded-md border px-3 py-2 text-left ${
                m.alert ? 'border-amber-300 bg-amber-50 hover:border-amber-500'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-400'}`}
            >
              {/* Read as one phrase, and "needs attention" is WORDS, not just a colour. */}
              <span className="sr-only">
                {m.value} {m.label}{m.alert ? ', needs attention' : ''}. Ask Penny.
              </span>
              <span aria-hidden="true" className="block text-xl font-semibold text-slate-900">{m.value}</span>
              <span aria-hidden="true" className="block text-xs leading-tight text-slate-600">{m.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function StaffHome({ staffSession }: { staffSession: StaffLite | null }) {
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [headline, setHeadline] = useState('Checking where things stand…');
  const [queue, setQueue] = useState<any[]>([]);
  const [urgent, setUrgent] = useState(false);
  const [ask, setAsk] = useState('');
  const first = staffSession?.first_name || (staffSession?.name || '').split(' ')[0] || 'there';

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('penny-staff-brief', {
          body: { staff_id: staffSession?.id },
        });
        if (dead) return;
        if (error || !data?.success) {
          setHeadline('Could not load the operating picture. Ask Penny below — she reads it directly.');
          return;
        }
        setSnap(data.operations || null);
        const items = data.attention?.items || [];
        // Ordered worst-first so the DOM order IS the priority order — which is the order
        // a screen reader speaks it.
        const rank: Record<string, number> = { emergency: 0, high: 1, normal: 2, low: 3 };
        setQueue([...items].sort((a: any, b: any) => (rank[a.severity] ?? 9) - (rank[b.severity] ?? 9)));
        const em = items.filter((i: any) => i.severity === 'emergency');
        const hi = items.filter((i: any) => i.severity === 'high');
        setUrgent(em.length > 0);
        setHeadline(
          em.length ? em[0].what
          : hi.length ? hi[0].what
          : items.length ? `${items.length} thing${items.length === 1 ? '' : 's'} need you today. Nothing urgent.`
          : 'Nothing is waiting on you right now.',
        );
      } catch {
        if (!dead) setHeadline('Could not load the operating picture. Ask Penny below.');
      }
    })();
    return () => { dead = true; };
  }, [staffSession?.id]);

  const n = (o: Record<string, number> | undefined, k: string) => (o?.[k] ?? 0);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-4 py-6 xl:pr-[412px]">
      <header className="mb-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Success Team — Operations</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">{first}</h1>
        <p role="status" aria-live="polite"
           className={`mt-2 text-lg leading-relaxed ${urgent ? 'font-semibold text-red-700' : 'text-slate-700'}`}>
          {headline}
        </p>
      </header>

      {/* THE WORK QUEUE — everything that needs somebody, worst first.
          The headline names the top item; this is the rest, because an operator running a
          marketplace needs the whole list, not a teaser of it. Each row says WHAT and HOW
          LONG, and hands off to Penny for the detail and the action. */}
      {queue.length > 0 && (
        <section aria-labelledby="queue-heading" className="mb-5 rounded-lg border border-slate-300 bg-white">
          <h2 id="queue-heading" className="border-b border-slate-200 px-4 py-2 text-sm font-semibold uppercase tracking-wide text-slate-600">
            Needs someone — {queue.length} {queue.length === 1 ? 'item' : 'items'}
          </h2>
          <ul>
            {queue.map((item, i) => (
              <li key={i} className="border-b border-slate-100 last:border-0">
                <button
                  type="button"
                  onClick={() => setAsk(
                    item.who ? `Tell me about ${item.who} and what I should do next.`
                             : `Tell me more about this: ${item.what}`,
                  )}
                  className="flex min-h-[44px] w-full items-start gap-3 px-4 py-3 text-left hover:bg-slate-50"
                >
                  {/* Severity is WORDS, not a colour. Colour alone carries nothing here. */}
                  <span className={`mt-0.5 shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                    item.severity === 'emergency' ? 'bg-red-100 text-red-800'
                    : item.severity === 'high' ? 'bg-amber-100 text-amber-900'
                    : 'bg-slate-100 text-slate-700'}`}>
                    {item.severity === 'emergency' ? 'Emergency'
                     : item.severity === 'high' ? 'Urgent' : 'Waiting'}
                  </span>
                  <span className="flex-1 text-sm leading-relaxed text-slate-800">
                    {item.what}
                    {item.contact && (
                      <span className="mt-0.5 block font-medium text-slate-900">
                        Reach them on {item.contact}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}


      {/* THE BOOK FIRST — full width, because it IS the business.
          The console used to lead with "34 accounts" while five years of work sat in a
          475-relationship book. That framing makes a real company look like it has no
          customers, and points the Success Team at the wrong job: not "we have 34
          accounts" but "461 people we already know are not on the platform yet". */}
      <section aria-labelledby="book-heading" className="mt-5 rounded-lg border border-slate-300 bg-white p-4">
        <h2 id="book-heading" className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          The book — five years of relationships
        </h2>
        <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'relationships', value: n(snap?.book,'relationships'), ask: 'Give me an overview of our client book.' },
            { label: 'clients', value: n(snap?.book,'clients'), ask: 'Show me our clients and where each one stands.' },
            { label: 'landlords', value: n(snap?.book,'landlords'), ask: 'Show me the landlords in our book.' },
            { label: 'on the platform', value: n(snap?.book,'on_platform'), ask: 'Which of our people are on the platform?' },
            { label: 'not on it yet', value: n(snap?.book,'off_platform'), ask: 'Who should I contact today to get them onto the platform?', alert: n(snap?.book,'off_platform') > 0 },
            { label: 'nobody assigned', value: n(snap?.book,'unassigned'), ask: 'Which relationships have nobody assigned to them?', alert: n(snap?.book,'unassigned') > 0 },
          ].map((m) => (
            <li key={m.label}>
              <button type="button" onClick={() => setAsk(m.ask)}
                className={`min-h-[44px] w-full rounded-md border px-3 py-2 text-left ${
                  m.alert ? 'border-amber-300 bg-amber-50 hover:border-amber-500'
                          : 'border-slate-200 bg-slate-50 hover:border-slate-400'}`}>
                <span className="sr-only">{m.value} {m.label}{m.alert ? ', needs attention' : ''}. Ask Penny.</span>
                <span aria-hidden="true" className="block text-xl font-semibold text-slate-900">{m.value}</span>
                <span aria-hidden="true" className="block text-xs leading-tight text-slate-600">{m.label}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3">
          <button type="button"
            onClick={() => setAsk('Who should I contact today, and why each one?')}
            className="min-h-[44px] rounded-md bg-[#1a365d] px-4 text-sm font-medium text-white">
            Who should I contact today?
          </button>
        </p>
      </section>

      <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Area title="Demand" onAsk={setAsk} metrics={[
          { label: 'new leads', value: n(snap?.demand,'new_leads'), ask: 'What leads came in and who should I call first?', alert: n(snap?.demand,'new_leads') > 0 },
          { label: 'emergencies', value: n(snap?.demand,'emergencies'), ask: 'Show me the live operation emergencies.', alert: n(snap?.demand,'emergencies') > 0 },
          { label: 'open inquiries', value: n(snap?.demand,'open_inquiries'), ask: 'Show me the open buyer inquiries.', alert: n(snap?.demand,'open_inquiries') > 0 },
          { label: 'being worked', value: n(snap?.demand,'leads_working'), ask: 'Which leads are being worked right now?' },
        ]} />

        <Area title="Supply" onAsk={setAsk} metrics={[
          { label: 'live listings', value: n(snap?.supply,'live_listings'), ask: "What's on the marketplace right now?" },
          { label: 'no price set', value: n(snap?.supply,'no_price'), ask: 'Which live listings have no acquisition cost recorded?', alert: n(snap?.supply,'no_price') > 0 },
          { label: 'pending review', value: n(snap?.supply,'pending_review'), ask: 'Which properties are waiting for review?', alert: n(snap?.supply,'pending_review') > 0 },
          { label: 'landlord submissions', value: n(snap?.supply,'landlord_submissions'), ask: 'What has come in through the landlord portal?', alert: n(snap?.supply,'landlord_submissions') > 0 },
          { label: 'landlords unassigned', value: n(snap?.supply,'landlords_unassigned'), ask: 'Which landlords have no acquisition manager?', alert: n(snap?.supply,'landlords_unassigned') > 0 },
          { label: 'unpublished', value: n(snap?.supply,'unpublished'), ask: 'Which properties are off the marketplace, and why?' },
        ]} />

        <Area title="Resale" onAsk={setAsk} metrics={[
          { label: 'listings pending', value: n(snap?.resale,'listings_pending'), ask: 'Which seller listings are waiting for approval?', alert: n(snap?.resale,'listings_pending') > 0 },
          { label: 'for sale now', value: n(snap?.resale,'listings_active'), ask: 'What operations are for sale right now?' },
          { label: 'open offers', value: n(snap?.resale,'offers_open'), ask: 'Which offers are waiting on an answer?', alert: n(snap?.resale,'offers_open') > 0 },
          { label: 'verifications open', value: n(snap?.resale,'verifications_open'), ask: 'Which verifications still have outstanding checks?', alert: n(snap?.resale,'verifications_open') > 0 },
          { label: 'transactions live', value: n(snap?.resale,'transactions_live'), ask: 'Where do the live transactions stand?' },
        ]} />

        <Area title="Platform accounts" onAsk={setAsk} metrics={[
          { label: 'accounts', value: n(snap?.clients,'accounts'), ask: 'How many accounts exist, and how many are real clients rather than staff or test rows?' },
          { label: 'ever signed in', value: n(snap?.clients,'ever_signed_in'), ask: 'Which clients have never signed in?' },
          { label: 'portfolio units', value: n(snap?.clients,'portfolio_units'), ask: 'What is in client portfolios right now?' },
          { label: 'open escalations', value: n(snap?.clients,'open_escalations'), ask: 'What escalations are open?', alert: n(snap?.clients,'open_escalations') > 0 },
        ]} />

        <Area title="Content" onAsk={setAsk} metrics={[
          { label: 'published', value: n(snap?.content,'published'), ask: 'How is the knowledge library doing?' },
          { label: 'never verified', value: n(snap?.content,'never_verified'), ask: 'Which articles have never been checked against a primary source?', alert: n(snap?.content,'never_verified') > 0 },
          { label: 'awaiting review', value: n(snap?.content,'awaiting_review'), ask: 'What articles are waiting for me to review?', alert: n(snap?.content,'awaiting_review') > 0 },
          { label: 'verified', value: n(snap?.content,'legally_verified'), ask: 'Which articles have been verified, and when?' },
        ]} />

        <Area title="Team" onAsk={setAsk} metrics={[
          { label: 'active', value: n(snap?.team,'active'), ask: 'Who is on the Success Team?' },
          { label: 'owners', value: n(snap?.team,'owners'), ask: 'Who has owner access?' },
        ]} />
      </div>

      {/* Penny is DOCKED, not dropped in the middle of the page. She is a persistent tool
          on the right where a console keeps its assistant, so scanning the numbers and
          asking about one are not the same motion interrupted by each other.
          On narrow screens she moves below rather than shrinking into uselessness. */}
      <aside
        aria-label="Ask Penny"
        className="mt-4 rounded-lg border border-slate-300 bg-white xl:fixed xl:right-4 xl:top-20 xl:mt-0 xl:w-[380px] xl:max-h-[calc(100vh-6rem)] xl:overflow-hidden"
      >
        <h2 className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
          Penny
        </h2>
        <div className="p-3">
          <PennyStaffChat staffSession={staffSession} ask={ask} onAsked={() => setAsk('')} />
        </div>
      </aside>

      <p className="mt-6 text-sm">
        <Link to="/staff/dashboard" className="text-slate-600 underline underline-offset-2">
          All tools and tabs
        </Link>
      </p>
    </div>
  );
}
