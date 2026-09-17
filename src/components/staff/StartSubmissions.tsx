import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

// Everything that came in through accessyourplace.com/start, grouped by door, with the
// answers and photos the person sent. Until this existed, leads were fetched by an old
// dashboard and never shown anywhere; the only record was the notification email.

const DOOR_NAMES: Record<string, string> = {
  sell_operation: 'Selling an operation',
  need_property: 'Acquisition',
  setup_services: 'Setup services',
  teardown_services: 'Teardown and moves',
  have_property: 'Landlords and communities',
  live_operation_help: 'Urgent: live operation',
  verify_scan: 'Verify a Penny scan',
  career_interest: 'Careers',
  press_inquiry: 'Press and media',
};
const ORDER = ['live_operation_help', 'press_inquiry', 'career_interest', 'sell_operation', 'need_property', 'have_property', 'setup_services', 'teardown_services', 'verify_scan'];

const LABELS: Record<string, string> = {
  role: 'They are', company: 'Company or community', unit_type: 'Unit', bedrooms: 'Bedrooms', bathrooms: 'Bathrooms',
  sleeps: 'Sleeps', units_count: 'Units', platforms: 'Booking channels', listing_links: 'Listing links',
  monthly_rent: 'Monthly rent', avg_monthly_revenue: 'Average monthly revenue', peak_month_revenue: 'Best month',
  slow_month_revenue: 'Slowest month', asking_price: 'Asking price', years_operating: 'Operating for',
  furnished_items: 'What transfers or moves', bookings_transfer: 'Upcoming bookings', landlord_approval: 'Lease transfer',
  lease_end: 'Lease ends', deposit: 'Deposit', available_date: 'Available or hand over by', reason: 'Why selling',
  markets: 'Markets', budget: 'Budget', strategy: 'Strategy', timeline: 'Timeline', experience: 'Units run today',
  has_llc: 'Has an LLC', property_preference: 'Looking for', unit_status: 'Condition', lease_start: 'Lease start',
  style: 'Style', service_needed: 'Service needed', destination: 'Moving to', needed_by: 'Needed by',
  rent_range: 'Rent range', interest: 'Interested in', platform: 'Platform', experience_summary: 'Experience', links: 'Links', outlet: 'Outlet or show', media_type: 'Type of request', who: 'Would like to speak with', deadline: 'Deadline or recording date', audience: 'Audience', topic: 'Topic', allowed_uses: 'Uses allowed', furnished: 'Furnished', amenities: 'Amenities', issue: 'What is wrong',
};
const MONEY = new Set(['monthly_rent', 'avg_monthly_revenue', 'peak_month_revenue', 'slow_month_revenue', 'asking_price']);

function show(k: string, v: unknown): string {
  if (Array.isArray(v)) return v.join(', ');
  if (typeof v === 'number' && MONEY.has(k)) return `$${v.toLocaleString('en-US')}`;
  return String(v);
}

export function StartSubmissions() {
  const [leads, setLeads] = useState<any[] | null>(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.functions.invoke('get-leads');
      if (data?.success) setLeads(data.leads || []);
      else {
        const ctx = (error as any)?.context;
        const parsed = ctx && typeof ctx.clone === 'function' ? await ctx.clone().json().catch(() => null) : null;
        setError(parsed?.error || data?.error || 'Could not load submissions. This is a server problem, not your account.');
      }
    })();
  }, []);

  if (error) return <p role="alert">{error}</p>;
  if (!leads) return <p role="status">Loading submissions.</p>;

  const counts: Record<string, number> = {};
  for (const l of leads) counts[l.form_type] = (counts[l.form_type] || 0) + 1;
  const shown = leads.filter((l) => filter === 'all' || l.form_type === filter);

  return (
    <div>
      <p>{leads.length === 0 ? 'Nothing has come in through the start form yet.' : `${leads.length} submissions in total.`}</p>
      <label htmlFor="sub-filter" style={{ display: 'block', fontWeight: 600, marginTop: 12 }}>Show</label>
      <select id="sub-filter" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ minHeight: 44, padding: '0 8px' }}>
        <option value="all">All ({leads.length})</option>
        {ORDER.filter((k) => counts[k]).map((k) => <option key={k} value={k}>{DOOR_NAMES[k]} ({counts[k]})</option>)}
      </select>

      {shown.map((l) => {
        const d = l.form_data?.details || {};
        const photos: string[] = l.form_data?.photo_urls || [];
        const when = new Date(l.created_at).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
        return (
          <article key={l.id} style={{ borderTop: '1px solid #d5dbe1', marginTop: 18, paddingTop: 12 }}>
            <h3 style={{ fontSize: '1.05rem', margin: 0 }}>
              {l.name}, {DOOR_NAMES[l.form_type] || l.form_type}{l.urgency === 'emergency' ? ', urgent' : ''}
            </h3>
            <p style={{ margin: '4px 0' }}>Sent {when}. Status: {l.status || 'new'}.</p>
            <p style={{ margin: '4px 0' }}>
              <a href={`mailto:${l.email}`}>{l.email}</a>{l.phone ? <>, <a href={`tel:${l.phone}`}>{l.phone}</a></> : null}
            </p>
            <dl style={{ margin: '8px 0' }}>
              {l.city && <><dt style={{ fontWeight: 600 }}>City</dt><dd style={{ margin: '0 0 6px' }}>{l.city}</dd></>}
              {l.property_address && <><dt style={{ fontWeight: 600 }}>Address</dt><dd style={{ margin: '0 0 6px' }}>{l.property_address}</dd></>}
              {Object.entries(d).map(([k, v]) => (
                <div key={k}><dt style={{ fontWeight: 600 }}>{LABELS[k] || k.replace(/_/g, ' ')}</dt><dd style={{ margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{show(k, v)}</dd></div>
              ))}
              {l.message && <><dt style={{ fontWeight: 600 }}>Their message</dt><dd style={{ margin: '0 0 6px', whiteSpace: 'pre-wrap' }}>{l.message}</dd></>}
            </dl>
            {photos.length > 0 ? (
              <>
                <p style={{ margin: '4px 0' }}>{photos.length} photo{photos.length === 1 ? '' : 's'}. Links work for one hour after this page loads.</p>
                <ul style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0 }}>
                  {photos.map((u, i) => (
                    <li key={u}><a href={u} target="_blank" rel="noreferrer">
                      <img src={u} alt={`Photo ${i + 1} from ${l.name}`} style={{ width: 120, height: 90, objectFit: 'cover', borderRadius: 6 }} />
                    </a></li>
                  ))}
                </ul>
              </>
            ) : (Array.isArray(l.form_data?.photos) && l.form_data.photos.length === 0 && ['sell_operation'].includes(l.form_type))
              ? <p>No photos were sent.</p> : null}
          </article>
        );
      })}
    </div>
  );
}
