import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { PennyStaffChat } from '@/components/staff/PennyStaffChat';

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
function BriefBlock({
  title, section, render,
}: {
  title: string;
  section?: BriefSection;
  render: (i: BriefItem) => string;
}) {
  if (!section || section.count === 0) return null;
  return (
    <section aria-label={title} className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
      <h3 className="font-bold text-slate-800">
        {title} <span className="text-slate-400 font-normal">({section.count})</span>
      </h3>
      <ul className="mt-2 space-y-2">
        {section.items.map((i, idx) => (
          <li key={i.id || idx} className="text-sm text-slate-700">
            {render(i)}
            {i.when ? <span className="text-slate-400"> · {i.when}</span> : null}
          </li>
        ))}
      </ul>
    </section>
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
        <h2 className="text-xl font-bold text-slate-800">Penny</h2>
        <p className="mt-1 text-slate-700 whitespace-pre-wrap" role="status" aria-live="polite">
          {loading ? `Getting your briefing, ${first}…` : message}
        </p>
      </section>

      {!loading && (
        <>
          <BriefBlock
            title="Where I need you"
            section={s.waiting_on_you}
            render={(i) => `${i.who}${i.user_type ? ` (${i.user_type})` : ''} — ${i.summary}`}
          />
          <BriefBlock
            title="New opportunities"
            section={s.opportunities}
            render={(i) => `${i.who} — ${i.kind}${i.detail ? `: ${i.detail}` : ''}`}
          />
          <BriefBlock
            title="New landlord alerts"
            section={s.landlord_alerts}
            render={(i) => `${i.who}${i.detail ? ` — ${i.detail}` : ''}`}
          />
          <BriefBlock
            title="Pending"
            section={s.pending}
            render={(i) => `${i.title}${i.message ? ` — ${i.message}` : ''}`}
          />
        </>
      )}

      <div className="mt-6">
        <PennyStaffChat staffSession={staffSession} />
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
