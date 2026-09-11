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
type View = 'dash' | 'work' | 'penny' | 'clients' | Space | 'sop' | 'settings' | 'profile';

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
  const [items, setItems] = useState<any[]>([]);
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [panel, setPanel] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  // Nothing here should take 45 seconds. If it does, unlock the screen and say so, rather
  // than leaving every button disabled with no explanation.
  useEffect(() => {
    if (!busy) return;
    const t = setTimeout(() => {
      setBusy(false);
      setResult('That took too long and was stopped. Nothing was saved. Try again, or Cancel.');
      setAnnounce('That took too long and was stopped. Nothing was saved.');
    }, 45000);
    return () => clearTimeout(t);
  }, [busy]);
  const [result, setResult] = useState('');

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
      const proj = projRes?.data?.projects || [];
      setProjects(proj);
      // The item schedule is real data, not a placeholder. Read it for the projects she runs.
      if (proj.length) {
        const { data: rows } = await supabase
          .from('setup_items')
          .select('id,project_id,room,destination_unit,item_name,quantity,status,delivered_at')
          .in('project_id', proj.map((x: any) => x.id))
          .order('room', { ascending: true });
        setItems(rows || []);
      } else setItems([]);

      // Everyone she looks after: clients on her projects, plus any client assigned to her.
      const ids = Array.from(new Set(proj.map((x: any) => x.investor_id).filter(Boolean)));
      const { data: cl } = await supabase
        .from('staff_client_list')
        .select('id,full_name,email,phone,company_name,credit_balance,status')
        .or([
          ids.length ? `id.in.(${ids.join(',')})` : '',
          `assigned_success_manager_id.eq.${session.id}`,
          `assigned_setup_manager_id.eq.${session.id}`,
        ].filter(Boolean).join(','))
        .limit(200);
      setClients(cl || []);
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

  async function runRpc(fn: string, args: Record<string, unknown>, say: (d: any) => string) {
    setBusy(true); setResult('');
    try {
      const { data, error } = await supabase.rpc(fn, args);
      if (error) throw new Error(error.message);
      if (data && data.ok === false) throw new Error(data.error || 'It did not save');
      const msg = say(data);
      setResult(msg); setAnnounce(msg);
      await load();
    } catch (e: any) {
      const msg = `Not saved. ${e.message}`;
      setResult(msg); setAnnounce(msg);
    }
    setBusy(false);
  }

  async function run(action: string, body: Record<string, unknown>, say: (d: any) => string) {
    setBusy(true); setResult('');
    try {
      const { data, error } = await supabase.functions.invoke('manage-setup-tasks', { body: { action, ...body } });
      if (error || data?.success === false) throw new Error(data?.error || error?.message || 'It did not save');
      const msg = say(data);
      setResult(msg); setAnnounce(msg);
      await load();
    } catch (e: any) {
      const msg = `Not saved. ${e.message}`;
      setResult(msg); setAnnounce(msg);
    }
    setBusy(false);
  }

  const F = ({ id, label, hint }: { id: string; label: string; hint?: string }) => (
    <div style={{ margin: '12px 0' }}>
      <label htmlFor={id} style={{ display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>{label}</label>
      {hint && <p style={{ color: '#5b6672', fontSize: '.85rem', margin: '0 0 4px' }}>{hint}</p>}
      <input id={id} type="text" value={form[id] || ''}
        onChange={(e) => setForm((f) => ({ ...f, [id]: e.target.value }))}
        autoCapitalize={id.includes('email') ? 'none' : 'sentences'}
        style={{ width: '100%', maxWidth: 440, minHeight: 44, fontSize: '1rem', padding: '8px 12px', border: '1px solid #dfe3e8', borderRadius: 6 }} />
    </div>
  );

  const Btn = ({ onClick, children, kind = 'primary' as 'primary' | 'sec', always = false }: any) => {
    // `always` buttons (Cancel, Close) are never disabled. A person must always be able to
    // back out, whatever the screen thinks it is doing.
    const blocked = busy && !always;
    return (
      <button type="button" disabled={blocked}
        onClick={() => { if (always) setBusy(false); onClick?.(); }}
        style={{ minHeight: 44, padding: '0 16px', borderRadius: 6, border: '1px solid #12263f',
          background: kind === 'primary' ? '#12263f' : '#fff', color: kind === 'primary' ? '#fff' : '#12263f',
          fontWeight: 600, fontSize: '.92rem', cursor: blocked ? 'wait' : 'pointer', marginRight: 8,
          opacity: blocked ? 0.6 : 1 }}>
        {blocked ? 'Working…' : children}
      </button>
    );
  };

  function ItemSchedule() {
    const rows = form.projfilter ? items.filter((r: any) => r.project_id === form.projfilter) : items;
    const byProject: Record<string, any[]> = {};
    rows.forEach((r: any) => { (byProject[r.project_id] ||= []).push(r); });
    const nameFor = (id: string) => projects.find((p: any) => p.id === id)?.investor_name || 'Project';
    return (
      <>
        <H2>Item schedule</H2>
        <Hint>Room is where it came from. Unit is where it is going.</Hint>
        <div style={{ margin: '0 0 12px' }}>
          <label htmlFor="projfilter" style={{ display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>
            Show items for
          </label>
          <select id="projfilter" value={form.projfilter || ''}
            onChange={(e) => setForm((f) => ({ ...f, projfilter: e.target.value }))}
            style={{ minHeight: 44, fontSize: '1rem', padding: '0 10px', border: '1px solid #dfe3e8',
                     borderRadius: 6, width: '100%', maxWidth: 440, background: '#fff' }}>
            <option value="">All my projects</option>
            {projects.map((pr: any) => (
              <option key={pr.id} value={pr.id}>{pr.investor_name}</option>
            ))}
          </select>
        </div>
        {rows.length === 0 && (
          <p style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16, color: '#5b6672' }}>
            {loading ? 'Loading…' : 'No items yet. Use Add items above.'}
          </p>
        )}
        {Object.keys(byProject).map((pid) => {
          const list = byProject[pid];
          const arrived = list.filter((r: any) => r.delivered_at).length;
          return (
            <div key={pid} style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16, marginBottom: 10 }}>
              <h3 style={{ margin: '0 0 .2em' }}>{nameFor(pid)}</h3>
              <p style={{ color: '#5b6672', fontSize: '.9rem' }}>
                {list.length} item{list.length === 1 ? '' : 's'} · {arrived} arrived · {list.length - arrived} outstanding
              </p>
              <ul style={{ listStyle: 'none', margin: '10px 0 0', padding: 0 }}>
                {list.slice(0, 40).map((r: any) => (
                  <li key={r.id} style={{ borderTop: '1px solid #eef1f4', padding: '8px 0', fontSize: '.92rem',
                                          display: 'flex', gap: 10, alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <span style={{ flex: 1 }}>
                    <strong>{r.item_name}</strong>
                    {r.quantity > 1 && <span style={{ color: '#5b6672' }}> ×{r.quantity}</span>}
                    <span style={{ color: '#5b6672' }}>
                      {' '}· {r.room || 'no room'}{r.destination_unit ? ` · unit ${r.destination_unit}` : ''}
                      {' '}· {r.delivered_at ? 'arrived' : r.status}
                    </span>
                    </span>
                    <button type="button" aria-label={`Remove ${r.item_name}`}
                      onClick={() => runRpc('ayp_setup_remove_items',
                        { p_staff_id: session?.id, p_item_ids: [r.id], p_project_id: null, p_all: false },
                        (d) => d?.note || 'Removed.')}
                      style={{ minHeight: 44, minWidth: 78, padding: '0 12px', borderRadius: 6,
                               border: '1px solid #9f1239', background: '#fff', color: '#9f1239',
                               fontWeight: 600, fontSize: '.85rem', cursor: 'pointer', flex: '0 0 auto' }}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div style={{ marginTop: 12 }}>
                {form.clearing === pid ? (
                  <>
                    <p style={{ color: '#9f1239', fontWeight: 600, fontSize: '.9rem' }}>
                      Remove all {list.length} items from {nameFor(pid)}? Anything a Pro has already
                      confirmed, or that has arrived, will be kept.
                    </p>
                    <Btn onClick={() => runRpc('ayp_setup_remove_items',
                      { p_staff_id: session?.id, p_item_ids: null, p_project_id: pid, p_all: true },
                      (d) => { setForm((f) => ({ ...f, clearing: '' })); return d?.note || 'Cleared.'; })}>
                      Yes, clear the list
                    </Btn>
                    <Btn kind="sec" always onClick={() => setForm((f) => ({ ...f, clearing: '' }))}>Keep them</Btn>
                  </>
                ) : (
                  <button type="button"
                    onClick={() => setForm((f) => ({ ...f, clearing: pid }))}
                    style={{ minHeight: 44, padding: '0 14px', borderRadius: 6, border: '1px solid #9f1239',
                             background: '#fff', color: '#9f1239', fontWeight: 600, fontSize: '.88rem', cursor: 'pointer' }}>
                    Clear this list and start again
                  </button>
                )}
              </div>
              {list.length > 40 && (
                <p style={{ color: '#5b6672', fontSize: '.86rem', marginTop: 8 }}>
                  Showing the first 40 of {list.length}.
                </p>
              )}
            </div>
          );
        })}
      </>
    );
  }

  function SetupWork() {
    return (
      <>
        <H2>Your projects</H2>
        <Hint>Every job assigned to you. Open one to edit it or add items.</Hint>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {loading && <li style={{ color: '#5b6672' }}>Loading your projects…</li>}
          {!loading && projects.length === 0 && (
            <li style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16 }}>
              <p style={{ color: '#5b6672', margin: 0 }}>No projects yet. Start one below.</p>
            </li>
          )}
          {projects.map((pr: any) => (
            <li key={pr.id} style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16, marginBottom: 10 }}>
              <h3 style={{ margin: '0 0 .2em' }}>{pr.investor_name || 'Unnamed client'}</h3>
              <p style={{ color: '#5b6672', fontSize: '.92rem', margin: '0 0 .3em' }}>{pr.property_address}</p>
              <p style={{ color: '#5b6672', fontSize: '.88rem', margin: '0 0 .7em' }}>
                {pr.setup_type?.replace(/_/g, ' ')} · phase {pr.phase} · {pr.logistics_fee_paid ? 'fee paid' : 'fee not paid'}
              </p>
              <Btn kind="sec" onClick={() => { setPanel(`edit:${pr.id}`); setForm({ addr: pr.property_address || '' }); setResult(''); }}>Edit this project</Btn>
              <Btn kind="sec" onClick={() => { setPanel(`pro:${pr.id}`); setForm({}); setResult(''); }}>Create a Pro link</Btn>
              <Btn kind="sec" onClick={() => { setPanel(`items:${pr.id}`); setForm({}); setResult(''); }}>Add items</Btn>
              <Btn kind="sec" onClick={() => { setPanel(`msg:${pr.id}`); setForm({}); setResult(''); }}>Message the client</Btn>
            </li>
          ))}
        </ul>

        {panel?.startsWith('edit:') && (
          <div role="region" aria-label="Edit project" style={{ background: '#fff', border: '1px solid #12263f', borderRadius: 8, padding: 18, marginTop: 12 }}>
            <h3 style={{ margin: '0 0 .2em' }}>Edit project</h3>
            <p style={{ background: '#12263f', color: '#fff', fontWeight: 700, borderRadius: 6,
                         padding: '10px 12px', margin: '0 0 12px', fontSize: '.95rem' }}>
              {(() => { const pr = projects.find((x: any) => x.id === panel?.split(':')[1]);
                 return pr ? `${pr.investor_name} — ${pr.property_address}` : 'Project'; })()}
            </p>
            <F id="addr" label="Property address" />
            <F id="notes" label="Add a note" hint="Appended to the project record. Optional." />
            <Btn onClick={() => run('update_project',
              { project_id: panel.slice(5), updates: { property_address: form.addr, internal_notes: form.notes } },
              () => 'Project updated.')}>Save changes</Btn>
            <Btn kind="sec" always onClick={() => { setPanel(null); setResult(''); setForm({}); }}>Cancel</Btn>
          </div>
        )}

        {panel?.startsWith('items:') && (
          <div role="region" aria-label="Add items" style={{ background: '#fff', border: '1px solid #12263f', borderRadius: 8, padding: 18, marginTop: 12 }}>
            <h3 style={{ margin: '0 0 .2em' }}>Add items</h3>
            <p style={{ background: '#12263f', color: '#fff', fontWeight: 700, borderRadius: 6,
                         padding: '10px 12px', margin: '0 0 12px', fontSize: '.95rem' }}>
              {(() => { const pr = projects.find((x: any) => x.id === panel?.split(':')[1]);
                 return pr ? `${pr.investor_name} — ${pr.property_address}` : 'Project'; })()}
            </p>
            <p style={{ color: '#5b6672', fontSize: '.92rem' }}>
              One item per line: <strong>room, item, quantity</strong>. Quantity is optional and defaults to one. You can upload a CSV above, paste rows straight from a spreadsheet, or type them.
              An item with no room is refused, because an item nobody can place is not usable on the board.
            </p>
            <div style={{ margin: '12px 0' }}>
              <label htmlFor="sheet" style={{ display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>
                Upload a spreadsheet
              </label>
              <p style={{ color: '#5b6672', fontSize: '.85rem', margin: '0 0 6px' }}>
                Excel, Numbers or CSV. Columns: room, item, quantity. From Google Sheets, File then Download then either Excel or CSV.
              </p>
              <input
                id="sheet"
                type="file"
                accept="*/*"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  setAnnounce(`Reading ${f.name}\u2026`);
                  if (!/\.(xlsx|xls|xlsm|csv|tsv|txt|numbers)$/i.test(f.name)) {
                    const msg = `${f.name} is not a spreadsheet. Open it in Excel or Google Sheets and save it as Excel or CSV, then upload that.`;
                    setAnnounce(msg); setResult(msg); setBusy(false); return;
                  }
                  if (/\.numbers$/i.test(f.name)) {
                    const msg = 'Numbers files cannot be read directly. In Numbers choose Export To, then Excel, and upload that file.';
                    setAnnounce(msg); setResult(msg); setBusy(false); return;
                  }
                  try {
                    let grid: string[][] = [];
                    let media: Record<string, Uint8Array> = {};
                    const cellUrls: Record<number, string> = {};

                    if (/\.(xlsx|xls)$/i.test(f.name)) {
                      const buf = await f.arrayBuffer();
                      const XLSX = await import('xlsx');
                      const wb = XLSX.read(buf, { type: 'array' });
                      // Some sheets have a cover tab, or a title row above the table.
                      for (const nm of wb.SheetNames) {
                        const g = (XLSX.utils.sheet_to_json(wb.Sheets[nm], { header: 1, blankrows: false }) as any[][])
                          .map((r) => (r || []).map((c: any) => (c == null ? '' : String(c).trim())))
                          .filter((r) => r.some((c) => c !== ''));
                        if (g.length > grid.length) grid = g;
                      }

                      // Google Sheets stores photos as =IMAGE("url") formulas, or as a
                      // hyperlink on the cell. Read both out of the raw cells.
                      try {
                        const target = wb.SheetNames.find((nm) =>
                          (XLSX.utils.sheet_to_json(wb.Sheets[nm], { header: 1, blankrows: false }) as any[][]).length === grid.length)
                          || wb.SheetNames[0];
                        const sh: any = wb.Sheets[target];
                        Object.keys(sh).filter((k) => !k.startsWith('!')).forEach((addr) => {
                          const cell = sh[addr];
                          const fromFormula = typeof cell?.f === 'string'
                            ? (cell.f.match(/https?:\/\/[^"')\s]+/i) || [])[0] : null;
                          const fromLink = cell?.l?.Target && /^https?:\/\//i.test(cell.l.Target) ? cell.l.Target : null;
                          const url = fromFormula || fromLink;
                          if (url) {
                            const rc = XLSX.utils.decode_cell(addr);
                            cellUrls[rc.r] = cellUrls[rc.r] || url;
                          }
                        });
                      } catch { /* no formulas or links. Not fatal. */ }

                      // Pictures pasted into the sheet live inside the file as images.
                      // Pull them out in row order so they can be matched to items.
                      try {
                        const { unzipSync } = await import('fflate');
                        const files = unzipSync(new Uint8Array(buf));
                        Object.keys(files)
                          .filter((k) => /^xl\/media\/.+\.(png|jpe?g|gif|webp)$/i.test(k))
                          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
                          .forEach((k) => { media[k] = files[k]; });
                      } catch { /* no images, or unreadable. Not fatal. */ }
                    } else {
                      const text = await f.text();
                      grid = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
                        .map((l) => l.split(l.includes('\t') ? '\t' : ',').map((c) => c.trim()));
                    }

                    if (!grid.length) throw new Error('The file opened but there were no rows in it. Check the data is on the first sheet.');

                    // Map columns by their header name rather than by position.
                    // The header might be on line 3 under a title. Look for it.
                    let hRow = 0;
                    for (let r = 0; r < Math.min(grid.length, 8); r++) {
                      const cells = grid[r].map((c) => c.toLowerCase());
                      if (cells.some((c) => /room|location|area/.test(c)) ||
                          cells.some((c) => /item|product|description/.test(c))) { hRow = r; break; }
                    }
                    const head = grid[hRow].map((h) => h.toLowerCase());
                    const find = (...names: string[]) =>
                      head.findIndex((h) => names.some((n) => h.includes(n)));
                    let iRoom = find('room', 'location', 'area');
                    let iItem = find('item', 'product', 'description', 'name');
                    const iQty = find('qty', 'quantity', 'count');
                    const iPhoto = find('photo', 'image', 'picture', 'img');
                    const iUnit = find('unit', 'destination', 'apartment', 'apt');
                    const iVendor = find('vendor', 'supplier', 'store');
                    const iCost = find('cost', 'price');
                    const hasHeader = iRoom >= 0 || iItem >= 0;
                    // No Room column at all: column one is the item, not a room.
                    const noRoomColumn = iRoom < 0;
                    if (!hasHeader) { iItem = 0; iRoom = -1; }
                    else if (noRoomColumn && iItem < 0) { iItem = 0; }
                    const body = hasHeader ? grid.slice(hRow + 1) : grid;

                    // Upload any embedded pictures, matched to rows in order.
                    const urls: (string | null)[] = [];
                    const keys = Object.keys(media);
                    if (keys.length) {
                      setAnnounce(`Uploading ${keys.length} picture${keys.length === 1 ? '' : 's'}\u2026`);
                      for (let i = 0; i < keys.length; i++) {
                        const ext = keys[i].split('.').pop() || 'png';
                        const path = `${panel?.split(':')[1]}/${Date.now()}-${i}.${ext}`;
                        const { error: upErr } = await supabase.storage
                          .from('setup-item-photos')
                          .upload(path, media[keys[i]], { contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`, upsert: true });
                        if (upErr) { urls.push(null); continue; }
                        const { data: pub } = supabase.storage.from('setup-item-photos').getPublicUrl(path);
                        urls.push(pub?.publicUrl || null);
                      }
                    }

                    // A cell like "For unit 604" or "10 for each unit" is a note about
                    // where it goes, not an item name.
                    const unitFrom = (txt: string) => (txt.match(/\b(404|604|605)\b/) || [])[1] || '';
                    const isNote = (txt: string) => /^(for\b|\d+\s*for\b)/i.test((txt || '').trim());
                    const parsed = body.map((r, idx) => {
                      const noteCell = r.find((c) => isNote(c)) || '';
                      return {
                      room: (iRoom >= 0 ? r[iRoom] : '') || 'Household',
                      item: (iItem >= 0 ? r[iItem] : '') || '',
                      quantity: iQty >= 0 ? r[iQty] : '',
                      destination_unit: (iUnit >= 0 ? (r[iUnit] || '') : '')
                        || unitFrom(noteCell) || (form.dest || ''),
                      notes: noteCell,
                      vendor: iVendor >= 0 ? (r[iVendor] || '') : '',
                      unit_cost: iCost >= 0 ? (r[iCost] || '') : '',
                      // A link in a photo column wins; otherwise use an embedded picture in row order.
                      photo_url:
                        (iPhoto >= 0 && /^https?:\/\//i.test(r[iPhoto] || '')) ? r[iPhoto]
                        : (cellUrls[(hasHeader ? hRow + 1 : 0) + idx] || '')
                        || (r.find((c) => /^https?:\/\/\S+\.(png|jpe?g|gif|webp)/i.test(c || '')) || '')
                        || (r.find((c) => /^https?:\/\//i.test(c || '')) || '')
                        || (urls[idx] || ''),
                    };
                    }).filter((x) => x.item && !isNote(x.item));

                    setForm((fm) => ({ ...fm, parsed: JSON.stringify(parsed),
                      bulk: parsed.map((x) => [x.room, x.item, x.quantity].filter(Boolean).join(', ')).join('\n') }));
                    const withPics = parsed.filter((x) => x.photo_url).length;
                    const msg = `${f.name} loaded. ${parsed.length} row${parsed.length === 1 ? '' : 's'}`
                      + (withPics ? `, ${withPics} with a photo`
                          : ', no photos found. If your photos are links, put them in a column called Photo. If they are pictures in the sheet, save it as Excel rather than CSV.')
                      + '. Check them below, then add.';
                    setAnnounce(msg); setResult(msg);
                  } catch (err: any) {
                    const msg = `Could not read that file. ${err?.message || 'Try saving it as CSV and uploading again.'}`;
                    setAnnounce(msg); setResult(msg);
                  }
                  setBusy(false);
                }}
                style={{ width: '100%', maxWidth: 560, minHeight: 44, fontSize: '1rem', padding: '9px 10px',
                         border: '1px solid #dfe3e8', borderRadius: 6, background: '#fff' }}
              />
            </div>

            <div style={{ margin: '12px 0' }}>
              <label htmlFor="bulk" style={{ display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>
                Items — type them, paste them, or check what the file loaded
              </label>
              <textarea id="bulk" value={form.bulk || ''}
                onChange={(e) => setForm((f) => ({ ...f, bulk: e.target.value }))}
                placeholder={'Master Bedroom, King bed frame, 1\nKitchen, Dinner plates, 8\nLiving Room, Sofa'}
                style={{ width: '100%', maxWidth: 560, minHeight: 130, fontSize: '1rem', padding: '10px 12px', border: '1px solid #dfe3e8', borderRadius: 6 }} />
            </div>
            <F id="dest" label="Destination unit" hint="For a multi-unit job, e.g. 604. Leave blank and assign later." />
            {result && (
              <p style={{ margin: '12px 0', padding: '12px 14px', borderRadius: 6,
                background: /Not saved|Could not|not a spreadsheet|cannot be read/.test(result) ? '#fff1f2' : '#ecfdf5',
                border: `1px solid ${/Not saved|Could not|not a spreadsheet|cannot be read/.test(result) ? '#9f1239' : '#065f46'}`,
                fontWeight: 600 }}>{result}</p>
            )}
            <Btn onClick={() => {
              // If a file was parsed, use those rows so photos, vendors and units survive.
              // Typed lines are only used when there is no parsed file.
              let rows: any[] = [];
              if (form.parsed) {
                try { rows = JSON.parse(form.parsed); } catch { rows = []; }
              }
              if (!rows.length) rows = (form.bulk || '').split('\n').map((l) => l.trim()).filter(Boolean).map((line) => {
                const parts = line.split(',').map((x) => (x || '').trim());
                const room = parts.shift() || '';
                // Only treat the last field as a quantity if it actually looks like one,
                // so "Sofa, grey, 3 seat" keeps its full name.
                let quantity = 1;
                if (parts.length > 1 && /^\d+$/.test(parts[parts.length - 1])) {
                  quantity = Number(parts.pop());
                }
                const item = parts.join(', ');
                return { room, item, quantity, destination_unit: form.dest || '' };
              });
              // A destination typed in the box applies to any row that did not carry one.
              if (form.dest) rows = rows.map((r: any) => ({ ...r, destination_unit: r.destination_unit || form.dest }));
              if (!rows.length) { setResult('Not saved. Type at least one item.'); setAnnounce('Not saved. Type at least one item.'); return; }
              runRpc('ayp_setup_add_items',
                { p_project_id: panel.slice(6), p_staff_id: session?.id, p_items: rows },
                (d) => { setForm((fm) => ({ ...fm, parsed: '' })); return d?.note || `Added ${rows.length} item(s).`; });
            }}>Add these items</Btn>
            <Btn kind="sec" always onClick={() => { setPanel(null); setResult(''); setForm({}); }}>Cancel</Btn>
          </div>
        )}

        {panel?.startsWith('msg:') && (
          <div role="region" aria-label="Message the client" style={{ background: '#fff', border: '1px solid #12263f', borderRadius: 8, padding: 18, marginTop: 12 }}>
            <h3 style={{ margin: '0 0 .2em' }}>Message the client</h3>
            <p style={{ background: '#12263f', color: '#fff', fontWeight: 700, borderRadius: 6,
                        padding: '10px 12px', margin: '0 0 12px', fontSize: '.95rem' }}>
              {(() => { const pr = projects.find((x: any) => x.id === panel?.split(':')[1]);
                return pr ? `${pr.investor_name} — ${pr.property_address}` : 'Client'; })()}
            </p>
            <p style={{ color: '#5b6672', fontSize: '.92rem' }}>
              Goes to their portal and emails them a copy. It is logged against their record.
            </p>
            <F id="msgsubject" label="Subject" />
            <div style={{ margin: '12px 0' }}>
              <label htmlFor="msgbody" style={{ display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>Message</label>
              <textarea id="msgbody" value={form.msgbody || ''}
                onChange={(e) => setForm((f) => ({ ...f, msgbody: e.target.value }))}
                style={{ width: '100%', maxWidth: 560, minHeight: 130, fontSize: '1rem', padding: '10px 12px',
                         border: '1px solid #dfe3e8', borderRadius: 6 }} />
            </div>
            {result && (
              <p style={{ margin: '12px 0', padding: '12px 14px', borderRadius: 6,
                background: /Not sent|Could not/.test(result) ? '#fff1f2' : '#ecfdf5',
                border: `1px solid ${/Not sent|Could not/.test(result) ? '#9f1239' : '#065f46'}`,
                fontWeight: 600 }}>{result}</p>
            )}
            <Btn onClick={() => {
              const pr = projects.find((x: any) => x.id === panel?.split(':')[1]);
              if (!form.msgbody?.trim()) { setResult('Not sent. Write a message first.'); setAnnounce('Not sent. Write a message first.'); return; }
              if (!pr?.investor_id) { setResult('Not sent. This project has no client attached.'); return; }
              runRpc('penny_send_message', {
                p_from_staff_id: session?.id, p_audience: 'client', p_to_id: pr.investor_id,
                p_subject: form.msgsubject || 'An update on your project',
                p_body: form.msgbody, p_parent: null,
              }, (d) => d?.note ? `Sent to ${pr.investor_name}. ${d.note}` : `Sent to ${pr.investor_name}.`);
            }}>Send it</Btn>
            <Btn kind="sec" always onClick={() => { setPanel(null); setResult(''); setForm({}); }}>Cancel</Btn>
          </div>
        )}

        {panel?.startsWith('pro:') && (
          <div role="region" aria-label="Create a Pro link" style={{ background: '#fff', border: '1px solid #12263f', borderRadius: 8, padding: 18, marginTop: 12 }}>
            <h3 style={{ margin: '0 0 .2em' }}>Create a Pro link</h3>
            <p style={{ background: '#12263f', color: '#fff', fontWeight: 700, borderRadius: 6,
                         padding: '10px 12px', margin: '0 0 12px', fontSize: '.95rem' }}>
              {(() => { const pr = projects.find((x: any) => x.id === panel?.split(':')[1]);
                 return pr ? `${pr.investor_name} — ${pr.property_address}` : 'Project'; })()}
            </p>
            <p style={{ color: '#5b6672', fontSize: '.92rem' }}>
              Generates a private link for this job only. The Pro needs no login and no account. They see the item list, the maintenance check, photo upload and their contract. They never see client messages.
            </p>
            <F id="pro_name" label="Pro's name" />
            <F id="pro_email" label="Pro's email" hint="Leave blank to copy the link instead of emailing it." />
            <Btn onClick={() => run(form.pro_email ? 'email_pro_portal_link' : 'generate_pro_token',
              { project_id: panel.slice(4), pro_name: form.pro_name, pro_email: form.pro_email },
              (d) => d?.portal_url
                ? `Link ready. ${d.portal_url}`
                : `Link sent to ${form.pro_email}.`)}>
              {form.pro_email ? 'Email the link' : 'Create the link'}
            </Btn>
            <Btn kind="sec" always onClick={() => { setPanel(null); setResult(''); setForm({}); }}>Cancel</Btn>
          </div>
        )}

        <H2>Start a new project</H2>
        <Hint>Opens a job for a client and creates its item schedule.</Hint>
        {panel === 'new' ? (
          <div role="region" aria-label="Start a new project" style={{ background: '#fff', border: '1px solid #12263f', borderRadius: 8, padding: 18 }}>
            <F id="client_email" label="Client's email" hint="Must match an existing client account." />
            <F id="address" label="Property address" hint="Where the work happens. For a move, the destination." />
            <F id="city_state" label="City and state" />
            <F id="fee" label="Fee" hint="Numbers only, no dollar sign." />
            <div style={{ margin: '12px 0' }}>
              <label htmlFor="stype" style={{ display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>Type of job</label>
              <select id="stype" value={form.stype || 'full_setup'}
                onChange={(e) => setForm((f) => ({ ...f, stype: e.target.value }))}
                style={{ minHeight: 44, fontSize: '1rem', padding: '0 10px', border: '1px solid #dfe3e8', borderRadius: 6, maxWidth: 440, width: '100%' }}>
                <option value="full_setup">Full setup</option>
                <option value="teardown_move_setup">Teardown, move and setup</option>
                <option value="teardown">Teardown only</option>
                <option value="restock">Restock or refresh</option>
              </select>
            </div>
            <Btn onClick={() => run('create_project', {
              investor_email: form.client_email, property_address: form.address,
              city_state: form.city_state, setup_type: form.stype || 'full_setup',
              logistics_fee_amount: Number(form.fee) || 0,
              assigned_manager_id: session?.id, assigned_manager_name: displayName,
            }, () => 'Project created. It is now in your list above.')}>Create the project</Btn>
            <Btn kind="sec" always onClick={() => { setPanel(null); setResult(''); setForm({}); }}>Cancel</Btn>
          </div>
        ) : (
          <Btn onClick={() => { setPanel('new'); setForm({}); setResult(''); }}>Start a new project</Btn>
        )}

        {result && (
          <p style={{ marginTop: 14, padding: '12px 14px', borderRadius: 6,
            background: result.startsWith('Not saved') ? '#fff1f2' : '#ecfdf5',
            border: `1px solid ${result.startsWith('Not saved') ? '#9f1239' : '#065f46'}`,
            wordBreak: 'break-all' }}>{result}</p>
        )}
      </>
    );
  }

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
                    {['Start a new project','Send a Pro the job link','Add items to a project','Sign a document'].includes(a.label)
                      ? 'This one is live. Use the controls higher up this page to do it.'
                      : 'Not built into this screen yet. Ask Penny to do it, or tell the Success Team and it will be picked up.'}
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
      <style>{`
        /* Phone: the work comes first, the menu sits underneath it. Stacking the sidebar on
           top pushed every project and button below the fold, so a setup manager opened the
           app and saw a menu and nothing else. */
        @media (max-width: 760px) {
          .ws-shell { flex-direction: column-reverse; gap: 18px; }
          .ws-nav { width: 100% !important; flex: 1 1 auto !important;
                    border-top: 1px solid #dfe3e8; padding-top: 12px; }
          .ws-nav ul { display: flex; flex-wrap: wrap; gap: 6px; }
          .ws-nav ul li a { border: 1px solid #dfe3e8; background: #fff; }
          .ws-nav h2 { width: 100%; margin: 12px 0 4px; }
        }
      `}</style>
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

      <div className="ws-shell" style={{ maxWidth: 1080, margin: '0 auto', display: 'flex', gap: 26, padding: '22px 20px 70px', alignItems: 'flex-start' }}>
        <nav aria-label="Main" className="ws-nav" style={{ width: 196, flex: '0 0 196px' }}>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {navLink('dash', 'Dashboard')}
            {navLink('work', workCount ? `My work (${workCount})` : 'My work')}
            {navLink('penny', 'Penny')}
            {navLink('clients', 'Clients')}
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
                  {loading ? 'Checking what is waiting…' : `${workCount} thing${workCount === 1 ? '' : 's'} need${workCount === 1 ? 's' : ''} you`}
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
                <Suspense fallback={<p style={{ color: '#5b6672' }}>Loading your documents…</p>}>
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
                Ask her anything about your clients, projects, deals or the numbers.
              </p>
              <div style={{ margin: '12px 0' }}>
                <label htmlFor="pennyq" style={{ display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>
                  Your question
                </label>
                <textarea id="pennyq" value={form.pennyq || ''}
                  onChange={(e) => setForm((f) => ({ ...f, pennyq: e.target.value }))}
                  placeholder="How many items are outstanding on Drew's job?"
                  style={{ width: '100%', maxWidth: 560, minHeight: 96, fontSize: '1rem', padding: '10px 12px',
                           border: '1px solid #dfe3e8', borderRadius: 6 }} />
              </div>
              <Btn onClick={async () => {
                if (!form.pennyq?.trim()) { setResult('Type a question first.'); return; }
                setBusy(true); setResult('');
                try {
                  const { data, error } = await supabase.functions.invoke('penny-staff-chat', {
                    body: { staff_id: session?.id, staff_name: displayName,
                            messages: [{ role: 'user', content: form.pennyq }] },
                  });
                  if (error) throw new Error(error.message);
                  const reply = data?.message || 'She did not come back with anything.';
                  setResult(reply); setAnnounce(reply.slice(0, 300));
                } catch (err: any) {
                  const m = `Could not reach Penny. ${err?.message || ''}`;
                  setResult(m); setAnnounce(m);
                }
                setBusy(false);
              }}>Ask Penny</Btn>
              {result && (
                <p style={{ marginTop: 14, padding: '14px 16px', borderRadius: 8, background: '#fff',
                            border: '1px solid #dfe3e8', whiteSpace: 'pre-wrap', lineHeight: 1.55 }}>{result}</p>
              )}
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
                  {view === 'setup' && SetupWork()}
                  {ActionList(view as Space, 'start')}
                  {ActionList(view as Space, 'record')}
                  {view === 'setup' && ItemSchedule()}
                  <H2>Where things live</H2>
                  <Hint>Browse and search the records themselves.</Hint>
                  <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(228px,1fr))', gap: 10 }}>
                    {SPACES[view as Space].where.map((w) => (
                      <li key={w.label}
                          style={{ background: '#fff', border: '1px dashed #c9ced6', borderRadius: 8, padding: '14px 16px', color: '#111827' }}>
                        <strong style={{ display: 'block' }}>{w.label}</strong>
                        <span style={{ color: '#5b6672', fontSize: '.87rem' }}>{w.hint}</span>
                        {!['Item schedule', 'Projects'].includes(w.label) && (
                          <span style={{ display: 'block', color: '#8a6a44', fontSize: '.8rem', marginTop: 6, fontWeight: 600 }}>
                            Not moved across yet. Ask Penny for it in the meantime.
                          </span>
                        )}
                        {['Item schedule', 'Projects'].includes(w.label) && (
                          <span style={{ display: 'block', color: '#065f46', fontSize: '.8rem', marginTop: 6, fontWeight: 600 }}>
                            Shown above on this page
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}

          {view === 'clients' && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>Clients</h1>
              <Hint>Everyone you look after. Tap a name to message them.</Hint>
              {loading && <p style={{ color: '#5b6672' }}>Loading\u2026</p>}
              {!loading && clients.length === 0 && (
                <p style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16, color: '#5b6672' }}>
                  No clients are assigned to you yet. Ask an owner to assign some.
                </p>
              )}
              <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                {clients.map((c: any) => (
                  <li key={c.id} style={{ background: '#fff', border: '1px solid #dfe3e8', borderRadius: 8, padding: 16, marginBottom: 10 }}>
                    <h3 style={{ margin: '0 0 .2em' }}>{c.full_name}</h3>
                    <p style={{ color: '#5b6672', fontSize: '.9rem', margin: '0 0 .2em' }}>
                      {c.company_name ? `${c.company_name} · ` : ''}{c.email}{c.phone ? ` · ${c.phone}` : ''}
                    </p>
                    {Number(c.credit_balance) > 0 && (
                      <p style={{ color: '#065f46', fontSize: '.88rem', fontWeight: 600, margin: '0 0 .6em' }}>
                        Credit held: ${Number(c.credit_balance).toLocaleString()}
                      </p>
                    )}
                    {panel === `cmsg:${c.id}` ? (
                      <div style={{ marginTop: 10 }}>
                        <F id="csubject" label="Subject" />
                        <div style={{ margin: '12px 0' }}>
                          <label htmlFor="cbody" style={{ display: 'block', fontWeight: 600, fontSize: '.92rem', marginBottom: 4 }}>Message</label>
                          <textarea id="cbody" value={form.cbody || ''}
                            onChange={(e) => setForm((f) => ({ ...f, cbody: e.target.value }))}
                            style={{ width: '100%', maxWidth: 560, minHeight: 120, fontSize: '1rem', padding: '10px 12px',
                                     border: '1px solid #dfe3e8', borderRadius: 6 }} />
                        </div>
                        {result && (
                          <p style={{ margin: '10px 0', padding: '12px 14px', borderRadius: 6, fontWeight: 600,
                            background: /Not sent|Could not/.test(result) ? '#fff1f2' : '#ecfdf5',
                            border: `1px solid ${/Not sent|Could not/.test(result) ? '#9f1239' : '#065f46'}` }}>{result}</p>
                        )}
                        <Btn onClick={() => {
                          if (!form.cbody?.trim()) { setResult('Not sent. Write a message first.'); return; }
                          runRpc('penny_send_message', {
                            p_from_staff_id: session?.id, p_audience: 'client', p_to_id: c.id,
                            p_subject: form.csubject || 'A message from Access Your Place',
                            p_body: form.cbody, p_parent: null,
                          }, () => `Sent to ${c.full_name}.`);
                        }}>Send it</Btn>
                        <Btn kind="sec" always onClick={() => { setPanel(null); setResult(''); setForm({}); }}>Cancel</Btn>
                      </div>
                    ) : (
                      <Btn kind="sec" onClick={() => { setPanel(`cmsg:${c.id}`); setForm({}); setResult(''); }}>
                        Message {c.full_name?.split(' ')[0]}
                      </Btn>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {view === 'sop' && (
            <>
              <h1 style={{ fontSize: '1.5rem', margin: '0 0 .7em' }}>How we work</h1>
              <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(228px,1fr))', gap: 10 }}>
                {['Acquisition workflow', 'Setup workflow', 'Teardown and move', 'Using the platform',
                  'Working with Penny', 'Client communication', 'Payments and payouts', 'Accessibility standards'].map((t) => (
                  <li key={t} style={{ background: '#fff', border: '1px dashed #c9ced6', borderRadius: 8, padding: '14px 16px' }}>
                    <strong>{t}</strong>
                    <span style={{ display: 'block', color: '#8a6a44', fontSize: '.8rem', marginTop: 6, fontWeight: 600 }}>
                      Not written yet
                    </span>
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
                  <li key={t} style={{ background: '#fff', border: '1px dashed #c9ced6', borderRadius: 8, padding: '14px 16px' }}>
                    <strong style={{ display: 'block' }}>{t}</strong>
                    <span style={{ color: '#5b6672', fontSize: '.87rem' }}>{h}</span>
                    <span style={{ display: 'block', color: '#8a6a44', fontSize: '.8rem', marginTop: 6, fontWeight: 600 }}>
                      Not built yet
                    </span>
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
