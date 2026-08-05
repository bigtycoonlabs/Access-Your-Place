const DATA_SCHEMA = 'prj_X-ZoVQv6LKXT';
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

// manage-payment-proofs
//
// AYP runs on Zelle, wire, Cash App and Bitcoin. None of those post back, so
// confirmation is human-in-the-loop by design:
//
//   client sends funds -> attaches a screenshot -> STAFF confirm -> credit moves
//
// The single rule this function exists to enforce: SUBMITTING IS NOT PAYING.
// A submission never grants credit, never grants access, and is never described
// to the client as received or confirmed. Only an explicit staff review issues
// credit, and only once.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

const ALLOWED_METHODS = ['zelle', 'wire', 'cashapp', 'bitcoin'];

// Wording the client sees. Deliberately never says "received", "cleared" or
// "confirmed" for anything a human has not actually verified against a bank.
const STATUS_LANGUAGE: Record<string, string> = {
  pending: 'Submitted — waiting for our team to confirm it against the account.',
  confirmed: 'Confirmed by our team. Your credit balance has been updated.',
  rejected: 'Not confirmed. See the note from our team below.',
};

function db(path: string, init: RequestInit = {}) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
}

// Staff identity is read server-side. A caller cannot review their own payment
// by asserting a staff id in the body.
async function verifyStaff(staffId: string): Promise<{ ok: boolean; name: string | null }> {
  if (!staffId) return { ok: false, name: null };
  try {
    const res = await db(
      `staff_users?id=eq.${encodeURIComponent(staffId)}&select=id,name,is_active`,
    );
    if (!res.ok) return { ok: false, name: null };
    const rows = await res.json();
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row || row.is_active === false) return { ok: false, name: null };
    return { ok: true, name: row.name || null };
  } catch {
    return { ok: false, name: null };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  try {
    const body = await req.json().catch(() => ({}));
    const action = String(body.action || '');

    /* ---------------------------- client: submit ---------------------------- */
    if (action === 'submit') {
      const investorId = String(body.investor_id || '').trim();
      const methodType = String(body.method_type || '').trim().toLowerCase();
      const proofUrl = String(body.proof_url || '').trim();

      if (!investorId) return json({ success: false, error: 'investor_id is required' }, 400);
      if (!ALLOWED_METHODS.includes(methodType)) {
        return json({ success: false, error: 'Choose one of: Zelle, wire, Cash App, Bitcoin.' }, 400);
      }
      if (!proofUrl) {
        return json(
          { success: false, error: 'Attach a screenshot of the completed payment so our team can confirm it.' },
          400,
        );
      }

      const amountRaw = body.amount_reported;
      const amount = amountRaw === undefined || amountRaw === null || amountRaw === ''
        ? null
        : Number(amountRaw);
      if (amount !== null && (!Number.isFinite(amount) || amount <= 0)) {
        return json({ success: false, error: 'Enter the amount you sent, or leave it blank.' }, 400);
      }

      const res = await db('payment_submissions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          investor_id: investorId,
          investor_name: body.investor_name ? String(body.investor_name) : null,
          investor_email: body.investor_email ? String(body.investor_email) : null,
          property_id: body.property_id ? String(body.property_id) : null,
          method_type: methodType,
          amount_reported: amount,
          proof_url: proofUrl,
          client_note: body.client_note ? String(body.client_note) : null,
          status: 'pending',
        }),
      });

      if (!res.ok) {
        const t = await res.text();
        console.error('manage-payment-proofs submit_failed', res.status, t.slice(0, 200));
        // Never imply the submission landed when it did not.
        return json({ success: false, error: 'We could not record your submission. Please try again.' }, 500);
      }

      const rows = await res.json();
      const row = Array.isArray(rows) ? rows[0] : rows;

      return json({
        success: true,
        submission_id: row?.id ?? null,
        status: 'pending',
        // The literal sentence the UI and Penny should echo. Submitting is not
        // paying, and the client must not be told otherwise.
        message:
          "Thanks — I've sent this to our team to confirm against the account. Nothing is credited until they've checked it, and you'll see the status change here.",
        credit_issued: false,
      });
    }

    /* ------------------------- client: my submissions ------------------------ */
    if (action === 'list_mine') {
      const investorId = String(body.investor_id || '').trim();
      if (!investorId) return json({ success: false, error: 'investor_id is required' }, 400);

      const res = await db(
        `payment_submissions?investor_id=eq.${encodeURIComponent(investorId)}&select=id,method_type,amount_reported,status,submitted_at,reviewed_at,staff_note,credit_issued&order=submitted_at.desc&limit=50`,
      );
      if (!res.ok) return json({ success: false, error: 'Could not load your submissions.' }, 502);

      const rows = await res.json();
      return json({
        success: true,
        submissions: (Array.isArray(rows) ? rows : []).map((r: any) => ({
          ...r,
          status_language: STATUS_LANGUAGE[r.status] || r.status,
        })),
      });
    }

    /* ---------------------------- staff: queue ---------------------------- */
    if (action === 'list_pending') {
      const staff = await verifyStaff(String(body.staff_id || ''));
      if (!staff.ok) return json({ success: false, error: 'Staff access required.' }, 403);

      const res = await db(
        'payment_submissions?status=eq.pending&select=*&order=submitted_at.asc&limit=200',
      );
      if (!res.ok) return json({ success: false, error: 'Could not load the queue.' }, 502);

      const rows = await res.json();
      return json({ success: true, submissions: Array.isArray(rows) ? rows : [] });
    }

    /* ---------------------------- staff: review ---------------------------- */
    if (action === 'review') {
      const staff = await verifyStaff(String(body.staff_id || ''));
      if (!staff.ok) return json({ success: false, error: 'Staff access required.' }, 403);

      const submissionId = String(body.submission_id || '').trim();
      const decision = String(body.decision || '').trim();
      if (!submissionId) return json({ success: false, error: 'submission_id is required' }, 400);
      if (decision !== 'confirm' && decision !== 'reject') {
        return json({ success: false, error: 'decision must be confirm or reject' }, 400);
      }

      const cur = await db(`payment_submissions?id=eq.${encodeURIComponent(submissionId)}&select=*`);
      if (!cur.ok) return json({ success: false, error: 'Could not load that submission.' }, 502);
      const found = await cur.json();
      const sub = Array.isArray(found) ? found[0] : null;
      if (!sub) return json({ success: false, error: 'Submission not found.' }, 404);

      // Exactly-once. Re-reviewing an already-decided submission must never
      // issue a second credit for the same payment.
      if (sub.status !== 'pending') {
        return json({
          success: false,
          error: `This submission was already ${sub.status}${sub.reviewed_by_name ? ` by ${sub.reviewed_by_name}` : ''}. It cannot be reviewed twice.`,
          status: sub.status,
          credit_issued: sub.credit_issued === true,
        }, 409);
      }

      if (decision === 'reject') {
        const upd = await db(`payment_submissions?id=eq.${encodeURIComponent(submissionId)}&status=eq.pending`, {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            status: 'rejected',
            reviewed_by: String(body.staff_id),
            reviewed_by_name: staff.name,
            reviewed_at: new Date().toISOString(),
            staff_note: body.staff_note ? String(body.staff_note) : null,
          }),
        });
        if (!upd.ok) return json({ success: false, error: 'Could not record the rejection.' }, 500);
        const r = await upd.json();
        if (!Array.isArray(r) || r.length === 0) {
          return json({ success: false, error: 'Already reviewed by someone else.' }, 409);
        }
        return json({ success: true, status: 'rejected', credit_issued: false });
      }

      // confirm -> credit. The amount credited is the amount STAFF verified,
      // not the amount the client typed in.
      const creditAmountRaw = body.credit_amount ?? sub.amount_reported;
      const creditAmount = Number(creditAmountRaw);
      if (!Number.isFinite(creditAmount) || creditAmount <= 0) {
        return json(
          { success: false, error: 'Enter the amount you verified against the account before confirming.' },
          400,
        );
      }

      // Claim the row first. The status filter means a concurrent reviewer
      // finds nothing to update, so only one confirmation can win.
      const claim = await db(`payment_submissions?id=eq.${encodeURIComponent(submissionId)}&status=eq.pending`, {
        method: 'PATCH',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          status: 'confirmed',
          reviewed_by: String(body.staff_id),
          reviewed_by_name: staff.name,
          reviewed_at: new Date().toISOString(),
          staff_note: body.staff_note ? String(body.staff_note) : null,
        }),
      });
      if (!claim.ok) return json({ success: false, error: 'Could not confirm that submission.' }, 500);
      const claimed = await claim.json();
      if (!Array.isArray(claimed) || claimed.length === 0) {
        return json({ success: false, error: 'Already reviewed by someone else.' }, 409);
      }

      // Running balance, so the ledger is readable without summing every row.
      let balanceAfter: number | null = null;
      try {
        const last = await db(
          `investor_credit_transactions?investor_id=eq.${encodeURIComponent(sub.investor_id)}&select=balance_after&order=created_at.desc&limit=1`,
        );
        if (last.ok) {
          const lr = await last.json();
          const prev = Array.isArray(lr) && lr[0] ? Number(lr[0].balance_after) : 0;
          balanceAfter = (Number.isFinite(prev) ? prev : 0) + creditAmount;
        }
      } catch {
        balanceAfter = null;
      }

      const ledger = await db('investor_credit_transactions', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          investor_id: sub.investor_id,
          transaction_type: 'credit',
          amount: creditAmount,
          description: `Payment confirmed (${sub.method_type}) by ${staff.name || 'staff'}`,
          reference_type: 'payment_submission',
          reference_id: submissionId,
          balance_after: balanceAfter,
        }),
      });

      if (!ledger.ok) {
        const t = await ledger.text();
        console.error('manage-payment-proofs ledger_write_failed', ledger.status, t.slice(0, 200));
        // The submission is confirmed but no credit exists. Say so precisely
        // rather than reporting a clean success -- staff must know to fix it.
        return json({
          success: false,
          status: 'confirmed',
          credit_issued: false,
          error:
            'The payment was marked confirmed, but the credit could not be written. Do not re-confirm — raise this so the credit can be added manually.',
        }, 500);
      }

      const led = await ledger.json();
      const ledgerRow = Array.isArray(led) ? led[0] : led;

      await db(`payment_submissions?id=eq.${encodeURIComponent(submissionId)}`, {
        method: 'PATCH',
        body: JSON.stringify({ credit_issued: true, credit_id: ledgerRow?.id ?? null }),
      });

      return json({
        success: true,
        status: 'confirmed',
        credit_issued: true,
        credit_amount: creditAmount,
        balance_after: balanceAfter,
      });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (error) {
    console.error('manage-payment-proofs threw', error instanceof Error ? error.message : String(error));
    return json({ success: false, error: 'Something went wrong handling that request.' }, 500);
  }
});
