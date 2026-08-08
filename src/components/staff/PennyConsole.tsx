import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PennyStaffChat } from '@/components/staff/PennyStaffChat';
import { PennyMark } from '@/components/investor/PennyMark';

interface StaffLite {
  id?: string;
  name?: string;
  first_name?: string;
  email?: string;
}

interface BriefItem {
  id?: string;
  who?: string;
  user_type?: string;
  summary?: string;
  detail?: string;
  kind?: string;
  message?: string;
  title?: string;
  priority?: string;
  when?: string;
}
interface BriefSection { count: number; items: BriefItem[] }
interface Brief {
  success?: boolean;
  greeting?: string;
  message?: string;
  sections?: {
    waiting_on_you?: BriefSection;
    opportunities?: BriefSection;
    landlord_alerts?: BriefSection;
    pending?: BriefSection;
  };
  wins?: { resolved_this_week?: number; new_interest?: number };
}

// One briefing section, rendered only when it has something in it.
// The briefing used to render four stacked full-width cards, each listing raw strings.
// On a phone that was a wall of text that pushed the chat off screen entirely, and the
// owner called it messy. He was right, and it was worse than untidy: it competed with
// Penny instead of feeding her.
//
// Now it is one scannable row of counts. Each is a BUTTON that asks Penny about it, so the
// panel becomes a way IN to the conversation rather than a second, worse version of it.
// The detail lives where it belongs — with the person who can reason about it.
function CountChip({
  label, count, onAsk,
}: { label: string; count: number; onAsk: () => void }) {
  if (!count) return null;
  return (
    <button
      type="button"
      onClick={onAsk}
      className="min-h-[44px] rounded-full border border-slate-300 bg-white px-4 text-sm text-slate-800 hover:border-slate-500"
    >
      <span className="font-semibold">{count}</span> {label}
    </button>
  );
}

/**
 * The Penny-first staff home. Opens with Penny's warm, truthful briefing
 * (from penny-staff-brief), shows only the sections that have something in
 * them, and puts the work in the chat beneath. Accessible-first: the briefing
 * is announced when it loads; sections are labelled regions.
 */
export function PennyConsole({ staffSession, onOpenDashboard }: { staffSession: StaffLite | null; onOpenDashboard?: () => void }) {
  const staffId = staffSession?.id || '';
  const staffName = staffSession?.name || staffSession?.first_name || staffSession?.email || 'Staff';
  const first = staffName.split(/\s+/)[0] || 'there';

  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  // A question queued by tapping a count chip. Handed to the chat, which sends it.
  const [ask, setAsk] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const { data } = await supabase.functions.invoke<Brief>('penny-staff-brief', {
          body: { staff_id: staffId, staff_name: staffName },
        });
        if (alive && data) setBrief(data);
      } catch {
        /* graceful fallback below */
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [staffId, staffName]);

  const s = brief?.sections || {};
  const message = brief?.message || `Hi ${first} — good to see you. Let's get to work.`;

  return (
    <div className="max-w-3xl mx-auto">
      <section aria-label="Penny's briefing">
        <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
          <PennyMark size={30} speaking={loading} />
          Penny
        </h2>
        <p className="mt-1 text-slate-700 whitespace-pre-wrap" role="status" aria-live="polite">
          {loading ? `Getting your briefing, ${first}…` : message}
        </p>
      </section>

      {!loading && (
        <nav aria-label="What is waiting" className="mt-3 flex flex-wrap gap-2">
          <CountChip label="waiting on you" count={s.waiting_on_you?.count || 0}
            onAsk={() => setAsk('What is waiting on me right now?')} />
          <CountChip label="opportunities" count={s.opportunities?.count || 0}
            onAsk={() => setAsk('Show me the open opportunities.')} />
          <CountChip label="landlord alerts" count={s.landlord_alerts?.count || 0}
            onAsk={() => setAsk('What are the new landlord alerts?')} />
          <CountChip label="pending" count={s.pending?.count || 0}
            onAsk={() => setAsk('What is pending?')} />
        </nav>
      )}

      <div className="mt-4">
        <PennyStaffChat staffSession={staffSession} ask={ask} onAsked={() => setAsk('')} />
      </div>

      {onOpenDashboard && (
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={onOpenDashboard}
            className="text-sm text-slate-500 underline underline-offset-2 hover:text-slate-700 min-h-[44px] px-4"
          >
            Open the full dashboard
          </button>
        </div>
      )}
    </div>
  );
}

export default PennyConsole;
