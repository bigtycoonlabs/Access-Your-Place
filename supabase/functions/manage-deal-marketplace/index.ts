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

// manage-deal-marketplace v11.0 - Migrated from createClient to direct PostgREST REST API
export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

const URL = Deno.env.get('SUPABASE_URL')!;
const KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');

const getH = { 'apikey': KEY, 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const mutH = { ...getH, 'Prefer': 'return=representation' };

async function dbGet(path: string): Promise<any> {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: getH });
  if (!res.ok) { console.error('[mp v11] GET err:', (await res.text()).substring(0,200)); return []; }
  return res.json();
}
async function dbGetOne(path: string): Promise<any> {
  const arr = await dbGet(path);
  return Array.isArray(arr) ? arr[0] || null : arr;
}
async function dbPost(path: string, body: any): Promise<any> {
  const res = await fetch(`${URL}/rest/v1/${path}`, { method: 'POST', headers: mutH, body: JSON.stringify(body) });
  if (!res.ok) { console.error('[mp v11] POST err:', (await res.text()).substring(0,200)); return null; }
  const d = await res.json(); return Array.isArray(d) ? d[0] : d;
}
async function dbPatch(path: string, body: any): Promise<any> {
  const res = await fetch(`${URL}/rest/v1/${path}`, { method: 'PATCH', headers: mutH, body: JSON.stringify(body) });
  if (!res.ok) { console.error('[mp v11] PATCH err:', (await res.text()).substring(0,200)); return null; }
  try { const d = await res.json(); return Array.isArray(d) ? d[0] : d; } catch { return true; }
}
async function dbDel(path: string): Promise<boolean> {
  const res = await fetch(`${URL}/rest/v1/${path}`, { method: 'DELETE', headers: getH });
  return res.ok;
}
async function dbGetCount(path: string): Promise<{data:any,count:number}> {
  const res = await fetch(`${URL}/rest/v1/${path}`, { headers: {...getH, 'Prefer':'count=exact'} });
  if (!res.ok) return {data:[],count:0};
  const data = await res.json();
  const cr = res.headers.get('content-range'); let count = Array.isArray(data)?data.length:0;
  if (cr) { const m = cr.match(/\/(\d+)/); if (m) count = parseInt(m[1]); }
  return {data,count};
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY) return;
  try { await fetch('https://api.resend.com/emails', { method:'POST', headers:{'Authorization':`Bearer ${RESEND_API_KEY}`,'Content-Type':'application/json'}, body:JSON.stringify({from:'Access Your Place <notifications@accessyourplace.com>',to:[to],subject,html}) }); } catch(e:any) { console.error('[mp v11] Email err:', e.message); }
}

async function notifySuccessManagers(type: string, data: any) {
  try { await fetch(`${URL}/functions/v1/manage-staff`, { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${KEY}`}, body:JSON.stringify({action:'notify_success_managers',notification_type:type,data}) }); } catch {}
}

async function createNotification(investorId: string, type: string, title: string, message: string, data: any = {}) {
  await dbPost('investor_notifications', { investor_id: investorId, type, title, message, data, read: false });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const json = (d: any) => new Response(JSON.stringify(d), { status:200, headers:{...corsHeaders,'Content-Type':'application/json'} });

  try {
    const body = await req.json().catch(() => ({}));
    const { action } = body;
    console.log('[mp v11] Action:', action);

    // ===== ADD STAFF NOTE TO OFFER =====
    if (action === 'add_staff_note_to_offer') {
      const { offer_id, staff_notes, staff_id, staff_name } = body;
      if (!offer_id) return json({ success:false, error:'Missing offer_id' });
      const offer = await dbGetOne(`marketplace_offers?id=eq.${offer_id}&select=id`);
      if (!offer) return json({ success:false, error:'Offer not found' });
      await dbPatch(`marketplace_offers?id=eq.${offer_id}`, { staff_notes: staff_notes||null, staff_notes_updated_at: new Date().toISOString(), staff_notes_by: staff_name||staff_id||'Staff', updated_at: new Date().toISOString() });
      return json({ success:true });
    }

    // ===== GET ALL NEGOTIATIONS =====
    if (action === 'get_all_negotiations') {
      const { status_filter, search_query, limit: ql = 100 } = body;
      let path = `marketplace_offers?order=created_at.desc&limit=${ql}&select=*`;
      if (status_filter && status_filter !== 'all') path += `&status=eq.${status_filter}`;
      const allOffers = await dbGet(path) || [];
      let filtered = allOffers;
      if (search_query?.trim()) { const sq = search_query.toLowerCase().trim(); filtered = allOffers.filter((o:any) => [o.buyer_name,o.seller_name,o.property_address,o.buyer_email,o.seller_email].some((f:string) => (f||'').toLowerCase().includes(sq))); }
      const negotiations: Record<string,any> = {};
      for (const offer of filtered) {
        const key = `${offer.listing_id}-${offer.buyer_id}`;
        if (!negotiations[key]) { negotiations[key] = { thread_id:key, listing_id:offer.listing_id, buyer_id:offer.buyer_id, seller_id:offer.seller_id, buyer_name:offer.buyer_name, buyer_email:offer.buyer_email, seller_name:offer.seller_name, seller_email:offer.seller_email, property_address:offer.property_address, listing_asking_price:offer.listing_asking_price, offers:[], latest_status:offer.status, latest_amount:offer.offer_amount, latest_date:offer.created_at, total_offers:0, has_staff_notes:false, first_offer_date:offer.created_at, has_pending:false, has_accepted:false }; }
        negotiations[key].offers.push(offer); negotiations[key].total_offers++;
        if (offer.staff_notes) negotiations[key].has_staff_notes = true;
        if (offer.status === 'pending') negotiations[key].has_pending = true;
        if (offer.status === 'accepted') negotiations[key].has_accepted = true;
        if (new Date(offer.created_at) < new Date(negotiations[key].first_offer_date)) negotiations[key].first_offer_date = offer.created_at;
      }
      const now = new Date(); const som = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      return json({ success:true, negotiations:Object.values(negotiations), total_offers:allOffers.length, stats:{ total_negotiations:new Set(allOffers.map((o:any)=>`${o.listing_id}-${o.buyer_id}`)).size, pending_offers:allOffers.filter((o:any)=>o.status==='pending').length, accepted_this_month:allOffers.filter((o:any)=>o.status==='accepted'&&o.responded_at&&o.responded_at>=som).length, total_accepted_value:allOffers.filter((o:any)=>o.status==='accepted').reduce((s:number,o:any)=>s+(o.offer_amount||0),0), avg_offer_amount:allOffers.length>0?Math.round(allOffers.reduce((s:number,o:any)=>s+(o.offer_amount||0),0)/allOffers.length):0, countered_offers:allOffers.filter((o:any)=>o.status==='countered').length, rejected_offers:allOffers.filter((o:any)=>o.status==='rejected').length, total_offers:allOffers.length } });
    }

    // ===== SUBMIT OFFER =====
    if (action === 'submit_offer') {
      const { listing_id, buyer_id, offer_amount, message } = body;
      if (!listing_id||!buyer_id||!offer_amount) return json({ success:false, error:'Missing required fields' });
      if (offer_amount <= 0) return json({ success:false, error:'Offer amount must be positive' });
      const listing = await dbGetOne(`deal_listings?id=eq.${listing_id}&select=id,seller_id,asking_price,status,property_id`);
      if (!listing) return json({ success:false, error:'Listing not found' });
      if (listing.status !== 'active') return json({ success:false, error:'Listing is not active' });
      if (listing.seller_id === buyer_id) return json({ success:false, error:'Cannot make an offer on your own listing' });
      const existing = await dbGet(`marketplace_offers?listing_id=eq.${listing_id}&buyer_id=eq.${buyer_id}&status=eq.pending&select=id`);
      if (existing?.length > 0) return json({ success:false, error:'You already have a pending offer on this listing.' });
      const buyer = await dbGetOne(`investors?id=eq.${buyer_id}&select=full_name,email`);
      const seller = await dbGetOne(`investors?id=eq.${listing.seller_id}&select=full_name,email`);
      const prop = await dbGetOne(`investor_portfolio?id=eq.${listing.property_id}&select=address,city,state`);
      const pa = prop ? `${prop.address}, ${prop.city}, ${prop.state}` : 'Property';
      const offer = await dbPost('marketplace_offers', { listing_id, buyer_id, seller_id:listing.seller_id, offer_amount, message:message||null, offer_type:'initial', status:'pending', buyer_name:buyer?.full_name, buyer_email:buyer?.email, seller_name:seller?.full_name, seller_email:seller?.email, property_address:pa, listing_asking_price:listing.asking_price, expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString() });
      if (!offer) return json({ success:false, error:'Failed to create offer' });
      await createNotification(listing.seller_id, 'marketplace_offer', 'New Offer Received', `${buyer?.full_name||'A buyer'} offered $${offer_amount.toLocaleString()} on ${pa}`, { offer_id:offer.id, listing_id, buyer_name:buyer?.full_name, offer_amount, asking_price:listing.asking_price, property_address:pa });
      await createNotification(buyer_id, 'marketplace_offer_sent', 'Offer Submitted', `Your offer of $${offer_amount.toLocaleString()} for ${pa} has been sent`, { offer_id:offer.id, listing_id, offer_amount, property_address:pa });
      if (seller?.email) { const pct = Math.round((offer_amount/listing.asking_price)*100); await sendEmail(seller.email, `New Offer on Your Listing - $${offer_amount.toLocaleString()}`, `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:#1a365d;color:white;padding:20px;border-radius:8px 8px 0 0;"><h2 style="margin:0;">New Offer Received!</h2></div><div style="padding:20px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;"><p>Hi ${seller.full_name},</p><p><strong>${buyer?.full_name}</strong> has submitted an offer.</p><div style="background:#f8fafc;padding:15px;border-radius:8px;margin:15px 0;"><p style="margin:5px 0;"><strong>Property:</strong> ${pa}</p><p style="margin:5px 0;"><strong>Asking:</strong> $${listing.asking_price.toLocaleString()}</p><p style="margin:5px 0;"><strong>Offer:</strong> <span style="color:#d4a574;font-size:1.2em;font-weight:bold;">$${offer_amount.toLocaleString()}</span> (${pct}%)</p>${message?`<p style="margin:5px 0;"><strong>Message:</strong> ${message}</p>`:''}</div><p>Log in to respond.</p></div></div>`); }
      if (buyer?.email) { await sendEmail(buyer.email, `Offer Submitted - $${offer_amount.toLocaleString()}`, `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><h2 style="color:#1a365d;">Offer Submitted</h2><p>Hi ${buyer.full_name},</p><p>Your offer of <strong>$${offer_amount.toLocaleString()}</strong> for <strong>${pa}</strong> has been sent. The seller has 7 days to respond.</p></div>`); }
      await notifySuccessManagers('marketplace_offer_submitted', { buyer_name:buyer?.full_name, seller_name:seller?.full_name, property_address:pa, offer_amount, asking_price:listing.asking_price });
      return json({ success:true, offer });
    }

    // ===== ACCEPT OFFER =====
    if (action === 'accept_offer') {
      const { offer_id, seller_id, response_message } = body;
      if (!offer_id||!seller_id) return json({ success:false, error:'Missing required fields' });
      const offer = await dbGetOne(`marketplace_offers?id=eq.${offer_id}&seller_id=eq.${seller_id}&status=eq.pending&select=*`);
      if (!offer) return json({ success:false, error:'Offer not found or already responded to' });
      const now = new Date().toISOString();
      await dbPatch(`marketplace_offers?id=eq.${offer_id}`, { status:'accepted', responded_at:now, response_message:response_message||null, updated_at:now });
      await dbPatch(`marketplace_offers?listing_id=eq.${offer.listing_id}&id=neq.${offer_id}&status=eq.pending`, { status:'rejected', responded_at:now, response_message:'Another offer was accepted', updated_at:now });
      await createNotification(offer.buyer_id, 'marketplace_offer_accepted', 'Offer Accepted!', `Your offer of $${offer.offer_amount.toLocaleString()} for ${offer.property_address} has been accepted!`, { offer_id, listing_id:offer.listing_id, offer_amount:offer.offer_amount, property_address:offer.property_address });
      if (offer.buyer_email) await sendEmail(offer.buyer_email, `Offer Accepted! - ${offer.property_address}`, `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:#22c55e;color:white;padding:20px;border-radius:8px 8px 0 0;"><h2 style="margin:0;">Your Offer Has Been Accepted!</h2></div><div style="padding:20px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;"><p>Hi ${offer.buyer_name},</p><p><strong>${offer.seller_name}</strong> accepted your offer of <strong>$${offer.offer_amount.toLocaleString()}</strong> for <strong>${offer.property_address}</strong>.</p><p>An AYP Success Manager will reach out to facilitate the transaction.</p></div></div>`);
      if (offer.seller_email) await sendEmail(offer.seller_email, `You Accepted an Offer - ${offer.property_address}`, `<div style="font-family:sans-serif;"><h2 style="color:#22c55e;">Offer Accepted</h2><p>Hi ${offer.seller_name},</p><p>You accepted ${offer.buyer_name}'s offer of $${offer.offer_amount.toLocaleString()}. Net (80%): $${Math.round(offer.offer_amount*0.8).toLocaleString()}</p></div>`);
      await notifySuccessManagers('marketplace_offer_accepted', { buyer_name:offer.buyer_name, seller_name:offer.seller_name, property_address:offer.property_address, accepted_amount:offer.offer_amount });
      return json({ success:true });
    }

    // ===== REJECT OFFER =====
    if (action === 'reject_offer') {
      const { offer_id, seller_id, response_message } = body;
      if (!offer_id||!seller_id) return json({ success:false, error:'Missing required fields' });
      const offer = await dbGetOne(`marketplace_offers?id=eq.${offer_id}&seller_id=eq.${seller_id}&status=eq.pending&select=*`);
      if (!offer) return json({ success:false, error:'Offer not found or already responded to' });
      await dbPatch(`marketplace_offers?id=eq.${offer_id}`, { status:'rejected', responded_at:new Date().toISOString(), response_message:response_message||null, updated_at:new Date().toISOString() });
      await createNotification(offer.buyer_id, 'marketplace_offer_rejected', 'Offer Not Accepted', `Your offer of $${offer.offer_amount.toLocaleString()} for ${offer.property_address} was not accepted.`, { offer_id, listing_id:offer.listing_id, offer_amount:offer.offer_amount, property_address:offer.property_address });
      if (offer.buyer_email) await sendEmail(offer.buyer_email, `Offer Update - ${offer.property_address}`, `<div style="font-family:sans-serif;"><h2 style="color:#dc2626;">Offer Not Accepted</h2><p>Hi ${offer.buyer_name},</p><p>${offer.seller_name} declined your offer of $${offer.offer_amount.toLocaleString()} for ${offer.property_address}.</p>${response_message?`<p><strong>Message:</strong> ${response_message}</p>`:''}</div>`);
      return json({ success:true });
    }

    // ===== COUNTER OFFER =====
    if (action === 'counter_offer') {
      const { offer_id, responder_id, counter_amount, message } = body;
      if (!offer_id||!responder_id||!counter_amount) return json({ success:false, error:'Missing required fields' });
      if (counter_amount <= 0) return json({ success:false, error:'Counter amount must be positive' });
      const orig = await dbGetOne(`marketplace_offers?id=eq.${offer_id}&status=eq.pending&select=*`);
      if (!orig) return json({ success:false, error:'Offer not found or already responded to' });
      const isSeller = orig.seller_id === responder_id; const isBuyer = orig.buyer_id === responder_id;
      if (!isSeller && !isBuyer) return json({ success:false, error:'You are not a party to this offer' });
      await dbPatch(`marketplace_offers?id=eq.${offer_id}`, { status:'countered', responded_at:new Date().toISOString(), response_message:`Counter offer: $${counter_amount.toLocaleString()}`, updated_at:new Date().toISOString() });
      const counterOffer = await dbPost('marketplace_offers', { listing_id:orig.listing_id, buyer_id:orig.buyer_id, seller_id:orig.seller_id, offer_amount:counter_amount, message:message||null, offer_type:isSeller?'counter_seller':'counter_buyer', status:'pending', buyer_name:orig.buyer_name, buyer_email:orig.buyer_email, seller_name:orig.seller_name, seller_email:orig.seller_email, property_address:orig.property_address, listing_asking_price:orig.listing_asking_price, parent_offer_id:offer_id, expires_at:new Date(Date.now()+7*24*60*60*1000).toISOString() });
      if (!counterOffer) return json({ success:false, error:'Failed to create counter offer' });
      const recipientId = isSeller ? orig.buyer_id : orig.seller_id;
      const senderName = isSeller ? orig.seller_name : orig.buyer_name;
      const recipientEmail = isSeller ? orig.buyer_email : orig.seller_email;
      const recipientName = isSeller ? orig.buyer_name : orig.seller_name;
      await createNotification(recipientId, 'marketplace_counter_offer', 'Counter Offer Received', `${senderName} countered with $${counter_amount.toLocaleString()} for ${orig.property_address}`, { offer_id:counterOffer.id, listing_id:orig.listing_id, counter_amount, previous_amount:orig.offer_amount, property_address:orig.property_address });
      if (recipientEmail) await sendEmail(recipientEmail, `Counter Offer - $${counter_amount.toLocaleString()} - ${orig.property_address}`, `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;"><div style="background:#d4a574;color:white;padding:20px;border-radius:8px 8px 0 0;"><h2 style="margin:0;">Counter Offer</h2></div><div style="padding:20px;border:1px solid #e2e8f0;border-top:0;border-radius:0 0 8px 8px;"><p>Hi ${recipientName},</p><p><strong>${senderName}</strong> countered.</p><div style="background:#fef3c7;padding:15px;border-radius:8px;margin:15px 0;"><p><strong>Previous:</strong> $${orig.offer_amount.toLocaleString()}</p><p><strong>Counter:</strong> <span style="color:#d4a574;font-size:1.2em;font-weight:bold;">$${counter_amount.toLocaleString()}</span></p>${message?`<p><strong>Message:</strong> ${message}</p>`:''}</div></div></div>`);
      return json({ success:true, offer:counterOffer });
    }

    // ===== WITHDRAW OFFER =====
    if (action === 'withdraw_offer') {
      const { offer_id, buyer_id } = body;
      if (!offer_id||!buyer_id) return json({ success:false, error:'Missing required fields' });
      const offer = await dbGetOne(`marketplace_offers?id=eq.${offer_id}&buyer_id=eq.${buyer_id}&status=eq.pending&select=*`);
      if (!offer) return json({ success:false, error:'Offer not found or cannot be withdrawn' });
      await dbPatch(`marketplace_offers?id=eq.${offer_id}`, { status:'withdrawn', updated_at:new Date().toISOString() });
      await createNotification(offer.seller_id, 'marketplace_offer_withdrawn', 'Offer Withdrawn', `${offer.buyer_name} withdrew their offer of $${offer.offer_amount.toLocaleString()} for ${offer.property_address}`, { offer_id, listing_id:offer.listing_id });
      return json({ success:true });
    }

    // ===== GET LISTING OFFERS =====
    if (action === 'get_listing_offers') {
      const { listing_id, investor_id } = body;
      if (!listing_id) return json({ success:false, error:'Missing listing_id' });
      let path = `marketplace_offers?listing_id=eq.${listing_id}&order=created_at.desc&select=*`;
      if (investor_id) path += `&or=(buyer_id.eq.${investor_id},seller_id.eq.${investor_id})`;
      return json({ success:true, offers: await dbGet(path) || [] });
    }

    // ===== GET SELLER/BUYER OFFERS =====
    if (action === 'get_seller_offers') {
      return json({ success:true, offers: await dbGet(`marketplace_offers?seller_id=eq.${body.seller_id}&order=created_at.desc&select=*`) || [] });
    }
    if (action === 'get_buyer_offers') {
      return json({ success:true, offers: await dbGet(`marketplace_offers?buyer_id=eq.${body.buyer_id}&order=created_at.desc&select=*`) || [] });
    }

    // ===== MARK AS SOLD =====
    if (action === 'mark_as_sold') {
      const { listing_id, offer_id, staff_id, staff_name, staff_notes } = body;
      if (!listing_id) return json({ success:false, error:'Missing listing_id' });
      const listing = await dbGetOne(`deal_listings?id=eq.${listing_id}&select=*`);
      if (!listing) return json({ success:false, error:'Listing not found' });
      const prop = listing.property_id ? await dbGetOne(`investor_portfolio?id=eq.${listing.property_id}&select=*`) : null;
      let acceptedOffer: any = null;
      if (offer_id) { acceptedOffer = await dbGetOne(`marketplace_offers?id=eq.${offer_id}&select=*`); }
      else { const ofrs = await dbGet(`marketplace_offers?listing_id=eq.${listing_id}&status=eq.accepted&order=responded_at.desc&limit=1&select=*`); acceptedOffer = ofrs?.[0] || null; }
      const finalPrice = acceptedOffer?.offer_amount || listing.asking_price;
      const buyerName = acceptedOffer?.buyer_name || listing.buyer_investor_name || 'Unknown Buyer';
      const buyerEmail = acceptedOffer?.buyer_email || listing.buyer_investor_email || null;
      const buyerId = acceptedOffer?.buyer_id || listing.buyer_investor_id || null;
      const sellerId = listing.seller_id;
      const pa = prop ? `${prop.address}, ${prop.city}, ${prop.state}` : 'Property';
      const aypFee = Math.round(finalPrice * 0.2); const sellerNet = Math.round(finalPrice * 0.8);
      const seller = await dbGetOne(`investors?id=eq.${sellerId}&select=full_name,email`);
      const sellerName = seller?.full_name || acceptedOffer?.seller_name || 'Unknown Seller';
      const sellerEmail = seller?.email || acceptedOffer?.seller_email || null;
      const now = new Date().toISOString();
      await dbPatch(`deal_listings?id=eq.${listing_id}`, { status:'sold', sold_at:now, sold_price:finalPrice, sold_offer_id:acceptedOffer?.id||null, buyer_investor_id:buyerId, buyer_investor_name:buyerName, buyer_investor_email:buyerEmail, updated_at:now });
      await dbPatch(`marketplace_offers?listing_id=eq.${listing_id}&status=eq.pending`, { status:'rejected', responded_at:now, response_message:'Listing has been marked as sold', updated_at:now });
      const closedDeal = await dbPost('marketplace_closed_deals', { listing_id, offer_id:acceptedOffer?.id||null, property_id:listing.property_id, buyer_id:buyerId, seller_id:sellerId, buyer_name:buyerName, buyer_email:buyerEmail, seller_name:sellerName, seller_email:sellerEmail, property_address:pa, final_sale_price:finalPrice, asking_price:listing.asking_price, ayp_fee:aypFee, seller_net:sellerNet, operation_type:listing.operation_type, monthly_revenue:listing.monthly_revenue||listing.projected_monthly_revenue||0, closed_by_staff_id:staff_id||null, closed_by_staff_name:staff_name||'Staff', staff_notes:staff_notes||null, transaction_date:now, acquisition_workflow_created:false });
      let workflowCreated = false;
      if (listing.property_id && buyerId) {
        try {
          const WS = [{stage:'payment_received',order:1},{stage:'application_process',order:2},{stage:'lease_review',order:3},{stage:'setup_furniture',order:4},{stage:'setup_software',order:5},{stage:'setup_utilities',order:6},{stage:'vendor_matching',order:7},{stage:'marketing_launch',order:8},{stage:'completed',order:9}];
          await dbPatch(`investor_portfolio?id=eq.${listing.property_id}`, { investor_id:buyerId, status:'in_acquisition' });
          for (const s of WS) { try { await dbPost('acquisition_workflow', { property_id:listing.property_id, investor_id:buyerId, stage:s.stage, stage_order:s.order, status:s.order===1?'in_progress':'pending' }); } catch {} }
          workflowCreated = true;
          if (closedDeal?.id) await dbPatch(`marketplace_closed_deals?id=eq.${closedDeal.id}`, { acquisition_workflow_created:true });
        } catch (e:any) { console.error('[mp v11] Workflow err:', e.message); }
      }
      if (buyerId) await createNotification(buyerId, 'marketplace_deal_sold', 'Deal Finalized!', `Your acquisition of ${pa} is complete! Final price: $${finalPrice.toLocaleString()}`, { listing_id, final_price:finalPrice, property_address:pa });
      await createNotification(sellerId, 'marketplace_deal_sold', 'Your Operation Has Been Sold!', `${pa} sold for $${finalPrice.toLocaleString()}. Your net: $${sellerNet.toLocaleString()}`, { listing_id, final_price:finalPrice, seller_net:sellerNet, property_address:pa });
      if (buyerEmail) await sendEmail(buyerEmail, `Congratulations! Acquisition Complete - ${pa}`, `<div style="font-family:sans-serif;"><h2 style="color:#1a365d;">Congratulations!</h2><p>Hi ${buyerName},</p><p>Your acquisition of <strong>${pa}</strong> is complete! Final price: $${finalPrice.toLocaleString()}</p></div>`);
      if (sellerEmail) await sendEmail(sellerEmail, `Your Operation Has Been Sold! - ${pa}`, `<div style="font-family:sans-serif;"><h2 style="color:#166534;">Sale Complete!</h2><p>Hi ${sellerName},</p><p>${pa} sold for $${finalPrice.toLocaleString()}. AYP Fee: $${aypFee.toLocaleString()}. Your Net: $${sellerNet.toLocaleString()}</p></div>`);
      await notifySuccessManagers('marketplace_deal_sold', { buyer_name:buyerName, seller_name:sellerName, property_address:pa, final_price:finalPrice, ayp_fee:aypFee, seller_net:sellerNet, closed_by:staff_name||'Staff' });
      return json({ success:true, closed_deal:closedDeal, workflow_created:workflowCreated, message:`Deal marked as sold. Final price: $${finalPrice.toLocaleString()}.` });
    }

    // ===== GET CLOSED DEALS =====
    if (action === 'get_closed_deals') {
      const { limit: ql=50, offset=0, search_query } = body;
      const { data: deals, count } = await dbGetCount(`marketplace_closed_deals?order=transaction_date.desc&offset=${offset}&limit=${ql}&select=*`);
      let filtered = deals || [];
      if (search_query?.trim()) { const sq = search_query.toLowerCase().trim(); filtered = filtered.filter((d:any) => [d.buyer_name,d.seller_name,d.property_address].some((f:string) => (f||'').toLowerCase().includes(sq))); }
      const all = deals || []; const nd = new Date(); const som = new Date(nd.getFullYear(), nd.getMonth(), 1).toISOString();
      const tm = all.filter((d:any) => d.transaction_date >= som);
      return json({ success:true, deals:filtered, total:count, stats:{ total_closed:all.length, this_month:tm.length, total_revenue:all.reduce((s:number,d:any)=>s+(d.final_sale_price||0),0), total_ayp_fees:all.reduce((s:number,d:any)=>s+(d.ayp_fee||0),0), this_month_revenue:tm.reduce((s:number,d:any)=>s+(d.final_sale_price||0),0), avg_deal_size:all.length>0?Math.round(all.reduce((s:number,d:any)=>s+(d.final_sale_price||0),0)/all.length):0 } });
    }

    // ===== GET PUBLIC MARKETPLACE LISTINGS =====
    if (action === 'get_public_listings') {
      const { filters, page=1, limit=24, sort='newest' } = body;
      let path = `deal_listings?listing_type=eq.public&status=eq.active&select=*,property:investor_portfolio(*)`;
      if (filters?.operation_type?.length > 0) path += `&operation_type=in.(${filters.operation_type.join(',')})`;
      if (filters?.min_price) path += `&asking_price=gte.${filters.min_price}`;
      if (filters?.max_price) path += `&asking_price=lte.${filters.max_price}`;
      switch (sort) { case 'price_low': path += '&order=asking_price.asc'; break; case 'price_high': path += '&order=asking_price.desc'; break; default: path += '&order=created_at.desc'; }
      const offset = (page-1)*limit; path += `&offset=${offset}&limit=${limit}`;
      const { data: listings, count } = await dbGetCount(path);
      return json({ success:true, listings:listings||[], total:count, page, limit, total_pages:Math.ceil(count/limit) });
    }

    // ===== GET MARKETPLACE DATA =====
    if (action === 'get_marketplace_data') {
      const { investor_id } = body;
      if (!investor_id) return json({ success:true, my_listings:[], received_deals:[], portfolio:[] });
      const listings = await dbGet(`deal_listings?seller_id=eq.${investor_id}&order=created_at.desc&select=*,property:investor_portfolio(*)`);
      const received = await dbGet(`deal_listings?buyer_investor_id=eq.${investor_id}&listing_type=eq.private&order=created_at.desc&select=*,property:investor_portfolio(*)`);
      const portfolio = await dbGet(`investor_portfolio?investor_id=eq.${investor_id}&status=eq.active&select=*`);
      return json({ success:true, my_listings:listings||[], received_deals:(received||[]).map((r:any)=>({ id:r.id, listing:r, seller_name:'Unknown', seller_email:'', sent_at:r.created_at, status:r.status==='active'?'pending':r.status })), portfolio:portfolio||[] });
    }

    // ===== GET MY SELLER LISTINGS =====
    if (action === 'get_my_seller_listings') {
      const { investor_id } = body;
      if (!investor_id) return json({ success:true, listings:[] });
      const listings = await dbGet(`deal_listings?seller_id=eq.${investor_id}&listing_type=eq.public&order=created_at.desc&select=*,property:investor_portfolio(*)`);
      const needsChangesIds = (listings||[]).filter((l:any)=>l.status==='needs_changes').map((l:any)=>l.id);
      let changesMap: Record<string,string> = {};
      if (needsChangesIds.length > 0) { try { const alerts = await dbGet(`marketplace_verification_alerts?listing_id=in.(${needsChangesIds.join(',')})&status=eq.needs_changes&select=listing_id,changes_requested`); if (alerts) for (const a of alerts) if (a.changes_requested) changesMap[a.listing_id] = a.changes_requested; } catch {} for (const l of (listings||[])) if (l.status==='needs_changes'&&l.changes_requested&&!changesMap[l.id]) changesMap[l.id]=l.changes_requested; }
      const activeIds = (listings||[]).filter((l:any)=>l.status==='active').map((l:any)=>l.id);
      let offerCountMap: Record<string,number> = {}; let pendingOfferMap: Record<string,number> = {};
      if (activeIds.length > 0) { try { const oc = await dbGet(`marketplace_offers?listing_id=in.(${activeIds.join(',')})&select=listing_id,status`); if (oc) for (const o of oc) { offerCountMap[o.listing_id]=(offerCountMap[o.listing_id]||0)+1; if (o.status==='pending') pendingOfferMap[o.listing_id]=(pendingOfferMap[o.listing_id]||0)+1; } } catch {} }
      return json({ success:true, listings:(listings||[]).map((l:any)=>({...l, changes_requested:changesMap[l.id]||l.changes_requested||null, offer_count:offerCountMap[l.id]||0, pending_offer_count:pendingOfferMap[l.id]||0 })) });
    }

    // ===== GET SINGLE LISTING DETAILS =====
    if (action === 'get_listing_details') {
      const { listing_id, investor_id } = body;
      if (!listing_id) return json({ success:false, error:'Missing listing_id' });
      let path = `deal_listings?id=eq.${listing_id}&select=*,property:investor_portfolio(*)`;
      if (investor_id) path += `&seller_id=eq.${investor_id}`;
      const listing = await dbGetOne(path);
      if (!listing) return json({ success:false, error:'Listing not found' });
      let cr = listing.changes_requested || null;
      if (listing.status==='needs_changes'&&!cr) { try { const alert = await dbGetOne(`marketplace_verification_alerts?listing_id=eq.${listing_id}&status=eq.needs_changes&order=reviewed_at.desc&limit=1&select=changes_requested`); if (alert?.changes_requested) cr = alert.changes_requested; } catch {} }
      return json({ success:true, listing:{...listing, changes_requested:cr} });
    }

    // ===== GET MARKETPLACE STATS =====
    if (action === 'get_marketplace_stats') {
      const listings = await dbGet('deal_listings?status=eq.active&listing_type=eq.public&select=operation_type,status,asking_price') || [];
      return json({ success:true, stats:{ total_active:listings.length, by_type:{ str:listings.filter((l:any)=>l.operation_type==='str'||!l.operation_type).length, coliving:listings.filter((l:any)=>l.operation_type==='coliving').length, both:listings.filter((l:any)=>l.operation_type==='both').length, peerspace:listings.filter((l:any)=>l.operation_type==='peerspace').length }, avg_price:listings.length>0?Math.round(listings.reduce((s:number,l:any)=>s+(l.asking_price||0),0)/listings.length):0, total_value:listings.reduce((s:number,l:any)=>s+(l.asking_price||0),0) } });
    }

    // ===== CREATE LISTING =====
    if (action === 'create_listing') {
      const { investor_id, property_id, listing_type, buyer_investor_id, asking_price, description, monthly_revenue, monthly_expenses, lease_months_remaining, is_furnished, landlord_verification_call_agreed, has_lease_proof, landlord_approval_confirmed, acquisition_cost, furniture_ownership, has_upcoming_bookings, upcoming_bookings_details, projected_monthly_revenue, adr, occupancy_rate, monthly_rent, operation_type, inventory_list, video_walkthrough_url, proof_of_lease_urls, financial_data_urls, property_photo_urls, seller_tos_agreed } = body;
      if (!investor_id||!property_id) return json({ success:false, error:'Missing required fields' });
      if (listing_type==='public') { const inv = await dbGetOne(`investors?id=eq.${investor_id}&select=seller_tos_agreed,full_name,email`); if (!inv?.seller_tos_agreed&&!seller_tos_agreed) return json({ success:false, error:'You must agree to the Third-Party Seller Terms of Service.' }); if (seller_tos_agreed&&!inv?.seller_tos_agreed) await dbPatch(`investors?id=eq.${investor_id}`, { seller_tos_agreed:true, seller_tos_agreed_at:new Date().toISOString() }); }
      const investor = await dbGetOne(`investors?id=eq.${investor_id}&select=full_name,email`);
      const property = await dbGetOne(`investor_portfolio?id=eq.${property_id}&select=*`);
      const listing = await dbPost('deal_listings', { seller_id:investor_id, property_id, listing_type, buyer_investor_id:listing_type==='private'?buyer_investor_id:null, asking_price:acquisition_cost||asking_price, description, monthly_revenue:projected_monthly_revenue||monthly_revenue, monthly_expenses:monthly_rent||monthly_expenses, lease_months_remaining, status:listing_type==='public'?'pending_approval':'active', is_furnished, landlord_verification_call_agreed, has_lease_proof, landlord_approval_confirmed, acquisition_cost, furniture_ownership, has_upcoming_bookings, upcoming_bookings_details, projected_monthly_revenue, adr, occupancy_rate, monthly_rent, operation_type, inventory_list:inventory_list||null, video_walkthrough_url:video_walkthrough_url||null, proof_of_lease_urls:proof_of_lease_urls||null, financial_data_urls:financial_data_urls||null, property_photo_urls:property_photo_urls||null, seller_tos_agreed:listing_type==='public'?true:null, seller_tos_agreed_at:listing_type==='public'?new Date().toISOString():null });
      if (!listing) return json({ success:false, error:'Failed to create listing' });
      const pa = property ? `${property.address}, ${property.city}, ${property.state}` : 'Property';
      if (listing_type==='public') {
        await notifySuccessManagers('marketplace_listing', { investor_name:investor?.full_name, investor_email:investor?.email, property_address:pa, asking_price:acquisition_cost||asking_price, monthly_revenue:projected_monthly_revenue||monthly_revenue, listing_type:'public' });
        try { await dbPost('marketplace_verification_alerts', { listing_id:listing.id, investor_id, investor_email:investor?.email, investor_name:investor?.full_name, property_address:pa, listing_type:'public_sale', asking_price:acquisition_cost||asking_price, priority:'normal', status:'pending' }); } catch {}
        if (investor?.email) await sendEmail(investor.email, 'Your Listing Has Been Submitted', `<div style="font-family:sans-serif;"><h2 style="color:#1a365d;">Listing Submitted for Review</h2><p>Hi ${investor.full_name},</p><p>Your listing for <strong>${pa}</strong> has been submitted.</p></div>`);
      } else if (listing_type==='private'&&buyer_investor_id) {
        const buyer = await dbGetOne(`investors?id=eq.${buyer_investor_id}&select=full_name,email`);
        if (buyer?.email) await sendEmail(buyer.email, `Private Deal from ${investor?.full_name}`, `<div style="font-family:sans-serif;"><h2 style="color:#1a365d;">You've Received a Private Deal!</h2><p>Hi ${buyer.full_name},</p><p><strong>${investor?.full_name}</strong> sent you a private deal for ${pa}.</p></div>`);
        await dbPatch(`deal_listings?id=eq.${listing.id}`, { buyer_investor_name:buyer?.full_name, buyer_investor_email:buyer?.email });
        if (buyer_investor_id) await createNotification(buyer_investor_id, 'marketplace_private_deal', 'New Private Deal', `${investor?.full_name} sent you a private deal for ${pa}`, { listing_id:listing.id, property_address:pa, asking_price:acquisition_cost||asking_price });
      }
      return json({ success:true, listing });
    }

    // ===== UPDATE LISTING =====
    if (action === 'update_listing') {
      const { listing_id, investor_id, updates } = body;
      if (!listing_id||!investor_id) return json({ success:false, error:'Missing required fields' });
      await dbPatch(`deal_listings?id=eq.${listing_id}&seller_id=eq.${investor_id}`, { ...updates, updated_at:new Date().toISOString() });
      return json({ success:true });
    }

    // ===== STAFF UPDATE LISTING =====
    if (action === 'staff_update_listing') {
      const { listing_id, staff_id, staff_name, updates } = body;
      if (!listing_id) return json({ success:false, error:'Missing listing_id' });
      const updateData: Record<string,any> = { ...updates, updated_at:new Date().toISOString() };
      const updated = await dbPatch(`deal_listings?id=eq.${listing_id}`, updateData);
      return json({ success:true, listing:updated||null });
    }

    // ===== RESUBMIT LISTING =====
    if (action === 'resubmit_listing') {
      const { listing_id, investor_id, updates } = body;
      if (!listing_id||!investor_id) return json({ success:false, error:'Missing required fields' });
      const existing = await dbGetOne(`deal_listings?id=eq.${listing_id}&seller_id=eq.${investor_id}&select=id,status,seller_id,resubmit_count,property_id`);
      if (!existing) return json({ success:false, error:'Listing not found' });
      if (existing.status!=='needs_changes') return json({ success:false, error:'Only needs_changes listings can be resubmitted' });
      const allowedFields = ['asking_price','description','operation_type','lease_months_remaining','is_furnished','projected_monthly_revenue','adr','occupancy_rate','monthly_rent','monthly_revenue','monthly_expenses','inventory_list','video_walkthrough_url','has_lease_proof','proof_of_lease_urls','financial_data_urls','property_photo_urls','acquisition_cost'];
      const updateData: Record<string,any> = { status:'pending_approval', updated_at:new Date().toISOString(), resubmitted_at:new Date().toISOString(), resubmit_count:(existing.resubmit_count||0)+1, changes_requested:null };
      if (updates && typeof updates==='object') { for (const f of allowedFields) if (updates[f]!==undefined) updateData[f]=updates[f]; if (updates.asking_price!==undefined) updateData.acquisition_cost=updates.asking_price; }
      await dbPatch(`deal_listings?id=eq.${listing_id}&seller_id=eq.${investor_id}`, updateData);
      try { await dbPatch(`marketplace_verification_alerts?listing_id=eq.${listing_id}`, { status:'pending', changes_requested:null, reviewed_at:null, reviewed_by_staff_id:null, checklist_lease_verified:false, checklist_landlord_called:false, checklist_financials_reviewed:false, checklist_photos_verified:false }); } catch {}
      const investorData = await dbGetOne(`investors?id=eq.${investor_id}&select=full_name,email`);
      const property = await dbGetOne(`investor_portfolio?id=eq.${existing.property_id}&select=address,city,state`);
      const pa = property ? `${property.address}, ${property.city}, ${property.state}` : 'Property';
      await notifySuccessManagers('marketplace_listing_resubmitted', { investor_name:investorData?.full_name, property_address:pa, listing_id });
      if (investorData?.email) await sendEmail(investorData.email, 'Listing Resubmitted', `<div style="font-family:sans-serif;"><h2 style="color:#1a365d;">Listing Resubmitted</h2><p>Hi ${investorData.full_name},</p><p>Your updated listing for <strong>${pa}</strong> has been resubmitted.</p></div>`);
      return json({ success:true });
    }

    // ===== SEARCH INVESTORS =====
    if (action === 'search_investors') {
      const { search_query, exclude_investor_id } = body;
      if (!search_query||search_query.length<2) return json({ success:true, investors:[] });
      let path = `investors?or=(full_name.ilike.%25${encodeURIComponent(search_query)}%25,email.ilike.%25${encodeURIComponent(search_query)}%25,phone.ilike.%25${encodeURIComponent(search_query)}%25)&limit=10&select=id,full_name,email,phone`;
      if (exclude_investor_id) path += `&id=neq.${exclude_investor_id}`;
      return json({ success:true, investors: await dbGet(path) || [] });
    }

    // ===== CANCEL/DELETE/DECLINE LISTING =====
    if (action === 'cancel_listing') {
      await dbPatch(`deal_listings?id=eq.${body.listing_id}&seller_id=eq.${body.investor_id}`, { status:'cancelled', updated_at:new Date().toISOString() });
      return json({ success:true });
    }
    if (action === 'delete_listing') {
      const { listing_id, investor_id } = body;
      if (!listing_id) return json({ success:false, error:'Missing listing_id' });
      try { await dbDel(`marketplace_offers?listing_id=eq.${listing_id}`); } catch {}
      try { await dbDel(`marketplace_verification_alerts?listing_id=eq.${listing_id}`); } catch {}
      let path = `deal_listings?id=eq.${listing_id}`;
      if (investor_id) path += `&seller_id=eq.${investor_id}`;
      const ok = await dbDel(path);
      if (!ok) { await dbPatch(`deal_listings?id=eq.${listing_id}`, { status:'cancelled', updated_at:new Date().toISOString() }); return json({ success:true, message:'Listing cancelled (soft delete)' }); }
      return json({ success:true, message:'Listing deleted' });
    }
    if (action === 'decline_deal') {
      await dbPatch(`deal_listings?id=eq.${body.listing_id}&buyer_investor_id=eq.${body.investor_id}`, { status:'declined' });
      return json({ success:true });
    }

    // ===== EXPRESS INTEREST =====
    if (action === 'express_interest') {
      const { listing_id, investor_id, message } = body;
      const investor = await dbGetOne(`investors?id=eq.${investor_id}&select=full_name,email,phone`);
      try { await dbPost('marketplace_interests', { listing_id, investor_id, investor_name:investor?.full_name, investor_email:investor?.email, message, status:'pending' }); } catch {}
      return json({ success:true });
    }

    // ===== GET VERIFICATION QUEUE =====
    if (action === 'get_verification_queue') {
      const { status_filter, priority_filter } = body;
      let path = 'marketplace_verification_alerts?order=created_at.desc&select=*';
      if (status_filter&&status_filter!=='all') path += `&status=eq.${status_filter}`;
      if (priority_filter&&priority_filter!=='all') path += `&priority=eq.${priority_filter}`;
      return json({ success:true, alerts: await dbGet(path) || [] });
    }

    // ===== SAVE VERIFICATION CHECKLIST =====
    if (action === 'save_verification_checklist') {
      const { listing_id, staff_id, checklist } = body;
      if (!listing_id) return json({ success:false, error:'Missing listing_id' });
      const cd: Record<string,any> = {};
      if (checklist) { if (checklist.lease_verified!==undefined) cd.checklist_lease_verified=checklist.lease_verified; if (checklist.landlord_called!==undefined) cd.checklist_landlord_called=checklist.landlord_called; if (checklist.financials_reviewed!==undefined) cd.checklist_financials_reviewed=checklist.financials_reviewed; if (checklist.photos_verified!==undefined) cd.checklist_photos_verified=checklist.photos_verified; }
      try { await dbPatch(`marketplace_verification_alerts?listing_id=eq.${listing_id}`, cd); } catch {}
      const dlData: Record<string,any> = {};
      if (checklist?.lease_verified!==undefined) dlData.verification_lease_verified=checklist.lease_verified;
      if (checklist?.landlord_called!==undefined) dlData.verification_landlord_called=checklist.landlord_called;
      if (checklist?.financials_reviewed!==undefined) dlData.verification_financials_reviewed=checklist.financials_reviewed;
      if (checklist?.photos_verified!==undefined) dlData.verification_photos_verified=checklist.photos_verified;
      if (staff_id) dlData.verification_completed_by=staff_id;
      try { await dbPatch(`deal_listings?id=eq.${listing_id}`, dlData); } catch {}
      return json({ success:true });
    }

    // ===== APPROVE LISTING =====
    if (action === 'approve_listing') {
      const { listing_id, staff_id, checklist } = body;
      if (!listing_id) return json({ success:false, error:'Missing listing_id' });
      const now = new Date().toISOString();
      const lu: Record<string,any> = { status:'active', approved_at:now, changes_requested:null, verification_completed_by:staff_id||null, verification_completed_at:now };
      if (checklist) { lu.verification_lease_verified=!!checklist.lease_verified; lu.verification_landlord_called=!!checklist.landlord_called; lu.verification_financials_reviewed=!!checklist.financials_reviewed; lu.verification_photos_verified=!!checklist.photos_verified; }
      const upd = await dbPatch(`deal_listings?id=eq.${listing_id}`, lu);
      if (!upd) { await dbPatch(`deal_listings?id=eq.${listing_id}`, { status:'active', updated_at:now }); }
      try { const au: Record<string,any> = { status:'approved', reviewed_by_staff_id:staff_id, reviewed_at:now }; if (checklist) { au.checklist_lease_verified=!!checklist.lease_verified; au.checklist_landlord_called=!!checklist.landlord_called; au.checklist_financials_reviewed=!!checklist.financials_reviewed; au.checklist_photos_verified=!!checklist.photos_verified; } await dbPatch(`marketplace_verification_alerts?listing_id=eq.${listing_id}`, au); } catch {}
      const listing = await dbGetOne(`deal_listings?id=eq.${listing_id}&select=seller_id,property_id`);
      const seller = listing?.seller_id ? await dbGetOne(`investors?id=eq.${listing.seller_id}&select=full_name,email`) : null;
      const prop = listing?.property_id ? await dbGetOne(`investor_portfolio?id=eq.${listing.property_id}&select=address,city,state`) : null;
      const pa = prop ? `${prop.address}, ${prop.city}, ${prop.state}` : 'Property';
      if (listing?.seller_id) await createNotification(listing.seller_id, 'marketplace_listing_approved', 'Listing Approved!', `Your listing for ${pa} is now live!`, { listing_id, property_address:pa });
      if (seller?.email) await sendEmail(seller.email, 'Your Listing Has Been Approved!', `<div style="font-family:sans-serif;"><h2 style="color:#22c55e;">Listing Approved!</h2><p>Hi ${seller.full_name},</p><p>Your listing for <strong>${pa}</strong> is now live on the AYP Marketplace.</p></div>`);
      return json({ success:true });
    }

    // ===== REJECT LISTING =====
    if (action === 'reject_listing') {
      const { listing_id, staff_id, rejection_reason } = body;
      await dbPatch(`deal_listings?id=eq.${listing_id}`, { status:'rejected', rejection_reason, rejected_at:new Date().toISOString(), changes_requested:null });
      try { await dbPatch(`marketplace_verification_alerts?listing_id=eq.${listing_id}`, { status:'rejected', verification_notes:rejection_reason, reviewed_by_staff_id:staff_id, reviewed_at:new Date().toISOString() }); } catch {}
      const listing = await dbGetOne(`deal_listings?id=eq.${listing_id}&select=seller_id`);
      const seller = listing?.seller_id ? await dbGetOne(`investors?id=eq.${listing.seller_id}&select=full_name,email`) : null;
      if (listing?.seller_id) await createNotification(listing.seller_id, 'marketplace_listing_rejected', 'Listing Not Approved', `Your listing was not approved.${rejection_reason?` Reason: ${rejection_reason}`:''}`, { listing_id, rejection_reason });
      if (seller?.email) await sendEmail(seller.email, 'Update on Your Listing', `<div style="font-family:sans-serif;"><h2 style="color:#dc2626;">Listing Not Approved</h2><p>Hi ${seller.full_name},</p>${rejection_reason?`<p><strong>Reason:</strong> ${rejection_reason}</p>`:''}</div>`);
      return json({ success:true });
    }

    // ===== REQUEST CHANGES =====
    if (action === 'request_listing_changes') {
      const { listing_id, staff_id, changes_requested } = body;
      await dbPatch(`deal_listings?id=eq.${listing_id}`, { status:'needs_changes', changes_requested:changes_requested||null });
      try { await dbPatch(`marketplace_verification_alerts?listing_id=eq.${listing_id}`, { status:'needs_changes', changes_requested, reviewed_by_staff_id:staff_id, reviewed_at:new Date().toISOString() }); } catch {}
      const listing = await dbGetOne(`deal_listings?id=eq.${listing_id}&select=seller_id`);
      const seller = listing?.seller_id ? await dbGetOne(`investors?id=eq.${listing.seller_id}&select=full_name,email`) : null;
      if (listing?.seller_id) await createNotification(listing.seller_id, 'marketplace_changes_requested', 'Changes Requested', `Changes were requested: ${changes_requested}`, { listing_id, changes_requested });
      if (seller?.email) await sendEmail(seller.email, 'Changes Requested for Your Listing', `<div style="font-family:sans-serif;"><h2 style="color:#f59e0b;">Changes Requested</h2><p>Hi ${seller.full_name},</p><div style="background:#fef3c7;padding:15px;border-radius:8px;"><p><strong>Changes:</strong></p><p>${changes_requested}</p></div><p>Please edit and resubmit.</p></div>`);
      return json({ success:true });
    }

    // ===== GET PENDING =====
    if (action === 'get_pending_verifications') { try { return json({ success:true, verifications: await dbGet('deal_verifications?status=in.(pending,in_progress)&order=created_at.desc&select=*') || [] }); } catch { return json({ success:true, verifications:[] }); } }
    if (action === 'get_pending_listings') { try { return json({ success:true, listings: await dbGet('deal_listings?status=eq.pending_approval&listing_type=eq.public&order=created_at.desc&select=*,property:investor_portfolio(*)') || [] }); } catch { return json({ success:true, listings:[] }); } }

    // ===== GET OFFER COUNTS =====
    if (action === 'get_offer_counts') {
      const { listing_ids } = body;
      if (!listing_ids||!Array.isArray(listing_ids)||listing_ids.length===0) return json({ success:true, counts:{} });
      const offers = await dbGet(`marketplace_offers?listing_id=in.(${listing_ids.join(',')})&select=listing_id,status`);
      const counts: Record<string,{total:number;pending:number}> = {};
      for (const o of (offers||[])) { if (!counts[o.listing_id]) counts[o.listing_id]={total:0,pending:0}; counts[o.listing_id].total++; if (o.status==='pending') counts[o.listing_id].pending++; }
      return json({ success:true, counts });
    }

    return json({ success:false, error:`Unknown action: ${action}` });
  } catch (error: any) {
    console.error('[mp v11] Error:', error.message);
    return json({ success:false, error:error.message });
  }
});

