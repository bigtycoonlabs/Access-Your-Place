// PostgREST on this project exposes ONLY the public schema, so forcing
// Accept-Profile: prj_X-ZoVQv6LKXT made every REST call in this function return
// 406 PGRST106 'Invalid schema'. Every prj_ table has a matching public view.
const DATA_SCHEMA = 'public';
const originalFetch = globalThis.fetch;
globalThis.fetch = (input: any, init: any = {}) => {
  const url = typeof input === 'string'
    ? input
    : input?.url?.toString?.() || input?.toString?.() || '';

  if (url.includes('/rest/v1/')) {
    const headers = new Headers(init.headers || {});
    headers.set('Accept-Profile', DATA_SCHEMA);
    headers.set('Content-Profile', DATA_SCHEMA);
    init = { ...init, headers };
  }

  return originalFetch(input, init);
};

// get-payment-methods
// The ONLY sanctioned read path for AYP payment rails.
//
// Every payment surface must call this rather than hardcoding a destination.
// Hardcoded copies are how manage-setup-tasks ended up quoting a stale Zelle
// address on a live fee email.
//
// Returns only rows where is_active is true, ordered by display_order, so the
// owner can retire a rail by flipping one flag rather than shipping code.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentMethodRow {
  id: string;
  method_type: string;
  label: string | null;
  details: Record<string, unknown> | null;
  instructions: string | null;
  is_active: boolean;
  display_order: number | null;
  updated_at: string | null;
}

// The exact strings a client must reproduce to pay us, per rail. These are the
// values that must NEVER be recited by an AI surface -- they are rendered in
// the UI with copy-to-clipboard so no character can be lost in transcription.
const COPYABLE_FIELDS: Record<string, { key: string; label: string }[]> = {
  zelle: [
    { key: 'tag', label: 'Zelle tag' },
    { key: 'email_fallback', label: 'Bank email fallback' },
  ],
  cashapp: [{ key: 'cashtag', label: 'Cashtag' }],
  bitcoin: [{ key: 'wallet_address', label: 'Bitcoin wallet address (BTC mainnet)' }],
  wire: [
    { key: 'account_name', label: 'Account name' },
    { key: 'account_number', label: 'Account number' },
    { key: 'routing_number', label: 'Routing number' },
  ],
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ success: false, error: 'Server configuration error' }, 500);

    const res = await fetch(
      `${url}/rest/v1/company_payment_methods?is_active=eq.true&select=*&order=display_order.asc`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` } },
    );

    if (!res.ok) {
      const body = await res.text();
      console.error('get-payment-methods read_failed', res.status, body.slice(0, 200));
      // Fail loudly. A payment page showing nothing is recoverable; a payment
      // page showing a guessed destination is not.
      return json({ success: false, error: 'Could not load payment methods' }, 502);
    }

    const rows = (await res.json()) as PaymentMethodRow[];

    const methods = (Array.isArray(rows) ? rows : []).map((row) => {
      const details = row.details && typeof row.details === 'object' ? row.details : {};
      const spec = COPYABLE_FIELDS[row.method_type] || [];

      // Only surface copyable values that actually exist, so the UI never
      // renders an empty field a client might mistake for a real destination.
      const fields = spec
        .map(({ key, label }) => {
          const value = details[key];
          return typeof value === 'string' && value.trim() ? { key, label, value: value.trim() } : null;
        })
        .filter(Boolean);

      return {
        id: row.id,
        method_type: row.method_type,
        label: row.label || row.method_type,
        instructions: row.instructions || '',
        fields,
        // Explains why the wire recipient name is the holding company rather
        // than the platform. Shown before the client sends, not after.
        recipient_note: typeof details.recipient_note === 'string' ? details.recipient_note : null,
        network: typeof details.network === 'string' ? details.network : null,
        display_order: row.display_order ?? 0,
        updated_at: row.updated_at,
      };
    });

    // A rail with no usable destination is worse than a missing rail.
    const usable = methods.filter((m) => m.fields.length > 0);
    const misconfigured = methods.filter((m) => m.fields.length === 0).map((m) => m.method_type);
    if (misconfigured.length) {
      console.error('get-payment-methods misconfigured_active_rails', misconfigured.join(','));
    }

    return json({
      success: true,
      methods: usable,
      misconfigured,
      count: usable.length,
    });
  } catch (error) {
    console.error('get-payment-methods threw', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Could not load payment methods' }, 500);
  }
});
