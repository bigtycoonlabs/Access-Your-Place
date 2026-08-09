import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { PennyStaffChat } from '@/components/staff/PennyStaffChat';

/**
 * The Success Team home.
 *
 * WHAT WAS WRONG WITH THE OLD ONE
 *
 * StaffDashboard is 2,222 lines, around sixty tab values and twenty-one cards on one
 * screen. It grew by accretion — every feature added a card and nothing was ever removed —
 * so a Success Team member opens a wall and has to find the one thing that matters today.
 * On a screen reader that wall is something you have to listen through.
 *
 * This is the same information, ordered by what somebody actually needs:
 *
 *   1. The single most important thing right now, in a sentence. If nothing is wrong it
 *      says so, rather than showing twelve zeroes.
 *   2. Penny, because she can answer the follow-up. A count tells you there are four
 *      inquiries; she tells you which one to call.
 *   3. Counts as buttons that ASK HER. The panel is a way into the conversation, not a
 *      worse copy of it.
 *   4. Everything else behind one link, not spread across sixty tabs.
 *
 * DOM ORDER IS SPEAKING ORDER. Most important first, always, regardless of layout.
 */

type StaffLite = {
  id: string; name?: string; first_name?: string; email?: string;
  role?: string; team?: string; is_owner?: boolean;
};

type Attention = {
  count: number;
  emergencies: number;
  items: { severity: string; kind: string; what: string; who?: string; contact?: string }[];
};

/** What each role should be looking at first. Routing someone to the wrong thing wastes their day. */
const ROLE_FOCUS: Record<string, { label: string; ask: string }[]> = {
  acquisition: [
    { label: 'new leads', ask: 'What leads came in and who should I call first?' },
    { label: 'landlords waiting', ask: 'What is waiting in the landlord portal?' },
    { label: 'the marketplace', ask: "What's on the marketplace right now?" },
  ],
  admin: [
    { label: 'escalations', ask: 'What escalations are open?' },
    { label: 'disputes and issues', ask: 'What issues need resolving today?' },
    { label: 'documents out', ask: 'What documents are waiting to go out?' },
  ],
  setup: [
    { label: 'launches in flight', ask: 'Which setups are in progress and where are they stuck?' },
    { label: 'client files', ask: 'Which client files need updating?' },
  ],
  owner: [
    { label: 'everything waiting', ask: 'What needs my attention right now?' },
    { label: 'the seller flow', ask: 'Where does the third-party sale pipeline stand?' },
    { label: 'the library', ask: 'What library articles need reviewing?' },
  ],
};

function focusFor(staff: StaffLite | null) {
  if (staff?.is_owner) return ROLE_FOCUS.owner;
  const r = `${staff?.role || ''} ${staff?.team || ''}`.toLowerCase();
  if (r.includes('acquisition')) return ROLE_FOCUS.acquisition;
  if (r.includes('admin') || r.includes('management')) return ROLE_FOCUS.admin;
  if (r.includes('setup')) return ROLE_FOCUS.setup;
  // success_managers and anything unrecognised. Deliberately NOT guessed into a role —
  // showing the general view is honest; inventing a specialism is not.
  return ROLE_FOCUS.owner;
}

export default function StaffHome({ staffSession }: { staffSession: StaffLite | null }) {
  const [attention, setAttention] = useState<Attention | null>(null);
  const [loadError, setLoadError] = useState('');
  const [ask, setAsk] = useState('');
  const first = staffSession?.first_name || (staffSession?.name || '').split(' ')[0] || 'there';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('penny-staff-brief', {
          body: { staff_id: staffSession?.id, attention_only: true },
        });
        if (cancelled) return;
        if (error || !data) {
          // Said, not swallowed. "Nothing needs attention" and "we could not check" are
          // different things and must never look the same.
          setLoadError('Could not check what needs attention. Ask Penny directly below.');
          return;
        }
        setAttention(data.attention || null);
      } catch {
        if (!cancelled) setLoadError('Could not check what needs attention. Ask Penny directly below.');
      }
    })();
    return () => { cancelled = true; };
  }, [staffSession?.id]);

  const emergencies = attention?.items?.filter((i) => i.severity === 'emergency') || [];
  const urgent = attention?.items?.filter((i) => i.severity === 'high') || [];

  // The one sentence. This is the whole point of the screen.
  let headline: string;
  if (loadError) headline = loadError;
  else if (!attention) headline = 'Checking what needs you…';
  else if (emergencies.length) headline = emergencies[0].what;
  else if (urgent.length) headline = urgent[0].what;
  else if (attention.count) headline = `${attention.count} thing${attention.count === 1 ? '' : 's'} need you today. Nothing urgent.`;
  else headline = 'Nothing is waiting on you right now.';

  return (
    <div className="mx-auto w-full max-w-[1200px] px-4 py-6">
      {/* 1. THE ANSWER. First in the DOM because it is first in importance. */}
      <header className="mb-6">
        <p className="text-sm text-slate-500">Success Team</p>
        <h1 className="mt-1 text-2xl font-bold text-slate-900">
          {first}, {emergencies.length ? 'this needs you now' : "here's where things stand"}
        </h1>
        <p
          role="status"
          aria-live="polite"
          className={`mt-2 text-lg leading-relaxed ${emergencies.length ? 'font-semibold text-red-700' : 'text-slate-700'}`}
        >
          {headline}
        </p>
        {emergencies.length > 0 && emergencies[0].contact && (
          <p className="mt-1 text-lg font-semibold text-red-700">
            Reach them on {emergencies[0].contact}.
          </p>
        )}
      </header>

      {/* 2. PENNY. She answers the follow-up a count cannot. */}
      <section aria-label="Ask Penny" className="rounded-lg border border-slate-200 bg-white p-4">
        <PennyStaffChat staffSession={staffSession} ask={ask} onAsked={() => setAsk('')} />
      </section>

      {/* 3. WHAT THIS ROLE SHOULD LOOK AT. Buttons that ask her, not tabs that navigate away. */}
      <nav aria-label="Start here" className="mt-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Start here</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          {focusFor(staffSession).map((f) => (
            <button
              key={f.label}
              type="button"
              onClick={() => setAsk(f.ask)}
              className="min-h-[44px] rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-800 hover:border-slate-500"
            >
              {f.label}
            </button>
          ))}
        </div>
      </nav>

      {/* 4. EVERYTHING ELSE, behind one link rather than sixty tabs. */}
      <p className="mt-8 text-sm">
        <Link to="/staff/dashboard?view=full" className="text-slate-600 underline underline-offset-2">
          Open the full dashboard
        </Link>
      </p>
    </div>
  );
}
