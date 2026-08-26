import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Staff had NO way to countersign anything. The Documents tab is an upload screen and never
// touched document_signatures, so clients signed and the company side stayed open forever.
// Permission lives in the database function, not in whether a button renders.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const json = (d: unknown, s = 200) =>
    new Response(JSON.stringify(d), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );
    const body = await req.json();
    const { action, staff_id } = body;
    if (!staff_id) return json({ success: false, error: 'staff_id required' }, 400);

    if (action === 'list') {
      const { data: who } = await supabase.from('staff_users')
        .select('role,department,roles').eq('id', staff_id).maybeSingle();
      const bag = [who?.role, who?.department, ...(Array.isArray(who?.roles) ? who!.roles : [])]
        .filter(Boolean).map((r: string) => String(r).toLowerCase()).join(' ');
      const isOwner = /owner|admin/.test(bag);
      const canSetup = /setup|success/.test(bag);

      const { data, error } = await supabase.from('staff_countersign_queue')
        .select('*').order('signed_at', { ascending: false });
      if (error) return json({ success: false, error: error.message });

      // Show everything so nobody wonders where a document went, but say plainly which ones
      // this person may sign and which belong to someone else.
      const rows = (data || []).map((d: any) => ({
        ...d,
        can_sign: !d.company_signed && d.signature_status === 'signed' &&
          (d.countersign_role === 'owner' ? isOwner : (isOwner || canSetup)),
        why_not: d.company_signed ? `Already countersigned by ${d.countersigned_by_name || 'a colleague'}`
          : d.signature_status !== 'signed' ? 'Waiting on the client to sign first'
          : (d.countersign_role === 'owner' && !isOwner) ? 'This one is for the owner to sign'
          : null,
      }));
      return json({ success: true, documents: rows,
        awaiting_you: rows.filter((r: any) => r.can_sign).length });
    }

    if (action === 'sign') {
      const { document_id, typed_name } = body;
      if (!document_id) return json({ success: false, error: 'document_id required' }, 400);
      const { data, error } = await supabase.rpc('ayp_countersign_document', {
        p_document_id: document_id, p_staff_id: staff_id, p_typed_name: typed_name ?? '',
      });
      if (error) return json({ success: false, error: error.message });
      const r = data as any;
      return json({ success: r?.ok === true, ...r });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, 400);
  } catch (e) {
    return json({ success: false, error: String(e) }, 500);
  }
});
