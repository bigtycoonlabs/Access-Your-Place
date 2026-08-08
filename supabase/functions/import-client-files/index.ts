// import-client-files — loads the company's Master Client Record into client_files.
//
// WHY THE DATA COMES FROM THE REPO RATHER THAN A PASTED PAYLOAD: 490 records is about
// 130KB of SQL. Retyping that into a query is how a phone number loses a digit and nobody
// finds out for a year. The file is committed, this fetches it, and what was imported can
// be diffed against what is in version control.
//
// IDEMPOTENT BY EMAIL. Running it twice updates rather than duplicating. A duplicate client
// file is worse than none: two records for one person means two half-truths and staff
// trusting whichever they happened to open.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { 'Content-Type': 'application/json', ...corsHeaders } });

const SOURCE =
  'https://raw.githubusercontent.com/bigtycoonlabs/Access-Your-Place/main/data/master-client-record.json';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const url = Deno.env.get('SUPABASE_URL') || '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!url || !key) return json({ ok: false, error: 'Missing service credentials. Nothing was imported.' }, 500);

  try {
    const res = await fetch(SOURCE, { headers: { 'User-Agent': 'ayp-import' } });
    if (!res.ok) {
      return json({ ok: false, error: `Could not read the source file (${res.status}). Nothing was imported.` }, 502);
    }
    const data = await res.json();

    const rows: Record<string, unknown>[] = [];
    for (const c of data.clients || []) {
      rows.push({
        file_type: 'client', name: c.name, company: c.company, email: c.email,
        market: c.market, property: c.property, status: c.status, notes: c.notes,
        first_seen: c.first_seen, last_contact: c.last_contact,
      });
    }
    for (const l of data.landlords || []) {
      rows.push({
        file_type: 'landlord', name: l.name, company: l.company, email: l.email,
        market: l.market, property: l.property, status: l.status, notes: l.notes,
        last_contact: l.last_contact,
      });
    }
    for (const d of data.leads || []) {
      rows.push({
        file_type: 'lead', name: d.name, company: d.company, email: d.email, phone: d.phone,
        has_llc: d.has_llc, properties_owned: d.properties_owned, starter_capital: d.starter_capital,
        markets_of_interest: d.markets_of_interest, found_us_via: d.found_us_via,
        location: d.location, submitted: d.submitted,
      });
    }

    // Only rows with an email. Email is how a file is matched to a platform account and how
    // anyone gets contacted; without one the record cannot do either job.
    // Lowercased, because the unique index is on the column and "A@b.com" and "a@b.com"
    // would otherwise become two files for one person.
    for (const r of rows) {
      if (typeof r.email === 'string') r.email = (r.email as string).trim().toLowerCase();
    }
    const usable = rows.filter((r) => typeof r.email === 'string' && (r.email as string).includes('@'));

    // Deduplicate WITHIN the file too. Postgres rejects an ON CONFLICT batch that contains
    // the same key twice, so a single repeated address would fail an entire batch of 100.
    const seen = new Set<string>();
    const deduped = usable.filter((r) => {
      const e = r.email as string;
      if (seen.has(e)) return false;
      seen.add(e);
      return true;
    });
    const dupes = usable.length - deduped.length;
    const skipped = rows.length - usable.length;

    let written = 0;
    const failures: string[] = [];
    for (let i = 0; i < deduped.length; i += 100) {
      const batch = deduped.slice(i, i + 100);
      const r = await fetch(`${url}/rest/v1/client_files?on_conflict=email`, {
        method: 'POST',
        headers: {
          apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(batch),
      });
      if (r.ok) {
        written += batch.length;
      } else {
        // Reported per batch, not swallowed. A partial import that claims success is the
        // exact defect this platform keeps producing.
        const t = await r.text();
        console.error('import-client-files batch_failed', i, r.status, t.slice(0, 300));
        failures.push(`rows ${i}-${i + batch.length}: ${r.status}`);
      }
    }

    return json({
      ok: failures.length === 0,
      written,
      skipped_no_email: skipped,
      duplicate_emails_in_file: dupes,
      failed_batches: failures,
      total_in_file: rows.length,
      note: failures.length
        ? `Imported ${written} of ${deduped.length}. ${failures.length} batch(es) failed and are listed — this was NOT a clean import.`
        : `Imported ${written} client files. ${skipped} had no email, ${dupes} were duplicate addresses within the file itself.`,
    }, failures.length ? 207 : 200);
  } catch (e) {
    console.error('import-client-files threw', e instanceof Error ? e.message : String(e));
    return json({ ok: false, error: 'The import failed partway. Check the logs before rerunning.' }, 500);
  }
});
