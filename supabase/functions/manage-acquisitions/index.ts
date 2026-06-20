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
// manage-acquisitions v2.3 - Direct PostgREST REST API
// v2.0: Migrated from createClient to fix 'Authorization token is required' bug
// v2.1: Fix create_acquisition to populate full_address (NOT NULL)
// v2.2: Fix JSON array handling for notes_history/stage_history PATCH operations
// v2.3: Added cleanup_test_data action for E2E test cleanup
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const stageLabels: Record<string, string> = {
  application_review: 'Application Review',
  landlord_negotiation: 'Landlord Negotiation',
  lease_signing: 'Lease Signing',
  property_setup: 'Property Setup',
  operations_handoff: 'Operations Handoff',
  completed: 'Completed'
};

const stageDescriptions: Record<string, string> = {
  landlord_negotiation: 'Your application has been approved! We are now negotiating with the landlord.',
  lease_signing: 'Landlord has agreed! We are preparing lease documents for signing.',
  property_setup: 'Lease signed! We are now setting up the property for operations.',
  operations_handoff: 'Property setup complete! Handing off to operations team.',
  completed: 'Congratulations! Your acquisition is complete and the property is live.'
};

// Safe array extractor - handles null, undefined, objects, strings, and arrays
function toArray(val: any): any[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  if (typeof val === 'object' && Object.keys(val).length === 0) return [];
  return [];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const mutHeaders = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    };

    const getH = {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json'
    };

    const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

    async function db(table: string, method: string, query = '', data?: any) {
      const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
      const opts: any = { method, headers: method === 'GET' ? getH : mutHeaders };
      if (data && (method === 'POST' || method === 'PATCH')) {
        opts.body = JSON.stringify(data);
      }
      const res = await fetch(url, opts);
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { ok: res.ok, status: res.status, data: parsed };
    }

    // DELETE helper - uses getH (no Prefer header needed)
    async function dbDelete(table: string, query: string) {
      const url = `${SUPABASE_URL}/rest/v1/${table}${query}`;
      const res = await fetch(url, { method: 'DELETE', headers: getH });
      const text = await res.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { parsed = text; }
      return { ok: res.ok, status: res.status, data: parsed, deleted: res.ok };
    }

    async function createNotification(investorId: string, type: string, title: string, message: string, notifData: any) {
      try {
        await db('investor_notifications', 'POST', '', {
          investor_id: investorId, type, title, message, data: notifData,
          read: false, created_at: new Date().toISOString()
        });
        console.log('[v2.3] Notification created:', type);
      } catch (e) { console.warn('[v2.3] Notification failed:', e); }
    }

    async function sendEmail(to: string, subject: string, html: string) {
      if (!RESEND_API_KEY) return;
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: 'Access Your Place <notifications@accessyourplace.com>', to: [to], subject, html })
        });
      } catch (e) { console.error('[v2.3] Email error:', e); }
    }

    async function getInvestorInfo(investorId: string) {
      let inv: any = null;
      const r1 = await db('investor_profiles', 'GET', `?id=eq.${investorId}&select=full_name,email`);
      inv = Array.isArray(r1.data) ? r1.data[0] : null;
      if (!inv) {
        const r2 = await db('investors', 'GET', `?id=eq.${investorId}&select=full_name,email`);
        inv = Array.isArray(r2.data) ? r2.data[0] : null;
      }
      return inv;
    }

    async function checkAndQualifyReferral(investorId: string, acquisitionId: string, address: string) {
      try {
        const invResult = await db('investor_profiles', 'GET', `?id=eq.${investorId}&select=referred_by,full_name,email`);
        const investor = Array.isArray(invResult.data) ? invResult.data[0] : null;
        if (!investor?.referred_by) return;
        const countResult = await db('investor_acquisitions', 'GET', `?investor_id=eq.${investorId}&select=id`);
        if ((Array.isArray(countResult.data) ? countResult.data : []).length > 1) return;
        const refResult = await db('investor_referrals', 'GET', `?referred_id=eq.${investorId}&status=eq.signed_up&select=*`);
        const referral = Array.isArray(refResult.data) ? refResult.data[0] : null;
        if (!referral) return;
        await db('investor_referrals', 'PATCH', `?id=eq.${referral.id}`, { status: 'qualified', qualified_at: new Date().toISOString(), first_acquisition_id: acquisitionId });
        await db('referral_rewards', 'POST', '', { referral_id: referral.id, referrer_id: referral.referrer_id, amount: 300, status: 'pending', reward_type: 'acquisition_bonus' });
        if (referral.referrer_id) {
          await createNotification(referral.referrer_id, 'referral_qualified', 'Referral Qualified!',
            `Your referral ${investor.full_name} completed their first acquisition at ${address}! $300 reward pending.`, { referral_id: referral.id });
        }
      } catch (e) { console.warn('[v2.3] Referral check failed:', e); }
    }

    async function createPortfolioEntry(acquisitionId: string, investorId: string) {
      try {
        const acqResult = await db('investor_acquisitions', 'GET', `?id=eq.${acquisitionId}&select=*`);
        const acq = Array.isArray(acqResult.data) ? acqResult.data[0] : null;
        if (!acq) { console.error('[v2.3] Acquisition not found:', acquisitionId); return; }
        const existingResult = await db('investor_portfolio', 'GET', `?investor_id=eq.${investorId}&acquisition_id=eq.${acquisitionId}&select=id`);
        if (Array.isArray(existingResult.data) && existingResult.data.length > 0) { console.log('[v2.3] Portfolio already exists'); return; }

        const acqFee = Number(acq.acquisition_fee) || 0;
        const address = acq.property_address || acq.full_address || '';
        const city = acq.property_city || acq.city || '';
        const state = acq.property_state || acq.state || '';

        let insertResult = await db('investor_portfolio', 'POST', '?select=id', {
          investor_id: investorId, acquisition_id: acquisitionId,
          address, city, state, zip_code: acq.zip_code || '',
          monthly_rent: Number(acq.monthly_rent) || 0, acquisition_fee: acqFee,
          property_status: 'pending', acquisition_source: 'ayp', acquired_through_ayp: true,
          lease_agreements_received: false, credit_amount: acqFee,
          credit_status: acqFee > 0 ? 'pending' : 'none',
          property_type: acq.property_type || 'residential', operation_type: acq.operation_type || 'str',
          added_by_staff: true, acquisition_manager: acq.assigned_am || '',
          acquisition_date: new Date().toISOString()
        });

        if (!insertResult.ok) {
          console.warn('[v2.3] Full portfolio insert failed, trying fallback:', insertResult.data);
          insertResult = await db('investor_portfolio', 'POST', '?select=id', {
            investor_id: investorId, address, city, state,
            property_status: 'pending', acquisition_source: 'ayp', acquired_through_ayp: true,
            acquisition_fee: acqFee, lease_agreements_received: false,
            credit_status: acqFee > 0 ? 'pending' : 'none', credit_amount: acqFee,
          });
          if (!insertResult.ok) { console.error('[v2.3] Fallback also failed:', insertResult.data); return; }
        }

        const inserted = Array.isArray(insertResult.data) ? insertResult.data[0] : insertResult.data;
        console.log('[v2.3] Portfolio entry created:', inserted?.id);

        if (acqFee > 0 && inserted?.id) {
          await db('portfolio_credits', 'POST', '', {
            investor_id: investorId, portfolio_property_id: inserted.id,
            credit_amount: acqFee, credit_reason: `Acquisition fee credit for ${address}`, credit_status: 'pending_approval'
          });
        }

        await createNotification(investorId, 'portfolio_update', 'Property Added to Portfolio',
          `Your acquisition at ${address}, ${city}, ${state} is complete and in your portfolio!`,
          { acquisition_id: acquisitionId, address, portfolio_id: inserted?.id });

        const inv = await getInvestorInfo(investorId);
        if (inv?.email) {
          await sendEmail(inv.email, 'Acquisition Complete - Property Added to Your Portfolio!',
            `<h2>Acquisition Complete!</h2><p>Hi ${inv.full_name},</p><p>${address}, ${city}, ${state} has been added to your portfolio.</p><p><a href="https://accessyourplace.com/investor">View Your Portfolio</a></p>`);
        }
      } catch (err) { console.error('[v2.3] createPortfolioEntry error:', err); }
    }

    const body = await req.json();
    const { action } = body;
    console.log('[manage-acquisitions v2.3] Action:', action);

    // ==================== GET ACQUISITIONS ====================
    if (action === 'get_acquisitions') {
      const { investor_id, status } = body;
      let query = '?select=*&order=created_at.desc';
      if (investor_id) query += `&investor_id=eq.${investor_id}`;
      if (status) query += `&status=eq.${status}`;
      const result = await db('investor_acquisitions', 'GET', query);
      if (!result.ok) return json({ error: 'Failed to fetch acquisitions', details: result.data }, 500);
      return json({ acquisitions: Array.isArray(result.data) ? result.data : [] });
    }

    // ==================== CREATE ACQUISITION ====================
    if (action === 'create_acquisition') {
      const { investor_id, property_id, property_address, property_city, property_state, acquisition_fee, monthly_rent, notes, assigned_am, property_type, operation_type, zip_code } = body;
      const fullAddress = [property_address, property_city, property_state].filter(Boolean).join(', ');
      if (!fullAddress) return json({ error: 'property_address is required' }, 400);

      const insertData: any = {
        investor_id, full_address: fullAddress,
        city: property_city || null, state: property_state || null, zip_code: zip_code || null,
        property_address, property_city, property_state, property_type, operation_type,
        acquisition_fee: acquisition_fee || 0, monthly_rent: monthly_rent || 0,
        notes, assigned_am, assigned_staff: assigned_am || null,
        status: 'active', workflow_stage: 'application_review', workflow_status: 'in_progress', application_status: 'pending',
        stage_history: [], notes_history: []
      };
      if (property_id) insertData.property_id = property_id;

      const insertResult = await db('investor_acquisitions', 'POST', '?select=*', insertData);
      if (!insertResult.ok) return json({ error: 'Failed to create acquisition', details: insertResult.data }, 500);
      const data = Array.isArray(insertResult.data) ? insertResult.data[0] : insertResult.data;
      console.log('[v2.3] Acquisition created:', data?.id);

      const inv = await getInvestorInfo(investor_id);
      if (inv) {
        await createNotification(investor_id, 'acquisition_started', 'Acquisition Started!',
          `Your acquisition for ${property_address} has been initiated. Current stage: Application Review.`, { acquisition_id: data?.id });
        if (inv.email) await sendEmail(inv.email, 'Acquisition Started', `<h2>Your Acquisition Has Started!</h2><p>Hi ${inv.full_name},</p><p>Acquisition for <strong>${fullAddress}</strong> initiated. Stage: Application Review.</p>`);
      }
      return json({ acquisition: data });
    }

    // ==================== UPDATE STAGE ====================
    if (action === 'update_stage') {
      const { acquisition_id, stage, notes, staff_name } = body;
      if (!acquisition_id || !stage) return json({ error: 'acquisition_id and stage are required' }, 400);

      const currentResult = await db('investor_acquisitions', 'GET', `?id=eq.${acquisition_id}&select=*`);
      const current = Array.isArray(currentResult.data) ? currentResult.data[0] : null;
      if (!current) return json({ error: 'Acquisition not found' }, 404);

      const stageHistory = toArray(current.stage_history);
      stageHistory.push({ from: current.workflow_stage, to: stage, date: new Date().toISOString(), notes: notes || null, by: staff_name || 'Staff' });

      const updateData: any = {
        workflow_stage: stage,
        stage_history: stageHistory,
        updated_at: new Date().toISOString()
      };

      if (stage === 'completed') {
        updateData.status = 'completed';
        updateData.workflow_status = 'completed';
        updateData.completed_at = new Date().toISOString();
        updateData.handoff_completed = true;
      } else {
        updateData.workflow_status = 'in_progress';
      }

      if (stage === 'landlord_negotiation') { updateData.application_status = 'approved'; updateData.negotiation_status = 'in_progress'; }
      else if (stage === 'lease_signing') { updateData.negotiation_status = 'completed'; updateData.lease_status = 'in_progress'; }
      else if (stage === 'property_setup') { updateData.lease_status = 'signed'; }
      else if (stage === 'operations_handoff') { updateData.handoff_date = new Date().toISOString().split('T')[0]; }

      const updateResult = await db('investor_acquisitions', 'PATCH', `?id=eq.${acquisition_id}`, updateData);
      if (!updateResult.ok) {
        console.error('[v2.3] update_stage PATCH error:', JSON.stringify(updateResult.data));
        const { stage_history: _sh, ...fallbackData } = updateData;
        const fallbackResult = await db('investor_acquisitions', 'PATCH', `?id=eq.${acquisition_id}`, fallbackData);
        if (!fallbackResult.ok) {
          return json({ error: 'Failed to update stage', details: updateResult.data }, 500);
        }
      }

      console.log('[v2.3] Stage updated:', current.workflow_stage, '->', stage, '| History entries:', stageHistory.length);

      const propAddress = current.property_address || current.full_address || 'your property';
      const stageLabel = stageLabels[stage] || stage;
      const stageDesc = stageDescriptions[stage] || `Your acquisition has moved to: ${stageLabel}`;

      await createNotification(current.investor_id, 'acquisition_update', `Acquisition Update: ${stageLabel}`, stageDesc, { acquisition_id, stage });

      const inv = await getInvestorInfo(current.investor_id);
      if (inv?.email) {
        await sendEmail(inv.email, `Acquisition Update: ${stageLabel}`,
          `<h2>Acquisition Update</h2><p>Hi ${inv.full_name},</p><p>${stageDesc}</p><p>Property: <strong>${propAddress}</strong></p>`);
      }

      if (stage === 'completed') {
        console.log('[v2.3] Acquisition completed! Creating portfolio entry...');
        await createPortfolioEntry(acquisition_id, current.investor_id);
        await checkAndQualifyReferral(current.investor_id, acquisition_id, propAddress);
      }

      return json({ success: true, stage, stage_history_count: stageHistory.length });
    }

    // ==================== ADD NOTE ====================
    if (action === 'add_note') {
      const { acquisition_id, note, staff_name } = body;
      if (!acquisition_id || !note) return json({ error: 'acquisition_id and note are required' }, 400);

      const currentResult = await db('investor_acquisitions', 'GET', `?id=eq.${acquisition_id}&select=notes_history`);
      const current = Array.isArray(currentResult.data) ? currentResult.data[0] : null;
      
      const notesHistory = toArray(current?.notes_history);
      const newNote = { text: note, by: staff_name || 'Staff', date: new Date().toISOString() };
      notesHistory.push(newNote);

      const patchBody = { notes_history: notesHistory, updated_at: new Date().toISOString() };
      const updateResult = await db('investor_acquisitions', 'PATCH', `?id=eq.${acquisition_id}`, patchBody);
      
      if (!updateResult.ok) {
        console.error('[v2.3] add_note PATCH error:', JSON.stringify(updateResult.data));
        const testPatch = await db('investor_acquisitions', 'PATCH', `?id=eq.${acquisition_id}`, { updated_at: new Date().toISOString() });
        if (testPatch.ok) {
          const workaround = await db('investor_acquisitions', 'PATCH', `?id=eq.${acquisition_id}`, { 
            notes_history: JSON.parse(JSON.stringify(notesHistory)),
            updated_at: new Date().toISOString() 
          });
          if (workaround.ok) {
            return json({ success: true, notes_count: notesHistory.length });
          }
        }
        return json({ error: 'Failed to add note', details: updateResult.data }, 500);
      }

      console.log('[v2.3] Note added successfully. Total notes:', notesHistory.length);
      return json({ success: true, notes_count: notesHistory.length });
    }

    // ==================== GET ALL ACTIVE ====================
    if (action === 'get_all_active') {
      const acqResult = await db('investor_acquisitions', 'GET', '?status=eq.active&select=*&order=created_at.desc');
      const acquisitions = Array.isArray(acqResult.data) ? acqResult.data : [];
      const investorIds = [...new Set(acquisitions.map((a: any) => a.investor_id).filter(Boolean))];
      const investorMap: Record<string, any> = {};
      if (investorIds.length > 0) {
        const idsFilter = investorIds.map(id => `"${id}"`).join(',');
        const invResult = await db('investors', 'GET', `?id=in.(${idsFilter})&select=id,full_name,email,phone`);
        (Array.isArray(invResult.data) ? invResult.data : []).forEach((inv: any) => { investorMap[inv.id] = inv; });
      }
      return json({ acquisitions: acquisitions.map((acq: any) => ({ ...acq, investor: investorMap[acq.investor_id] || null })) });
    }

    // ==================== CLEANUP TEST DATA ====================
    if (action === 'cleanup_test_data') {
      const { acquisition_ids } = body;
      if (!acquisition_ids || !Array.isArray(acquisition_ids) || acquisition_ids.length === 0) {
        return json({ error: 'acquisition_ids array is required and must not be empty' }, 400);
      }

      // Safety: limit to 20 IDs per call to prevent accidental mass deletion
      if (acquisition_ids.length > 20) {
        return json({ error: 'Maximum 20 acquisition IDs per cleanup call' }, 400);
      }

      console.log('[v2.3] cleanup_test_data: Starting cascade delete for', acquisition_ids.length, 'acquisition(s)');
      const summary: Record<string, { deleted: number; errors: string[] }> = {};

      for (const acqId of acquisition_ids) {
        const acqSummary = { deleted: 0, errors: [] as string[] };
        summary[acqId] = acqSummary;

        // 1. Fetch the acquisition to get investor_id for related lookups
        const acqResult = await db('investor_acquisitions', 'GET', `?id=eq.${acqId}&select=id,investor_id,full_address`);
        const acq = Array.isArray(acqResult.data) ? acqResult.data[0] : null;
        if (!acq) {
          acqSummary.errors.push('Acquisition not found - may already be deleted');
          continue;
        }

        const investorId = acq.investor_id;
        console.log(`[v2.3] Cleaning up acquisition ${acqId} for investor ${investorId} (${acq.full_address})`);

        // 2. Delete investor_notifications related to this acquisition
        try {
          // Notifications reference acquisition_id in their JSON data field
          // We need to delete notifications that contain this acquisition_id
          // PostgREST supports JSONB containment: data->>acquisition_id
          const notifResult = await dbDelete('investor_notifications', `?investor_id=eq.${investorId}&data->>acquisition_id=eq.${acqId}`);
          if (notifResult.ok) {
            acqSummary.deleted++;
            console.log(`[v2.3] Deleted notifications for acquisition ${acqId}`);
          }
          // Also try type-based cleanup for acquisition notifications
          const notifResult2 = await dbDelete('investor_notifications', `?investor_id=eq.${investorId}&type=in.(acquisition_started,acquisition_update,portfolio_update)&data->>acquisition_id=eq.${acqId}`);
          if (notifResult2.ok) acqSummary.deleted++;
        } catch (e: any) {
          acqSummary.errors.push(`notifications: ${e.message}`);
        }

        // 3. Delete portfolio_credits linked to portfolio entries for this acquisition
        try {
          // First find portfolio entries for this acquisition
          const portfolioResult = await db('investor_portfolio', 'GET', `?investor_id=eq.${investorId}&acquisition_id=eq.${acqId}&select=id`);
          const portfolioEntries = Array.isArray(portfolioResult.data) ? portfolioResult.data : [];
          
          for (const pe of portfolioEntries) {
            const creditsResult = await dbDelete('portfolio_credits', `?portfolio_property_id=eq.${pe.id}`);
            if (creditsResult.ok) {
              acqSummary.deleted++;
              console.log(`[v2.3] Deleted portfolio_credits for portfolio entry ${pe.id}`);
            }
          }
        } catch (e: any) {
          acqSummary.errors.push(`portfolio_credits: ${e.message}`);
        }

        // 4. Delete investor_portfolio entries for this acquisition
        try {
          const portfolioDelResult = await dbDelete('investor_portfolio', `?investor_id=eq.${investorId}&acquisition_id=eq.${acqId}`);
          if (portfolioDelResult.ok) {
            acqSummary.deleted++;
            console.log(`[v2.3] Deleted investor_portfolio entries for acquisition ${acqId}`);
          }
        } catch (e: any) {
          acqSummary.errors.push(`investor_portfolio: ${e.message}`);
        }

        // 5. Delete acquisition_workflow entries for this acquisition
        try {
          // acquisition_workflow uses property_id, but also check investor_id
          const workflowResult = await dbDelete('acquisition_workflow', `?investor_id=eq.${investorId}`);
          if (workflowResult.ok) {
            acqSummary.deleted++;
            console.log(`[v2.3] Deleted acquisition_workflow entries for investor ${investorId}`);
          }
        } catch (e: any) {
          // Table may not exist or have different schema - not critical
          acqSummary.errors.push(`acquisition_workflow: ${e.message}`);
        }

        // 6. Delete investor_documents linked to this acquisition
        try {
          const docsResult = await dbDelete('investor_documents', `?acquisition_id=eq.${acqId}`);
          if (docsResult.ok) {
            acqSummary.deleted++;
            console.log(`[v2.3] Deleted investor_documents for acquisition ${acqId}`);
          }
        } catch (e: any) {
          acqSummary.errors.push(`investor_documents: ${e.message}`);
        }

        // 7. Delete the acquisition itself (last, after all dependents)
        try {
          const acqDelResult = await dbDelete('investor_acquisitions', `?id=eq.${acqId}`);
          if (acqDelResult.ok) {
            acqSummary.deleted++;
            console.log(`[v2.3] Deleted acquisition ${acqId}`);
          } else {
            acqSummary.errors.push(`acquisition delete failed: ${JSON.stringify(acqDelResult.data)}`);
          }
        } catch (e: any) {
          acqSummary.errors.push(`acquisition: ${e.message}`);
        }
      }

      const totalDeleted = Object.values(summary).reduce((sum, s) => sum + s.deleted, 0);
      const totalErrors = Object.values(summary).reduce((sum, s) => sum + s.errors.length, 0);
      
      console.log(`[v2.3] cleanup_test_data complete: ${totalDeleted} delete operations, ${totalErrors} errors`);

      return json({
        success: totalErrors === 0,
        action: 'cleanup_test_data',
        acquisitions_processed: acquisition_ids.length,
        total_delete_operations: totalDeleted,
        total_errors: totalErrors,
        summary
      });
    }

    return json({ error: 'Unknown action' }, 400);
  } catch (err: any) {
    console.error('[manage-acquisitions v2.3] Error:', err.message, err.stack);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

