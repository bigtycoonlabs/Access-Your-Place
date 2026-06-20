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
// am-submit-deal v9.1 - Added deal_status_notifications insertion on approve/deny/submit
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

    const getH = { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json' };
    const mutH = { ...getH, 'Prefer': 'return=representation' };

    const FROM_EMAIL = 'Access Your Place <notifications@accessyourplace.com>';

    const body = await req.json();
    const { action } = body;
    console.log('[am-submit-deal v9.1] Action:', action);

    function getStaffName(staff: any): string {
      if (staff.first_name) return `${staff.first_name} ${staff.last_name || ''}`.trim();
      if (staff.name) return staff.name;
      return 'Team Member';
    }

    async function sendResendEmail(to: string, subject: string, html: string): Promise<boolean> {
      if (!RESEND_API_KEY) { console.log('[am-submit-deal] No RESEND_API_KEY, skipping email'); return false; }
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html })
        });
        if (!res.ok) {
          const errBody = await res.text();
          console.error('[am-submit-deal] Resend error:', res.status, errBody);
          return false;
        }
        const resData = await res.json();
        console.log('[am-submit-deal] Email sent to', to, 'resend_id:', resData?.id);
        return true;
      } catch (e: any) {
        console.error('[am-submit-deal] Email send error:', e.message);
        return false;
      }
    }

    async function getSuccessTeamMembers(): Promise<any[]> {
      const url = `${SUPABASE_URL}/rest/v1/staff_users?select=id,email,name,first_name,last_name,role,department,roles&is_active=eq.true&or=(role.eq.success_managers,department.eq.success_managers,role.eq.admin,role.eq.success_manager)`;
      const res = await fetch(url, { headers: getH });
      const staff = await res.json();
      if (!Array.isArray(staff)) return [];
      return staff;
    }

    async function logActivity(propertyId: string, activityType: string, activityDescription: string, performerName: string, newValue?: string, previousValue?: string, performedBy?: string): Promise<void> {
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/deal_activity_log`, {
          method: 'POST', headers: mutH,
          body: JSON.stringify({
            property_id: propertyId,
            activity_type: activityType,
            activity_description: activityDescription,
            performer_name: performerName || 'System',
            new_value: newValue || null,
            previous_value: previousValue || null,
            performed_by: performedBy || null,
            created_at: new Date().toISOString()
          })
        });
      } catch (e: any) {
        console.error('[am-submit-deal] Activity log error:', e.message);
      }
    }

    // v9.1: Helper to insert deal_status_notification
    async function insertDealStatusNotification(notif: {
      property_id: string; property_title?: string; property_address?: string;
      property_city?: string; property_state?: string;
      recipient_staff_id: string; recipient_staff_name?: string; recipient_email?: string;
      reviewer_staff_id?: string; reviewer_staff_name?: string;
      old_status?: string; new_status: string; notification_type: string;
      message: string; metadata?: any;
    }): Promise<string | null> {
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications`, {
          method: 'POST', headers: mutH,
          body: JSON.stringify({
            ...notif,
            is_read: false,
            email_sent: false,
            metadata: notif.metadata || {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
        });
        if (res.ok) {
          const data = await res.json();
          const id = data?.[0]?.id;
          console.log('[am-submit-deal v9.1] Deal status notification inserted:', id);
          return id;
        } else {
          console.error('[am-submit-deal v9.1] Notification insert error:', await res.text());
          return null;
        }
      } catch (e: any) {
        console.error('[am-submit-deal v9.1] Notification error:', e.message);
        return null;
      }
    }

    // v9.1: Helper to send email for critical notifications via deal-flow-notifications
    async function triggerNotificationEmail(notif: any): Promise<void> {
      try {
        fetch(`${SUPABASE_URL}/functions/v1/deal-flow-notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({
            action: 'insert_deal_status_notification',
            ...notif,
            send_email: true
          })
        }).catch(e => console.error('[am-submit-deal v9.1] Email trigger error:', e));
      } catch (e) { /* fire and forget */ }
    }

    async function triggerPennyScoring(propertyId: string, propertyData: any): Promise<{ score: number | null; recommendation: string | null; confidence?: number; error?: string }> {
      try {
        const scoringRes = await fetch(`${SUPABASE_URL}/functions/v1/penny-deal-scoring`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
          body: JSON.stringify({ action: 'score_property', property_id: propertyId, property_data: propertyData })
        });
        if (!scoringRes.ok) return { score: null, recommendation: null, error: `HTTP ${scoringRes.status}` };
        const scoreResult = await scoringRes.json();
        if (scoreResult.score !== undefined) {
          try {
            await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${propertyId}`, {
              method: 'PATCH', headers: mutH,
              body: JSON.stringify({ penny_score: scoreResult.score, penny_recommendation: scoreResult.recommendation, penny_scored_at: new Date().toISOString() })
            });
          } catch (e: any) { console.error('[am-submit-deal] Score update failed:', e.message); }
          return { score: scoreResult.score, recommendation: scoreResult.recommendation, confidence: scoreResult.confidence };
        }
        return { score: null, recommendation: null, error: 'No score returned' };
      } catch (e: any) {
        return { score: null, recommendation: null, error: e.message };
      }
    }

    // ========== GET DEAL ACTIVITY LOG ==========
    if (action === 'get_deal_activity_log') {
      const { property_id } = body;
      if (!property_id) return json({ success: false, error: 'Property ID required' }, 400);
      const url = `${SUPABASE_URL}/rest/v1/deal_activity_log?property_id=eq.${property_id}&order=created_at.desc&limit=100`;
      const res = await fetch(url, { headers: getH });
      const logs = await res.json();
      const logList = Array.isArray(logs) ? logs : [];
      return json({ success: true, logs: logList, count: logList.length });
    }

    // ========== GET ACQUISITION MANAGERS ==========
    if (action === 'get_acquisition_managers') {
      const url = `${SUPABASE_URL}/rest/v1/staff_users?select=id,email,name,first_name,last_name,role,department,roles&is_active=eq.true&or=(department.eq.acquisition_managers,role.eq.acquisition_managers,role.eq.acquisition_manager)&order=first_name.asc`;
      const res = await fetch(url, { headers: getH });
      const staff = await res.json();
      const managers = Array.isArray(staff) ? staff.map((s: any) => ({
        id: s.id, name: getStaffName(s), email: s.email, department: s.department
      })) : [];
      return json({ success: true, managers });
    }

    // ========== TOGGLE THIRD-PARTY SELLER ==========
    if (action === 'toggle_third_party') {
      const { property_id, is_third_party_seller, staff_name, staff_id } = body;
      if (!property_id) return json({ success: false, error: 'Property ID required' }, 400);
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}`, {
        method: 'PATCH', headers: mutH,
        body: JSON.stringify({
          is_third_party_seller: !!is_third_party_seller,
          source: is_third_party_seller ? 'third_party' : 'acquisition_manager',
          updated_at: new Date().toISOString()
        })
      });
      if (!patchRes.ok) return json({ success: false, error: (await patchRes.text()).substring(0, 200) });
      await logActivity(property_id, 'third_party_toggled', `Deal marked as ${is_third_party_seller ? 'third-party seller' : 'direct acquisition'} by ${staff_name || 'Staff'}`, staff_name || 'Staff', JSON.stringify({ is_third_party_seller }), null, staff_id || null);
      return json({ success: true, message: `Deal marked as ${is_third_party_seller ? 'third-party seller' : 'direct acquisition'}` });
    }

    // ========== ASSIGN AM TO DEAL ==========
    if (action === 'assign_am_to_deal') {
      const { property_id, am_staff_id, am_staff_name, assigned_by_name, assigned_by_staff_id } = body;
      if (!property_id) return json({ success: false, error: 'Property ID required' }, 400);
      if (!am_staff_id) return json({ success: false, error: 'AM staff ID required' }, 400);
      const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}&select=found_by_am_id,found_by_am_name`, { headers: getH });
      const propData = (await propRes.json())?.[0];
      const previousAm = propData?.found_by_am_name || 'None';
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}`, {
        method: 'PATCH', headers: mutH,
        body: JSON.stringify({ found_by_am_id: am_staff_id, found_by_am_name: am_staff_name || null, updated_at: new Date().toISOString() })
      });
      if (!patchRes.ok) return json({ success: false, error: (await patchRes.text()).substring(0, 200) });
      await logActivity(property_id, 'am_assigned', `AM ${am_staff_name || 'Unknown'} assigned to deal by ${assigned_by_name || 'Success Team'}`, assigned_by_name || 'Success Team', JSON.stringify({ am_staff_id, am_staff_name }), JSON.stringify({ previous_am: previousAm }), assigned_by_staff_id || null);
      return json({ success: true, message: `AM ${am_staff_name || 'Unknown'} assigned to deal` });
    }

    // ========== SUBMIT DEAL ==========
    if (action === 'submit_deal') {
      const {
        address, city, state, zip_code, asking_price, monthly_revenue,
        bedrooms, bathrooms, sqft, property_type, operation_type,
        notes, photos, listing_url, landlord_name, landlord_email, landlord_phone,
        submitted_by_staff_id, submitted_by_staff_name, community_name,
        submitted_by_type, submitted_by_client_name, submitted_by_client_email,
        is_third_party_seller, listing_title, listing_description,
        adr_peak_season, adr_slow_season, monthly_room_rate, avg_occupancy_rate,
        projected_yearly_revenue, projected_monthly_revenue_peak, projected_monthly_revenue_slow,
        peak_season_description, deposits_concessions_notes
      } = body;

      const errors: string[] = [];
      if (!address?.trim()) errors.push('Street address is required');
      if (!city?.trim()) errors.push('City is required');
      if (!state?.trim()) errors.push('State is required');
      if (!zip_code?.trim()) errors.push('ZIP code is required');
      if (!asking_price || parseFloat(String(asking_price)) <= 0) errors.push('Asking price is required');
      if (!monthly_revenue || parseFloat(String(monthly_revenue)) <= 0) errors.push('Monthly revenue is required');
      if (!operation_type) errors.push('Operation type is required');
      if (!landlord_name?.trim()) errors.push('Landlord name is required');
      if (!landlord_phone?.trim() && !landlord_email?.trim()) errors.push('Landlord phone or email is required');
      const photoArray = Array.isArray(photos) ? photos.filter((p: string) => p && p.trim()) : [];
      if (photoArray.length === 0) errors.push('At least 1 property photo is required');

      if (errors.length > 0) {
        return json({ success: false, error: errors.join('. '), validation_errors: errors }, 400);
      }

      const autoTitle = listing_title?.trim() || `${bedrooms || 3}BR in ${city.trim()}, ${state.trim().toUpperCase()}`;
      const submitterType = submitted_by_type || 'acquisition_manager';

      const propertyData: Record<string, any> = {
        title: autoTitle, listing_title: autoTitle, listing_description: listing_description || null,
        address: address.trim(), city: city.trim(), state: state.trim().toUpperCase().substring(0, 2),
        zip_code: zip_code.trim(), price: parseFloat(String(asking_price)),
        monthly_rent: parseFloat(String(monthly_revenue)),
        bedrooms: parseInt(String(bedrooms)) || 3, bathrooms: parseFloat(String(bathrooms)) || 2,
        sqft: sqft ? parseInt(String(sqft)) : null,
        property_type: property_type || 'single_family', operation_type: operation_type || 'str',
        photos: photoArray, landlord_name: landlord_name || null, landlord_email: landlord_email || null,
        landlord_phone: landlord_phone || null, listing_url: listing_url || null,
        internal_notes: notes || null, community_name: community_name || null,
        is_third_party_seller: !!is_third_party_seller,
        status: 'am_submitted', deal_status: 'am_submitted', workflow_stage: 'am_submitted',
        workflow_stage_entered_at: new Date().toISOString(),
        source: is_third_party_seller ? 'third_party' : (submitterType === 'seller' ? 'seller_submission' : 'acquisition_manager'),
        submitted_by_type: submitterType, submitted_by_client_name: submitted_by_client_name || null,
        submitted_by_client_email: submitted_by_client_email || null,
        is_published: false, is_featured: false, featured: false, is_verified: false, staff_verified: false,
        added_by_staff_id: submitted_by_staff_id || null, added_by_staff_name: submitted_by_staff_name || null,
        found_by_am_id: submitted_by_staff_id || null, found_by_am_name: submitted_by_staff_name || null,
        units_available: 1, acquisition_fee: 2500,
        visibility_settings: { show_address: false, show_community_name: false, show_landlord_contact: false, show_full_photos: true, show_financials: true },
        created_at: new Date().toISOString(), updated_at: new Date().toISOString()
      };

      if (adr_peak_season) propertyData.adr_peak_season = parseFloat(String(adr_peak_season));
      if (adr_slow_season) propertyData.adr_slow_season = parseFloat(String(adr_slow_season));
      if (monthly_room_rate) propertyData.monthly_room_rate = parseFloat(String(monthly_room_rate));
      if (avg_occupancy_rate) propertyData.avg_occupancy_rate = parseFloat(String(avg_occupancy_rate));
      if (projected_yearly_revenue) propertyData.projected_yearly_revenue = parseFloat(String(projected_yearly_revenue));
      if (projected_monthly_revenue_peak) propertyData.projected_monthly_revenue_peak = parseFloat(String(projected_monthly_revenue_peak));
      if (projected_monthly_revenue_slow) propertyData.projected_monthly_revenue_slow = parseFloat(String(projected_monthly_revenue_slow));
      if (peak_season_description) propertyData.peak_season_description = peak_season_description;
      if (deposits_concessions_notes) propertyData.deposits_concessions_notes = deposits_concessions_notes;

      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/properties`, {
        method: 'POST', headers: mutH, body: JSON.stringify(propertyData)
      });

      if (!insertRes.ok) {
        const errText = await insertRes.text();
        console.error('[am-submit-deal] Insert error:', errText);
        return json({ success: false, error: 'Failed to save property: ' + errText.substring(0, 200) });
      }

      const inserted = await insertRes.json();
      const property = Array.isArray(inserted) ? inserted[0] : inserted;
      console.log('[am-submit-deal] Created property:', property?.id);

      await logActivity(property.id, 'am_deal_submitted', `${submitterType === 'seller' ? 'Seller' : 'AM'} ${submitted_by_staff_name || submitted_by_client_name || 'Unknown'} submitted deal: ${address}, ${city}${is_third_party_seller ? ' [Third-Party Seller]' : ''}`, submitted_by_staff_name || submitted_by_client_name || 'Submitter', JSON.stringify({ asking_price, monthly_revenue, status: 'am_submitted', submitted_by_type: submitterType, is_third_party_seller }), null, submitted_by_staff_id || null);

      // v9.1: Insert deal_status_notification for the AM (submission confirmation)
      if (submitted_by_staff_id) {
        const dealLocation = [city?.trim(), state?.trim()?.toUpperCase()].filter(Boolean).join(', ');
        await insertDealStatusNotification({
          property_id: property.id,
          property_title: autoTitle,
          property_address: address?.trim(),
          property_city: city?.trim(),
          property_state: state?.trim()?.toUpperCase(),
          recipient_staff_id: submitted_by_staff_id,
          recipient_staff_name: submitted_by_staff_name,
          notification_type: 'deal_submitted',
          new_status: 'am_submitted',
          message: `Your deal "${autoTitle}"${dealLocation ? ` in ${dealLocation}` : ''} has been submitted and is under review by the Success Team.`
        });
      }

      // Create staff notification
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/staff_notifications`, {
          method: 'POST', headers: mutH,
          body: JSON.stringify({
            notification_type: 'am_deal_submitted',
            title: `New Deal Submitted: ${autoTitle}${is_third_party_seller ? ' [3rd Party]' : ''}`,
            message: `${submitted_by_staff_name || submitted_by_client_name || 'Someone'} submitted ${address}, ${city}, ${state} for review. Asking: $${Number(asking_price).toLocaleString()}`,
            target_role: 'success_managers', property_id: property.id,
            created_by_staff_id: submitted_by_staff_id || null,
            created_by_staff_name: submitted_by_staff_name || submitted_by_client_name || null,
            is_read: false, priority: 'high', created_at: new Date().toISOString()
          })
        });
      } catch (e) { /* skip */ }

      // Email submitter confirmation
      let submitterEmailSent = false;
      if (submitted_by_staff_id) {
        try {
          const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${submitted_by_staff_id}&select=email,name,first_name,last_name`, { headers: getH });
          const staff = (await staffRes.json())?.[0];
          if (staff?.email) {
            submitterEmailSent = await sendResendEmail(staff.email, `Deal Received - ${autoTitle} - Under Review`,
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:24px;border-radius:8px 8px 0 0;">
                  <h1 style="color:#d4a574;margin:0;font-size:22px;">Deal Submission Received</h1>
                </div>
                <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                  <p>Hi ${getStaffName(staff)},</p>
                  <p>Your deal <strong>${autoTitle}</strong> has been received and is under Success Team review.</p>
                  <div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #d4a574;">
                    <p style="margin:4px 0;"><strong>Location:</strong> ${city}, ${state}</p>
                    <p style="margin:4px 0;"><strong>Asking Price:</strong> $${Number(asking_price).toLocaleString()}</p>
                    <p style="margin:4px 0;"><strong>Monthly Revenue:</strong> $${Number(monthly_revenue).toLocaleString()}/mo</p>
                  </div>
                  <div style="text-align:center;margin-top:24px;"><a href="https://accessyourplace.com/staff" style="background:#d4a574;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Track in Dashboard</a></div>
                </div>
              </div>`);
          }
        } catch (e) { /* skip */ }
      }

      // Email Success Team
      let emailsSent = 0;
      try {
        const successTeam = await getSuccessTeamMembers();
        for (const member of successTeam) {
          try {
            const sent = await sendResendEmail(member.email,
              `[Action Required] New Deal: ${autoTitle}${is_third_party_seller ? ' [3rd Party Seller]' : ''}`,
              `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <div style="background:linear-gradient(135deg,#1a365d,#2d4a7c);padding:24px;border-radius:8px 8px 0 0;">
                  <h1 style="color:#d4a574;margin:0;">New Deal for Review</h1>
                </div>
                <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                  <p>Hi ${getStaffName(member)},</p>
                  <p><strong>AM: ${submitted_by_staff_name || 'Unknown'}</strong> submitted a new property:</p>
                  <div style="background:#f9fafb;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #d4a574;">
                    <p style="margin:4px 0;font-weight:bold;">${autoTitle}</p>
                    <p style="margin:4px 0;">${city}, ${state} ${zip_code || ''}</p>
                    <p style="margin:4px 0;">Price: $${Number(asking_price).toLocaleString()} | Revenue: $${Number(monthly_revenue).toLocaleString()}/mo</p>
                    ${is_third_party_seller ? '<p style="margin:4px 0;color:#9333ea;font-weight:bold;">Third-Party Seller Deal</p>' : ''}
                  </div>
                  <div style="text-align:center;margin-top:24px;"><a href="https://accessyourplace.com/staff" style="background:#d4a574;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Review Deal</a></div>
                </div>
              </div>`);
            if (sent) emailsSent++;
          } catch (e) { /* skip */ }
        }
      } catch (e) { /* skip */ }

      return json({
        success: true, property, id: property?.id, property_id: property?.id,
        emails_sent: emailsSent, submitter_email_sent: submitterEmailSent,
        message: `Deal submitted successfully! ${emailsSent} Success Team member(s) notified.`
      });
    }

    // ========== GET AM SUBMITTED DEALS ==========
    if (action === 'get_submitted_deals') {
      const { staff_id, status_filter } = body;
      let url = `${SUPABASE_URL}/rest/v1/properties?select=*&order=created_at.desc`;
      if (status_filter === 'am_submitted') url += '&deal_status=eq.am_submitted';
      else if (status_filter === 'am_approved') url += '&deal_status=eq.am_approved';
      else if (status_filter === 'am_denied') url += '&deal_status=eq.am_denied';
      else url += '&deal_status=in.(am_submitted,am_approved,am_denied)';
      if (staff_id) url += `&or=(added_by_staff_id.eq.${staff_id},found_by_am_id.eq.${staff_id})`;
      const res = await fetch(url, { headers: getH });
      const deals = await res.json();
      const dealsList = Array.isArray(deals) ? deals : [];
      return json({
        success: true, deals: dealsList,
        counts: {
          total: dealsList.length,
          pending: dealsList.filter((d: any) => d.deal_status === 'am_submitted').length,
          approved: dealsList.filter((d: any) => d.deal_status === 'am_approved').length,
          denied: dealsList.filter((d: any) => d.deal_status === 'am_denied').length
        }
      });
    }

    // ========== GET FULL PIPELINE ==========
    if (action === 'get_pipeline_deals') {
      const amUrl = `${SUPABASE_URL}/rest/v1/properties?select=*&deal_status=in.(am_submitted,am_approved,am_denied)&order=created_at.desc&limit=500`;
      const amRes = await fetch(amUrl, { headers: getH });
      const amDeals = await amRes.json();
      const amList = Array.isArray(amDeals) ? amDeals : [];
      let sellerList: any[] = [];
      try {
        const sellerUrl = `${SUPABASE_URL}/rest/v1/marketplace_listings?select=*,property:investor_portfolio(*),seller:investors!seller_id(full_name,email,phone)&status=in.(pending_approval,needs_changes)&order=created_at.desc&limit=100`;
        const sellerRes = await fetch(sellerUrl, { headers: getH });
        const sellerData = await sellerRes.json();
        sellerList = Array.isArray(sellerData) ? sellerData : [];
      } catch (e) { /* skip */ }
      return json({
        success: true, am_deals: amList, seller_deals: sellerList,
        counts: {
          am_total: amList.length,
          am_pending: amList.filter((d: any) => d.deal_status === 'am_submitted').length,
          am_approved: amList.filter((d: any) => d.deal_status === 'am_approved').length,
          am_denied: amList.filter((d: any) => d.deal_status === 'am_denied').length,
          seller_pending: sellerList.filter((d: any) => d.status === 'pending_approval').length,
          seller_needs_changes: sellerList.filter((d: any) => d.status === 'needs_changes').length,
        }
      });
    }

    // ========== GET PENDING COUNT ==========
    if (action === 'get_pending_count') {
      const url = `${SUPABASE_URL}/rest/v1/properties?select=id&deal_status=eq.am_submitted`;
      const res = await fetch(url, { headers: { ...getH, 'Prefer': 'count=exact' } });
      const countHeader = res.headers.get('content-range');
      let count = 0;
      if (countHeader) {
        const match = countHeader.match(/\/(\d+)/);
        if (match) count = parseInt(match[1]);
      } else {
        const data = await res.json();
        count = Array.isArray(data) ? data.length : 0;
      }
      return json({ success: true, pending_count: count });
    }

    // ========== APPROVE DEAL ==========
    if (action === 'approve_deal') {
      const { property_id, approved_by_name, approved_by_staff_id, approval_notes } = body;
      if (!property_id) return json({ success: false, error: 'Property ID required' });

      const propFetchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}&select=*`, { headers: getH });
      const propData = (await propFetchRes.json())?.[0];

      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}`, {
        method: 'PATCH', headers: mutH,
        body: JSON.stringify({
          deal_status: 'am_approved', status: 'new', workflow_stage: 'new',
          workflow_stage_entered_at: new Date().toISOString(),
          verification_status: 'verified', staff_verified: true, is_verified: true,
          approved_by_staff_id: approved_by_staff_id || null,
          approved_by_staff_name: approved_by_name || 'Success Team',
          approved_at: new Date().toISOString(),
          internal_notes: approval_notes ? `[APPROVED by ${approved_by_name || 'Success Team'}]: ${approval_notes}` : propData?.internal_notes || null,
          updated_at: new Date().toISOString()
        })
      });

      if (!patchRes.ok) {
        const errText = await patchRes.text();
        return json({ success: false, error: 'Failed to approve: ' + errText.substring(0, 200) });
      }

      await logActivity(property_id, 'am_deal_approved', `Deal approved by ${approved_by_name || 'Success Team'}${approval_notes ? ': ' + approval_notes : ''}`, approved_by_name || 'Success Team', JSON.stringify({ deal_status: 'am_approved', approved_by: approved_by_name }), JSON.stringify({ deal_status: 'am_submitted' }), approved_by_staff_id || null);

      // Trigger Penny AI scoring
      let pennyResult = { score: null as number | null, recommendation: null as string | null, error: undefined as string | undefined };
      try {
        pennyResult = await triggerPennyScoring(property_id, { ...propData, id: property_id, deal_status: 'am_approved', status: 'new', is_verified: true });
        if (pennyResult.score !== null) {
          await logActivity(property_id, 'penny_scored', `Penny AI scored deal: ${pennyResult.score}/100 - ${pennyResult.recommendation || 'N/A'}`, 'Penny AI', JSON.stringify({ score: pennyResult.score, recommendation: pennyResult.recommendation }));
        }
      } catch (e: any) { pennyResult.error = e.message; }

      // v9.1: Insert deal_status_notification for the AM
      const amStaffId = propData?.added_by_staff_id || propData?.found_by_am_id;
      const dealTitle = propData?.title || propData?.listing_title || `Property in ${propData?.city || 'Unknown'}`;
      const dealLocation = [propData?.city, propData?.state].filter(Boolean).join(', ');

      if (amStaffId) {
        // Look up AM email for notification
        let amEmail = null;
        let amName = propData?.found_by_am_name || propData?.added_by_staff_name || 'Team Member';
        try {
          const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${amStaffId}&select=email,name,first_name,last_name`, { headers: getH });
          const staff = (await staffRes.json())?.[0];
          if (staff) {
            amEmail = staff.email;
            amName = getStaffName(staff);
          }
        } catch (e) { /* skip */ }

        const notifId = await insertDealStatusNotification({
          property_id,
          property_title: dealTitle,
          property_address: propData?.address,
          property_city: propData?.city,
          property_state: propData?.state,
          recipient_staff_id: amStaffId,
          recipient_staff_name: amName,
          recipient_email: amEmail || undefined,
          reviewer_staff_id: approved_by_staff_id,
          reviewer_staff_name: approved_by_name || 'Success Team',
          old_status: 'am_submitted',
          new_status: 'am_approved',
          notification_type: 'deal_approved',
          message: `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} has been approved by ${approved_by_name || 'the Success Team'}.${pennyResult.score !== null ? ` Penny Score: ${pennyResult.score}/100.` : ''}`,
          metadata: { approval_notes, penny_score: pennyResult.score, penny_recommendation: pennyResult.recommendation }
        });

        // Send email notification
        if (amEmail) {
          const emailSent = await sendResendEmail(amEmail, `Deal Approved - ${dealTitle}`,
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:linear-gradient(135deg,#065f46,#047857);padding:24px;border-radius:8px 8px 0 0;">
                <h1 style="color:#fff;margin:0;">Deal Approved!</h1>
              </div>
              <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <p>Hi ${amName.split(' ')[0]},</p>
                <p>Your deal <strong>${dealTitle}</strong> has been <span style="color:#059669;font-weight:bold;">APPROVED</span> by ${approved_by_name || 'the Success Team'}.</p>
                ${pennyResult.score !== null ? `<p>Penny Score: <strong>${pennyResult.score}/100</strong> (${pennyResult.recommendation})</p>` : ''}
                ${approval_notes ? `<div style="background:#f0fdf4;padding:12px;border-radius:8px;margin:12px 0;border:1px solid #bbf7d0;"><p style="margin:0;"><strong>Notes:</strong> ${approval_notes}</p></div>` : ''}
                <div style="text-align:center;margin-top:24px;"><a href="https://accessyourplace.com/staff" style="background:#059669;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">View in Dashboard</a></div>
              </div>
            </div>`);

          // Update notification email_sent status
          if (notifId) {
            await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications?id=eq.${notifId}`, {
              method: 'PATCH', headers: mutH,
              body: JSON.stringify({ email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null })
            });
          }
        }
      }

      return json({ success: true, message: 'Deal approved', penny_score: pennyResult.score, penny_recommendation: pennyResult.recommendation });
    }

    // ========== DENY DEAL ==========
    if (action === 'deny_deal') {
      const { property_id, denied_by_name, denied_by_staff_id, denial_notes } = body;
      if (!property_id) return json({ success: false, error: 'Property ID required' });

      const propFetchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}&select=*`, { headers: getH });
      const propData = (await propFetchRes.json())?.[0];

      await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}`, {
        method: 'PATCH', headers: mutH,
        body: JSON.stringify({
          deal_status: 'am_denied', status: 'am_denied', denial_reason: denial_notes || null,
          internal_notes: `[DENIED by ${denied_by_name || 'Success Team'}]: ${denial_notes || 'No reason provided'}`,
          updated_at: new Date().toISOString()
        })
      });

      await logActivity(property_id, 'am_deal_denied', `Deal denied by ${denied_by_name || 'Success Team'}${denial_notes ? ': ' + denial_notes : ''}`, denied_by_name || 'Success Team', JSON.stringify({ deal_status: 'am_denied', denial_reason: denial_notes }), JSON.stringify({ deal_status: 'am_submitted' }), denied_by_staff_id || null);

      // v9.1: Insert deal_status_notification for the AM
      const amStaffId = propData?.added_by_staff_id || propData?.found_by_am_id;
      const dealTitle = propData?.title || propData?.listing_title || `Property in ${propData?.city || 'Unknown'}`;
      const dealLocation = [propData?.city, propData?.state].filter(Boolean).join(', ');

      if (amStaffId) {
        let amEmail = null;
        let amName = propData?.found_by_am_name || propData?.added_by_staff_name || 'Team Member';
        try {
          const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${amStaffId}&select=email,name,first_name,last_name`, { headers: getH });
          const staff = (await staffRes.json())?.[0];
          if (staff) {
            amEmail = staff.email;
            amName = getStaffName(staff);
          }
        } catch (e) { /* skip */ }

        const notifId = await insertDealStatusNotification({
          property_id,
          property_title: dealTitle,
          property_address: propData?.address,
          property_city: propData?.city,
          property_state: propData?.state,
          recipient_staff_id: amStaffId,
          recipient_staff_name: amName,
          recipient_email: amEmail || undefined,
          reviewer_staff_id: denied_by_staff_id,
          reviewer_staff_name: denied_by_name || 'Success Team',
          old_status: 'am_submitted',
          new_status: 'am_denied',
          notification_type: 'deal_rejected',
          message: `Your deal "${dealTitle}"${dealLocation ? ` in ${dealLocation}` : ''} was not approved by ${denied_by_name || 'the Success Team'}.${denial_notes ? ' Feedback: ' + denial_notes : ''}`,
          metadata: { denial_reason: denial_notes }
        });

        // Send email notification
        if (amEmail) {
          const emailSent = await sendResendEmail(amEmail, `Deal Not Approved - ${dealTitle}`,
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <div style="background:#991b1b;padding:24px;border-radius:8px 8px 0 0;">
                <h1 style="color:#fff;margin:0;">Deal Not Approved</h1>
              </div>
              <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
                <p>Hi ${amName.split(' ')[0]},</p>
                <p>Your deal <strong>${dealTitle}</strong> was not approved by ${denied_by_name || 'the Success Team'}.</p>
                ${denial_notes ? `<div style="background:#fef2f2;padding:16px;border-radius:8px;margin:16px 0;border:1px solid #fecaca;"><p style="font-weight:bold;color:#991b1b;">Feedback:</p><p>${denial_notes}</p></div>` : ''}
                <div style="text-align:center;margin-top:24px;"><a href="https://accessyourplace.com/staff" style="background:#d4a574;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">Go to Dashboard</a></div>
              </div>
            </div>`);

          if (notifId) {
            await fetch(`${SUPABASE_URL}/rest/v1/deal_status_notifications?id=eq.${notifId}`, {
              method: 'PATCH', headers: mutH,
              body: JSON.stringify({ email_sent: emailSent, email_sent_at: emailSent ? new Date().toISOString() : null })
            });
          }
        }
      }

      return json({ success: true, message: 'Deal denied' });
    }

    // ========== UPDATE VISIBILITY ==========
    if (action === 'update_visibility') {
      const { property_id, visibility_settings, staff_id, staff_name } = body;
      if (!property_id) return json({ success: false, error: 'Property ID required' }, 400);
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}`, {
        method: 'PATCH', headers: mutH,
        body: JSON.stringify({ visibility_settings, updated_at: new Date().toISOString() })
      });
      if (!patchRes.ok) return json({ success: false, error: (await patchRes.text()).substring(0, 200) });
      await logActivity(property_id, 'visibility_changed', `Visibility settings updated by ${staff_name || 'Staff'}`, staff_name || 'Staff', JSON.stringify(visibility_settings), null, staff_id || null);
      return json({ success: true, message: 'Visibility settings updated' });
    }

    // ========== EDIT DEAL ==========
    if (action === 'edit_deal') {
      const { property_id, updates, staff_name, staff_id } = body;
      if (!property_id) return json({ success: false, error: 'Property ID required' }, 400);
      const allowedFields = ['price', 'monthly_rent', 'bedrooms', 'bathrooms', 'sqft', 'operation_type', 'property_type', 'title', 'listing_title', 'listing_description', 'acquisition_fee', 'internal_notes', 'community_name', 'visibility_settings', 'is_third_party_seller', 'landlord_name', 'landlord_email', 'landlord_phone', 'adr_peak_season', 'adr_slow_season', 'monthly_room_rate', 'avg_occupancy_rate', 'projected_yearly_revenue', 'projected_monthly_revenue_peak', 'projected_monthly_revenue_slow', 'peak_season_description', 'deposits_concessions_notes'];
      const safeUpdates: Record<string, any> = { updated_at: new Date().toISOString() };
      for (const [key, val] of Object.entries(updates || {})) {
        if (allowedFields.includes(key)) safeUpdates[key] = val;
      }
      if ('is_third_party_seller' in safeUpdates) {
        safeUpdates.source = safeUpdates.is_third_party_seller ? 'third_party' : 'acquisition_manager';
      }
      const patchRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}`, {
        method: 'PATCH', headers: mutH, body: JSON.stringify(safeUpdates)
      });
      if (!patchRes.ok) return json({ success: false, error: (await patchRes.text()).substring(0, 200) });
      const editedFields = Object.keys(safeUpdates).filter(k => k !== 'updated_at');
      await logActivity(property_id, 'deal_edited', `Deal edited by ${staff_name || 'Staff'}: ${editedFields.join(', ')}`, staff_name || 'Staff', JSON.stringify(safeUpdates), null, staff_id || null);
      return json({ success: true, message: 'Deal updated' });
    }

    // ========== NOTIFY AM: DEAL POSTED ==========
    if (action === 'notify_marketplace_posted') {
      const { property_id } = body;
      if (!property_id) return json({ success: false, error: 'Property ID required' }, 400);
      const propRes = await fetch(`${SUPABASE_URL}/rest/v1/properties?id=eq.${property_id}&select=*`, { headers: getH });
      const prop = (await propRes.json())?.[0];
      if (!prop) return json({ success: false, error: 'Property not found' }, 404);
      const amStaffId = prop.added_by_staff_id || prop.found_by_am_id;
      if (!amStaffId) return json({ success: true, message: 'No AM to notify', email_sent: false });
      const staffRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${amStaffId}&select=email,name,first_name,last_name`, { headers: getH });
      const amStaff = (await staffRes.json())?.[0];
      if (!amStaff?.email) return json({ success: true, message: 'AM email not found', email_sent: false });
      const dealTitle = prop.title || prop.listing_title || 'Property';
      await logActivity(property_id, 'deal_published', `Deal published to marketplace`, 'System');

      // v9.1: Also insert deal_status_notification
      await insertDealStatusNotification({
        property_id,
        property_title: dealTitle,
        property_address: prop.address,
        property_city: prop.city,
        property_state: prop.state,
        recipient_staff_id: amStaffId,
        recipient_staff_name: getStaffName(amStaff),
        recipient_email: amStaff.email,
        notification_type: 'deal_published',
        new_status: 'published',
        old_status: prop.deal_status || 'am_approved',
        message: `Your deal "${dealTitle}" in ${[prop.city, prop.state].filter(Boolean).join(', ')} is now LIVE on the marketplace!`
      });

      const emailSent = await sendResendEmail(amStaff.email, `Your Deal is LIVE! - ${dealTitle}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:linear-gradient(135deg,#1a365d,#d4a574);padding:30px;border-radius:8px 8px 0 0;text-align:center;"><h1 style="color:#fff;margin:0;">Your Deal is LIVE!</h1></div><div style="background:#fff;padding:28px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><p>Hi ${getStaffName(amStaff)},</p><p>Your deal <strong>${dealTitle}</strong> has been published!</p><div style="text-align:center;margin-top:24px;"><a href="https://accessyourplace.com/staff" style="background:#d4a574;color:white;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:bold;">View in Dashboard</a></div></div></div>`);
      return json({ success: true, email_sent: emailSent });
    }

    // ========== NOTIFY AM: INVESTOR ASSIGNED ==========
    if (action === 'notify_am_investor_assigned') {
      const { am_staff_id, investor_name, assigned_by_name } = body;
      if (!am_staff_id) return json({ success: false, error: 'am_staff_id required' }, 400);
      const amRes = await fetch(`${SUPABASE_URL}/rest/v1/staff_users?id=eq.${am_staff_id}&select=email,name,first_name,last_name`, { headers: getH });
      const am = (await amRes.json())?.[0];
      if (!am?.email) return json({ success: true, message: 'AM email not found', email_sent: false });
      const emailSent = await sendResendEmail(am.email, `New Investor Assigned - ${investor_name || 'New Investor'}`,
        `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;"><div style="background:#1a365d;padding:24px;border-radius:8px 8px 0 0;"><h1 style="color:#d4a574;margin:0;">New Investor Assigned</h1></div><div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;"><p>Hi ${getStaffName(am)},</p><p>Investor <strong>${investor_name || 'Unknown'}</strong> has been assigned to you${assigned_by_name ? ` by ${assigned_by_name}` : ''}.</p><div style="text-align:center;margin-top:24px;"><a href="https://accessyourplace.com/staff" style="background:#d4a574;color:white;padding:12px 28px;border-radius:6px;text-decoration:none;font-weight:bold;">View in Dashboard</a></div></div></div>`);
      return json({ success: true, email_sent: emailSent });
    }

    // ========== GET PENDING SUBMISSIONS (legacy) ==========
    if (action === 'get_pending_submissions') {
      const url = `${SUPABASE_URL}/rest/v1/properties?select=*&deal_status=in.(am_submitted,am_approved,am_denied)&order=created_at.desc&limit=200`;
      const res = await fetch(url, { headers: getH });
      const deals = await res.json();
      const dealsList = Array.isArray(deals) ? deals : [];
      return json({ success: true, deals: dealsList, counts: {
        total: dealsList.length,
        pending: dealsList.filter((d: any) => d.deal_status === 'am_submitted').length,
        approved: dealsList.filter((d: any) => d.deal_status === 'am_approved').length,
        denied: dealsList.filter((d: any) => d.deal_status === 'am_denied').length
      }});
    }

    return json({ success: false, error: `Unknown action: ${action}` });
  } catch (error: any) {
    console.error('[am-submit-deal v9.1] Error:', error.message);
    return json({ success: false, error: error.message }, 500);
  }
});

