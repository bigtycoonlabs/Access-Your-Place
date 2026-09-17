import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Who visited, where they came from, and how far they got. Staff and test traffic are left
// out. Written to be read top to bottom by a screen reader: each section is a heading and
// each figure is a sentence, not a chart.

type Step = { step: string; visitors: number };
const people = (n: number) => `${n} ${n === 1 ? 'visitor' : 'visitors'}`;
const pct = (n: number, of: number) => (of > 0 ? `${Math.round((n / of) * 100)}%` : '0%');
const EVENT_NAMES: Record<string, string> = {
  page_time: 'Time on page recorded', cta_clicked: 'Main button clicked', deal_opened: 'Deal opened',
  acquire_clicked: 'Start Your Acquisition clicked', deal_question_opened: 'Deal question opened',
  deal_inquiry_submitted: 'Deal question sent', start_door_selected: 'Start form choice made',
  start_form_started: 'Start form touched', start_form_error: 'Start form error shown',
  start_form_submitted: 'Start form sent', login_success: 'Signed in', login_failed: 'Sign-in failed',
  account_created: 'Account created', signup_failed: 'Sign-up failed', penny_chat_started: 'Penny chat started',
  penny_chat_message: 'Penny message sent', call_clicked: 'Phone number tapped', email_clicked: 'Email link tapped',
  outbound_clicked: 'Link to another site clicked', press_request_sent: 'Press request sent', career_interest_sent: 'Careers form sent',
};
const DOORS: Record<string, string> = {
  sell_operation: 'Selling an operation', need_property: 'Acquisition', setup_services: 'Setup services',
  teardown_services: 'Teardown and moves', have_property: 'Landlords and communities',
  live_operation_help: 'Urgent live operation', verify_scan: 'Verify a Penny scan',
  career_interest: 'Careers', press_inquiry: 'Press and media',
};

function Funnel({ title, steps }: { title: string; steps: Step[] }) {
  const top = steps[0]?.visitors || 0;
  return (
    <section style={{ marginTop: 18 }}>
      <h3 style={{ fontSize: '1rem', margin: '0 0 6px' }}>{title}</h3>
      <ol style={{ margin: 0, paddingLeft: 22 }}>
        {steps.map((s, i) => (
          <li key={s.step} style={{ margin: '4px 0' }}>
            {s.step}: {s.visitors} {s.visitors === 1 ? 'visitor' : 'visitors'}
            {i > 0 && `, ${pct(s.visitors, steps[i - 1].visitors)} of the step before and ${pct(s.visitors, top)} of the start`}.
          </li>
        ))}
      </ol>
    </section>
  );
}

export function StaffAnalytics() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setData(null); setError('');
      let token = '';
      try { token = JSON.parse(localStorage.getItem('staffSession') || '{}')?.session_token || ''; } catch { /* none */ }
      const { data: out, error: err } = await supabase.rpc('ayp_analytics_report', { p_session_token: token, p_days: days });
      if (cancelled) return;
      if (err) setError('Could not load analytics. This is a server problem, not your account.');
      else if (!out?.ok) setError(out?.error || 'Could not load analytics.');
      else setData(out);
    })();
    return () => { cancelled = true; };
  }, [days]);

  const f = data?.funnels;
  return (
    <div>
      <label htmlFor="an-days" style={{ display: 'block', fontWeight: 600 }}>Period</label>
      <select id="an-days" value={days} onChange={(e) => setDays(Number(e.target.value))} style={{ minHeight: 44, padding: '0 8px' }}>
        <option value={7}>Last 7 days</option>
        <option value={30}>Last 30 days</option>
        <option value={90}>Last 90 days</option>
        <option value={365}>Last 12 months</option>
      </select>

      <div role="status" aria-live="polite" style={{ marginTop: 10 }}>
        {error ? error : !data ? 'Loading analytics.' : `${data.visitors} visitors and ${data.pageviews} page views in the last ${days} days. Staff and test traffic are not counted.`}
      </div>

      {data && (
        <>
          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Where visitors came from</h2>
            <p style={{ margin: '0 0 6px' }}>"Direct" means typed in, bookmarked, or from an app that does not say where it sent them.</p>
            <ul style={{ margin: 0, paddingLeft: 22 }}>
              {data.sources.map((s: any) => (
                <li key={s.source}>{s.source}: {people(s.visitors)}, {s.leads} sent the start form, {s.accounts} created an account.</li>
              ))}
            </ul>
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Funnels</h2>
            <Funnel title="Marketplace" steps={f.marketplace} />
            <Funnel title="Start form" steps={f.start_form} />
            <Funnel title="Accounts" steps={f.accounts} />
            <p style={{ marginTop: 10 }}>{data.penny_chats} visitors chatted with Penny on the public site.</p>
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Submissions by type</h2>
            {data.leads_by_kind.length === 0 ? <p>No start form submissions in this period.</p> : (
              <ul style={{ margin: 0, paddingLeft: 22 }}>
                {data.leads_by_kind.map((l: any) => <li key={l.kind}>{DOORS[l.kind] || l.kind}: {l.count}.</li>)}
              </ul>
            )}
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Pages people arrived on</h2>
            <ol style={{ margin: 0, paddingLeft: 22 }}>
              {data.landing_pages.map((p: any) => <li key={p.page}>{p.page}: {people(p.visitors)}.</li>)}
            </ol>
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Most viewed pages</h2>
            <ol style={{ margin: 0, paddingLeft: 22 }}>
              {data.top_pages.map((p: any) => <li key={p.page}>{p.page}: {p.views} views.</li>)}
            </ol>
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Actions</h2>
            {data.events.length === 0 ? <p>No actions recorded yet in this period. Action tracking started on 16 September 2026.</p> : (
              <ul style={{ margin: 0, paddingLeft: 22 }}>
                {data.events.map((e: any) => <li key={e.name}>{EVENT_NAMES[e.name] || e.name}: {e.count} {e.count === 1 ? 'time' : 'times'} by {people(e.visitors)}.</li>)}
              </ul>
            )}
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Devices</h2>
            <p>{data.devices.map((d: any) => `${d.device}: ${d.visitors}`).join('. ')}.</p>
          </section>

          <section style={{ marginTop: 18 }}>
            <h2 style={{ fontSize: '1.1rem', margin: '0 0 6px' }}>Tracking your own links</h2>
            <p>Add utm_source to any link you share and visits from it are credited by name. For example, accessyourplace.com/start?utm_source=instagram&amp;utm_campaign=cleveland_lofts. Open accessyourplace.com/?internal=1 once on your own phone or computer and your browsing will not be counted.</p>
          </section>
        </>
      )}
    </div>
  );
}
