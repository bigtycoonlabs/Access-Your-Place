import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { lazy, Suspense } from 'react';

const StaffCountersign = lazy(() =>
  import('@/components/admin/StaffCountersign').then((m) => ({ default: m.StaffCountersign })));

/**
 * The redesigned staff experience, built as a SEPARATE route (/staff/workspace) so the
 * existing dashboard keeps working untouched while this is proven.
 *
 * The shape:
 *   Dashboard   - where you are, what is waiting, nothing that moves around
 *   My work     - everything dynamic lives HERE and nowhere else
 *   Spaces      - Administration, Acquisition, Setup. Static. Same every time you open it.
 *   You         - how we work, settings, profile
 *
 * A space contains three things and only three: what you can START, what you can RECORD,
 * and WHERE THINGS LIVE. Alerts never appear inside a space, because a page that changes
 * shape cannot be learned.
 *
 * Your role decides which spaces you may enter. It does not change what a space looks like.
 */

type Space = 'admin' | 'acq' | 'setup';
type View = 'dash' | 'work' | 'penny' | Space | 'sop' | 'settings' | 'profile';

interface StaffSession {
  id?: string; full_name?: string; name?: string; email?: string;
  role?: string; department?: string; roles?: string[]; permissions?: string[];
}

const SPACES: Record<Space, {
  name: string;
  start: { label: string; does: string }[];
  record: { label: string; does: string }[];
  where: { label: string; hint: string }[];
}> = {
  admin: {
    name: 'Administration',
    start: [
      { label: 'Send a document for signature', does: 'Raise a document and name who signs it. Any staff member, the client, or both.' },
      { label: 'Sign a document', does: 'Sign something that names you as a signer.' },
      { label: 'Change who signs a document', does: 'Add, remove or swap a signer on a document already out.' },
      { label: 'Invite a staff member', does: 'Send someone an invitation and decide which spaces they can enter.' },
      { label: 'Assign a manager to a client', does: 'Put a client in a staff member\u2019s care.' },
      { label: 'Approve a credit request', does: 'Decide a client\u2019s request to use or move credit.' },
    ],
    record: [
      { label: 'Record a payout', does: 'Log money paid to staff or a seller. Nothing is sent automatically.' },
      { label: 'Record a deposit received', does: 'Log money in against an operation.' },
      { label: 'Record an issue resolved', does: 'Close off an escalation or dispute.' },
    ],
    where: [
      { label: 'Staff and invitations', hint: 'Who works here and what they can reach' },
      { label: 'Payouts and commissions', hint: 'What is owed and what has been paid' },
      { label: 'Documents', hint: 'Every agreement, signed and unsigned' },
      { label: 'Client book', hint: 'Every record we hold' },
      { label: 'Escalations and disputes', hint: 'Open matters' },
      { label: 'Platform settings', hint: 'Access, roles and integrations' },
    ],
  },
  acq: {
    name: 'Acquisition',
    start: [
      { label: 'Search Property Forge', does: 'Find new units to pursue. Unlimited, for any staff member.' },
      { label: 'Add a deal', does: 'Create an operation for a unit you intend to secure.' },
      { label: 'Run the numbers', does: 'Analyse an address and return peak, slow and annual projections.' },
      { label: 'Present a deal to a client', does: 'Put a specific deal in a client\u2019s portal.' },
      { label: 'Send a document for signature', does: 'Raise a document and name who signs it.' },
      { label: 'Sign a document', does: 'Sign something that names you as a signer.' },
      { label: 'Review a third party listing', does: 'Check an operation someone else wants to sell through us.' },
      { label: 'Publish a listing', does: 'Make a verified operation visible on the marketplace.' },
      { label: 'Remove a listing', does: 'Take an operation off the marketplace.' },
      { label: 'Add a community', does: 'Add a building or landlord we work with.' },
    ],
    record: [
      { label: 'Record landlord verification', does: 'Log that a human spoke to the landlord. Your name is attached to the claim.' },
      { label: 'Record a closing', does: 'Log a deal that has closed. Commission is calculated.' },
      { label: 'Record a lease signed', does: 'Log an executed lease.' },
      { label: 'Log a call or touch', does: 'Record that you contacted someone.' },
    ],
    where: [
      { label: 'Property Forge', hint: 'Search for units. Unlimited for all staff' },
      { label: 'Deals in flight', hint: 'Every operation and its stage' },
      { label: 'Marketplace listings', hint: 'What is public right now' },
      { label: 'Third party listings', hint: 'Operations others want to sell' },
      { label: 'Landlords and communities', hint: 'Who we work with' },
      { label: 'Leads and inquiries', hint: 'People waiting on a reply' },
    ],
  },
  setup: {
    name: 'Setup',
    start: [
      { label: 'Start a new project', does: 'Open a setup project for a client and create its item schedule.' },
      { label: 'Send a Pro the job link', does: 'Generate a one-off link giving a Pro access to this job only. No login.' },
      { label: 'Add items to a project', does: 'Add items one at a time or from a spreadsheet.' },
      { label: 'Book a truck', does: 'Record a vehicle booking against a project.' },
      { label: 'Message a client', does: 'Send to their portal and email them a copy.' },
      { label: 'Send a document for signature', does: 'Raise a document and name who signs it.' },
      { label: 'Sign a document', does: 'Sign something that names you as a signer.' },
      { label: 'Close out a project', does: 'Finish and hand over to the client.' },
    ],
    record: [
      { label: 'Record an inventory at collection', does: 'The count taken at pickup. This is what the liability clause rests on.' },
      { label: 'Mark an item arrived', does: 'Record that an item has physically turned up.' },
      { label: 'Log a maintenance issue', does: 'Raise something found on the ground.' },
      { label: 'Record an issue resolved', does: 'Close it off.' },
    ],
    where: [
      { label: 'Projects', hint: 'Every job and its stage' },
      { label: 'Item schedule', hint: 'Every item, room by room' },
      { label: 'Sourcing and purchasing', hint: 'What still needs buying' },
      { label: 'Warehouse and freight', hint: 'Trucks, storage and transit' },
      { label: 'Crews and Pro links', hint: 'Who is on the ground' },
      { label: 'Install and handover', hint: 'Photos, punch list, sign off' },
    ],
  },
};

const SPACE_ORDER: Space[] = ['admin', 'acq', 'setup'];

function spacesFor(s: StaffSession | null): Space[] {
  const bag = [s?.role, s?.department, ...(Array.isArray(s?.roles) ? s!.roles! : [])]
    .filter(Boolean).map((r) => String(r).toLowerCase()).join(' ');
  if (s?.permissions?.includes('all') || /owner|admin/.test(bag)) return SPACE_ORDER;
  const out: Space[] = [];
  if (/success/.test(bag)) out.push('admin', 'acq', 'setup');
  else {
    if (/acquisition/.test(bag)) out.push('acq');
    if (/setup/.test(bag)) out.push('setup');
  }
  return out.length ? Array.from(new Set(out)) : [];
}

export default function StaffWorkspace() {
  const [session, setSession] = useState<StaffSession | null>(null);
  const [view, setView] = useState<View>('dash');
  const [openAction, setOpenAction] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  const [toSign, setToSign] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const raw = localStorage.getItem('staffSession');
      if (raw) setSession(JSON.parse(raw));
    } catch { /* unreadable session */ }
  }, []);

  const canEnter = useMemo(() => spacesFor(session), [session]);
  const displayName = session?.full_name || session?.name || '';

  const load = useCallback(async () => {
    if (!session?.id) return;
    setLoading(true);
    try {
      const [sigRes, alertRes, projRes] = await Promise.all([
        supabase.functions.invoke('staff-countersign', { body: { action: 'list', staff_id: session.id } }),
        supabase.functions.invoke('penny-staff-brief', { body: { staff_id: session.id } }).catch(() => null),
        supabase.functions.invoke('manage-setup-tasks', { body: { action: 'list_projects' } }).catch(() => null),
      ]);
      setToSign((sigRes?.data?.documents || []).filter((d: any) => d.can_sign));
      setAlerts(alertRes?.data?.my_alerts || []);
      setProjects(projRes?.data?.projects || []);
    } catch { /* shown as empty, not as zero */ }
    setLoading(false);
  }, [session?.id]);

  useEffect(() => { load(); }, [load]);

  const workCount = toSign.length + alerts.length;

  function go(v: View) {
    setView(v);
    setOpenAction(null);
    const label = v === 'dash' ? 'Dashboard' : v === 'work' ? 'My work'
      : v === 'penny' ? 'Penny' : (SPACES as any)[v]?.name || v;
    setAnnounce(`${label}.`);
    document.getElementById('ws-main')?.focus();
  }

  const navLink = (v: View, label: string) => (
    <li key={v}>
      <a
        href="#ws-main"
        aria-current={view === v ? 'page' : undefined}
        onClick={(e) => { e.preventDefault(); go(v); }}
        style={{
          display: 'flex', alignItems: 'center', minHeight: 44, padding: '0 12px',
          borderRadius: 6, textDecoration: 'none', color: '#111827',
          background: view === v ? '#fff' : 'transparent',
          fontWeight: view === v ? 700 : 500,
          boxShadow: view === v ? 'inset 3px 0 0 #c8955f' : 'none',
        }}
      >{label}</a>
    </li>
  );

  const H2 = ({ children }: { children: React.ReactNode }) =>
    <h2 style={{ fontSize: '1rem', margin: '1.9em 0 .2em' }}>{children}</h2>;
  const Hint = ({ children }: { children: React.ReactNode }) =>
    <p style={{ color: '#5b6672', fontSize: '.88rem', margin: '0 0 .7em' }}>{children}</p>;

  function ActionList(space: Space, kind: 'start' | 'record') {
    const items = SPACES[space][kind];
    const id = `${kind}-${space}`;
    return (
      <>
        <h2 id={id} style={{ fontSize: '1rem', margin: '1.9em 0 .2em' }}>
          {kind === 'start' ? 'Start something' : 'Record what happened'}
        </h2>
        <Hint>{kind === 'start'
          ? 'Creates work, or sends something to somebody.'
          : 'Writes down something that has already taken place.'}</Hint>
        <ul aria-labelledby={id} style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {items.map((a) => (
            <li key={a.label} style={{ width: openAction === a.label ? '100%' : 'auto' }}>
              <button
                type="button"
                onClick={() => {
                  const next = openAction === a.label ? null : a.label;
                  setOpenAction(next);
                  if (next) setAnnounce(`${a.label} opened. ${a.does}`);
                }}
                style={{
                  minHeight: 44, padding: '0 14px', borderRadius: 6,
                  border: `1px solid ${kind === 'start' ? '#12263f' : '#8a94a0'}`,
                  background: '#fff', color: kind === 'start' ? '#12263f' : '#3d4753',
                  fontWeight: 600, fontSize: '.9rem', cursor: 'pointer',
                }}
              >{a.label}</button>
              {openAction === a.label && (
                <div role="region" aria-label={a.label} tabIndex={-1}
                  style={{ background: '#fff', border: '1px solid #12263f', borderRadius: 8, padding: 18, marginTop: 10 }}>
                  <h3 style={{ margin: '0 0 .2em' }}>{a.label}</h3>
                  <p style={{ color: '#5b6672', fontSize: '.92rem' }}>{a.does}</p>
                  <p style={{ color: '#5b6672', fontSize: '.9rem' }}>
                    This screen is the new design. The action itself still runs on the existing dashboard until it is moved across.
                  </p>
                  <button type="button" onClick={() => setOpenAction(null)}
                    style={{ minHeight: 44, padding: '0 16px', borderRadius: 6, border: '1px solid #12263f', background: '#fff', color: '#12263f', fontWeight: 600, cursor: 'pointer' }}>
                    Close
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div style={{ background: '#f7f8fa', minHeight: '100vh' }}>
      <a href="#ws-main" style={{ position: 'absolute', left: -9999 }}
         onFocus={(e) => { e.currentTarget.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99;background:#fff;padding:12px 16px;border:2px solid #12263f;border-radius:6px'; }}
         onBlur={(e) => { e.currentTarget.style.cssText = 'position:absolute;left:-9999px'; }}>
        Skip to main content
      </a>

      <header style={{ background: '#12263f', color: '#fff', padding: '12px 20px' }}>
        <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontWeight: 700 }}>Access Your Place</span>
          <span style={{ fontSize: '.9rem' }}>{displayName || 'Not signed in'}</span>
        </div>
      </header>

      <div style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', gap: 26, padding: '22px 20px 70px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <nav aria-label="Main" style={{ width: 196, flex: '0 0 196px' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {navLink('dash', 'Dashboard')}
            {navLink('work', workCount ? `My work (${workCount})` : 'My work')}
            {navLink('penny', 'Penny')}
          </ul>
          <h2 style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em', color: '#5b6672', margin: '18px 0 6px' }}>Spaces</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {SPACE_ORDER.map((s) => navLink(s, SPACES[s].name))}
          </ul>
          <h2 style={{ fontSize: '.75rem', textTransform: 'uppercase', letterSpacing: '.06em', color: '#5b6672', margin: '18px 0 6px' }}>You</h2>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {navLink('sop', 'How we work')}
            {navLink('settings', 'Settings')}
            {navLink('profile', 'Profile')}
          </ul>
        </nav>

        <main id="ws-main" tabIndex={-1} style={{ flex: 1, minWidth: 0 }}>
          <div aria-live="polite" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{announce}</div>

          {view === 'dash' && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>Dashboard</h1>
              <div style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16, marginBottom: 10 }}>
                <h3 style={{ margin: '0 0 .2em' }}>
                  {loading ? 'Checking what is waiting\u2026' : `${workCount} thing${workCount === 1 ? '' : 's'} need${workCount === 1 ? 's' : ''} you`}
                </h3>
                <p style={{ color: '#5b6672', fontSize: '.92rem' }}>
                  {toSign.length} document{toSign.length === 1 ? '' : 's'} awaiting your signature. {projects.length} project{projects.length === 1 ? '' : 's'} running.
                </p>
                <button type="button" onClick={() => go('work')}
                  style={{ minHeight: 44, padding: '0 16px', borderRadius: 6, border: '1px solid #12263f', background: '#12263f', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>
                  Open my work
                </button>
              </div>
              {canEnter.map((s) => (
                <div key={s} style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16, marginBottom: 10 }}>
                  <h3 style={{ margin: '0 0 .2em' }}>{SPACES[s].name}</h3>
                  <p style={{ color: '#5b6672', fontSize: '.92rem' }}>
                    {SPACES[s].start.length} things you can start, {SPACES[s].record.length} you can record.
                  </p>
                  <button type="button" onClick={() => go(s)}
                    style={{ minHeight: 44, padding: '0 16px', borderRadius: 6, border: '1px solid #12263f', background: '#fff', color: '#12263f', fontWeight: 600, cursor: 'pointer' }}>
                    Go to {SPACES[s].name}
                  </button>
                </div>
              ))}
            </>
          )}

          {view === 'work' && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>My work</h1>
              <H2>Waiting on your signature</H2>
              <Hint>Documents where you are named as a signer. Read it, type your name, sign.</Hint>
              {session?.id && (
                <Suspense fallback={<p style={{ color: '#5b6672' }}>Loading your documents\u2026</p>}>
                  <StaffCountersign staffId={session.id} staffName={displayName} />
                </Suspense>
              )}

              <H2>Needs you now</H2>
              <Hint>Nothing moves until you deal with these.</Hint>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {alerts.length === 0 && (
                  <li style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16 }}>
                    <p style={{ color: '#5b6672', margin: 0 }}>Nothing right now.</p>
                  </li>
                )}
                {alerts.map((a: any, i: number) => (
                  <li key={a.id || i} style={{ background: '#fff', border: '1px solid #dfe3e8', borderLeft: '4px solid #9f1239', borderRadius: 8, padding: 16, marginBottom: 10 }}>
                    <h3 style={{ margin: '0 0 .2em' }}>{a.title}</h3>
                    <p style={{ color: '#5b6672', fontSize: '.92rem', whiteSpace: 'pre-wrap' }}>{String(a.body || '').slice(0, 260)}</p>
                  </li>
                ))}
              </ul>

              <H2>In progress</H2>
              <Hint>Jobs and acquisitions already running.</Hint>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {projects.length === 0 && (
                  <li style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16 }}>
                    <p style={{ color: '#5b6672', margin: 0 }}>No projects running.</p>
                  </li>
                )}
                {projects.map((p: any) => (
                  <li key={p.id} style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16, marginBottom: 10 }}>
                    <h3 style={{ margin: '0 0 .2em' }}>{p.property_address}</h3>
                    <p style={{ color: '#5b6672', fontSize: '.92rem' }}>{p.status} · phase {p.phase}</p>
                  </li>
                ))}
              </ul>
            </>
          )}

          {view === 'penny' && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>Penny</h1>
              <p style={{ color: '#5b6672' }}>
                Chat history and workspace selection are part of this design and are not wired up on this screen yet.
                Penny is fully working on the existing dashboard in the meantime.
              </p>
              <a href="/staff/dashboard"
                 style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 16px', borderRadius: 6, border: '1px solid #12263f', background: '#12263f', color: '#fff', fontWeight: 600, textDecoration: 'none' }}>
                Open Penny on the current dashboard
              </a>
            </>
          )}

          {SPACE_ORDER.includes(view as Space) && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>{SPACES[view as Space].name}</h1>
              {!canEnter.includes(view as Space) ? (
                <div style={{ background: '#fff', border: '1px solid #dfe3e8', borderLeft: '4px solid #9f1239', borderRadius: 8, padding: 20 }}>
                  <h3 style={{ margin: '0 0 .2em' }}>You do not have access to {SPACES[view as Space].name}</h3>
                  <p style={{ color: '#5b6672' }}>Ask an owner or an administrator to add it.</p>
                </div>
              ) : (
                <>
                  {ActionList(view as Space, 'start')}
                  {ActionList(view as Space, 'record')}
                  <H2>Where things live</H2>
                  <Hint>Browse and search the records themselves.</Hint>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(228px,1fr))', gap: 10 }}>
                    {SPACES[view as Space].where.map((w) => (
                      <li key={w.label}>
                        <a href="/staff/dashboard"
                           style={{ display: 'block', background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: '14px 16px', textDecoration: 'none', color: '#111827', minHeight: 44 }}>
                          <strong style={{ display: 'block' }}>{w.label}</strong>
                          <span style={{ color: '#5b6672', fontSize: '.87rem' }}>{w.hint}</span>
                        </a>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {view === 'sop' && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>How we work</h1>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(228px,1fr))', gap: 10 }}>
                {['Acquisition workflow', 'Setup workflow', 'Teardown and move', 'Using the platform',
                  'Working with Penny', 'Client communication', 'Payments and payouts', 'Accessibility standards'].map((t) => (
                  <li key={t}>
                    <a href="/staff/dashboard?tab=sops"
                       style={{ display: 'block', background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: '14px 16px', textDecoration: 'none', color: '#111827', minHeight: 44 }}>
                      <strong>{t}</strong>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          {view === 'settings' && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>Settings</h1>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(228px,1fr))', gap: 10 }}>
                {[['Notifications', 'What reaches you, and how'],
                  ['Screen reader and display', 'Announcements, contrast, text size'],
                  ['Signature', 'How your name appears on documents'],
                  ['Security', 'Password and sessions']].map(([t, h]) => (
                  <li key={t}>
                    <a href="/staff/dashboard?tab=settings"
                       style={{ display: 'block', background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: '14px 16px', textDecoration: 'none', color: '#111827', minHeight: 44 }}>
                      <strong style={{ display: 'block' }}>{t}</strong>
                      <span style={{ color: '#5b6672', fontSize: '.87rem' }}>{h}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </>
          )}

          {view === 'profile' && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>Profile</h1>
              <div style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16 }}>
                <h3 style={{ margin: '0 0 .2em' }}>{displayName || 'Not signed in'}</h3>
                <p style={{ color: '#5b6672', fontSize: '.92rem' }}>
                  Spaces you can enter: {canEnter.length ? canEnter.map((s) => SPACES[s].name).join(', ') : 'none yet'}
                </p>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
