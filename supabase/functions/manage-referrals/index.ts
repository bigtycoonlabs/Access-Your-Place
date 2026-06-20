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

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

async function db(path: string, method: string, body?: any) {
  const url = Deno.env.get('SUPABASE_URL')!;
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const res = await fetch(`${url}/rest/v1/${path}`, {
    method, headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json', 'Prefer': method === 'POST' ? 'return=representation' : 'return=minimal' },
    body: body ? JSON.stringify(body) : undefined
  });
  return method === 'GET' || method === 'POST' ? res.json() : res.ok;
}

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = Deno.env.get('RESEND_API_KEY');
  if (!apiKey) return;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Access Your Place <notifications@accessyourplace.com>', to, subject, html })
    });
  } catch (e) { console.error('Email error:', e); }
}

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'AYP-';
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

function getNextFridayPayout(): Date {
  const now = new Date();
  const estOffset = -5 * 60;
  const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
  const est = new Date(utc + (estOffset * 60000));
  
  const dayOfWeek = est.getDay();
  const hour = est.getHours();
  
  let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  if (daysUntilFriday === 0 && hour >= 12) {
    daysUntilFriday = 7;
  } else if (daysUntilFriday === 0 && hour < 12) {
    daysUntilFriday = 0;
  }
  
  const nextFriday = new Date(est);
  nextFriday.setDate(est.getDate() + daysUntilFriday);
  nextFriday.setHours(12, 0, 0, 0);
  
  return nextFriday;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { action, ...p } = await req.json();
    const url = Deno.env.get('SUPABASE_URL')!;
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    if (action === 'get_referral_code') {
      let inv = await db(`investors?id=eq.${p.investor_id}&select=referral_code`, 'GET');
      if (!inv?.[0]?.referral_code) {
        const code = genCode();
        await fetch(`${url}/rest/v1/investors?id=eq.${p.investor_id}`, { method: 'PATCH', headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ referral_code: code }) });
        return new Response(JSON.stringify({ referral_code: code }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ referral_code: inv[0].referral_code }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_referrals') {
      const data = await db(`investor_referrals?referrer_id=eq.${p.investor_id}&order=created_at.desc&select=*,referred:referred_id(full_name,email)`, 'GET');
      return new Response(JSON.stringify({ referrals: data || [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_rewards') {
      const rewards = await db(`referral_rewards?referrer_id=eq.${p.investor_id}&order=created_at.desc&select=*`, 'GET');
      const credits = await db(`investor_credits?investor_id=eq.${p.investor_id}&select=*`, 'GET');
      const payouts = await db(`referral_payouts?referrer_id=eq.${p.investor_id}&order=created_at.desc&select=*`, 'GET');
      const total = (credits || []).reduce((s: number, c: any) => s + (parseFloat(c.amount) - parseFloat(c.used_amount || 0)), 0);
      const totalEarned = (payouts || []).filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + parseFloat(p.amount), 0);
      return new Response(JSON.stringify({ rewards: rewards || [], credits: credits || [], payouts: payouts || [], total_credits: total, total_earned: totalEarned }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_payout_preferences') {
      const inv = await db(`investors?id=eq.${p.investor_id}&select=payout_method,payout_details`, 'GET');
      return new Response(JSON.stringify({ payout_method: inv?.[0]?.payout_method || 'yp_credit', payout_details: inv?.[0]?.payout_details || {} }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'update_payout_preferences') {
      await fetch(`${url}/rest/v1/investors?id=eq.${p.investor_id}`, {
        method: 'PATCH',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ payout_method: p.payout_method, payout_details: p.payout_details })
      });
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'add_manual_referral') {
      // Add a previously received referral manually
      const referral = await db('investor_referrals', 'POST', {
        referrer_id: p.investor_id,
        referred_email: p.referred_email,
        referred_name: p.referred_name,
        status: 'rewarded',
        is_manual_entry: true,
        manual_entry_date: p.payout_date,
        manual_entry_notes: p.notes,
        signup_at: p.payout_date,
        qualified_at: p.payout_date
      });
      return new Response(JSON.stringify({ success: true, referral }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'track_signup') {
      const referrer = await db(`investors?referral_code=eq.${p.referral_code}&select=id,full_name,email`, 'GET');
      if (referrer?.[0]) {
        await db('investor_referrals', 'POST', { referrer_id: referrer[0].id, referred_id: p.new_investor_id, status: 'signed_up', signup_at: new Date().toISOString() });
        await fetch(`${url}/rest/v1/investors?id=eq.${p.new_investor_id}`, { method: 'PATCH', headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ referred_by: referrer[0].id }) });
        
        // Send email to referrer
        if (referrer[0].email) {
          await sendEmail(referrer[0].email, 'New Referral Signed Up!', `
            <h2>Great news, ${referrer[0].full_name || 'Investor'}!</h2>
            <p>Someone you referred just signed up for Access Your Place!</p>
            <p>Once they complete their first acquisition, you'll earn a <strong>$300 referral bonus</strong>.</p>
            <p>Keep sharing your referral link to earn more!</p>
          `);
        }
      }
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'claim_reward') {
      const rewards = await db(`referral_rewards?id=eq.${p.reward_id}&select=*`, 'GET');
      const reward = rewards?.[0];
      
      if (!reward) {
        return new Response(JSON.stringify({ success: false, error: 'Reward not found' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      if (reward.status !== 'pending' && reward.reward_type !== 'pending_choice') {
        return new Response(JSON.stringify({ success: false, error: 'Reward already claimed' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const nextFriday = getNextFridayPayout();
      
      if (p.reward_type === 'credit') {
        await db('investor_credits', 'POST', {
          investor_id: p.investor_id,
          amount: reward.amount,
          used_amount: 0,
          source: 'referral',
          reason: 'Referral reward',
          status: 'active',
          applicable_to: ['acquisition_fee', 'service_fee']
        });
        
        await fetch(`${url}/rest/v1/referral_rewards?id=eq.${p.reward_id}`, {
          method: 'PATCH',
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'applied', reward_type: 'credit', claimed_at: new Date().toISOString() })
        });

        // Create payout record for tracking
        await db('referral_payouts', 'POST', {
          referrer_id: p.investor_id,
          reward_id: p.reward_id,
          amount: reward.amount,
          payout_method: 'yp_credit',
          status: 'paid',
          paid_at: new Date().toISOString()
        });

        // Send confirmation email
        const inv = await db(`investors?id=eq.${p.investor_id}&select=email,full_name`, 'GET');
        if (inv?.[0]?.email) {
          await sendEmail(inv[0].email, 'Referral Credit Applied!', `
            <h2>Your $300 Credit Has Been Applied!</h2>
            <p>Hi ${inv[0].full_name || 'Investor'},</p>
            <p>Your referral reward of <strong>$300</strong> has been added to your account as YP Credit.</p>
            <p>You can use this credit towards your next acquisition or service fees.</p>
          `);
        }
      } else if (p.reward_type === 'cash') {
        // Get payout preferences
        const inv = await db(`investors?id=eq.${p.investor_id}&select=payout_method,payout_details,email,full_name`, 'GET');
        const payoutMethod = p.payout_method || inv?.[0]?.payout_method || 'zelle';
        const payoutDetails = p.payout_details || inv?.[0]?.payout_details || {};
        
        await fetch(`${url}/rest/v1/referral_rewards?id=eq.${p.reward_id}`, {
          method: 'PATCH',
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'processing', reward_type: 'cash', claimed_at: new Date().toISOString() })
        });

        // Create payout record scheduled for next Friday
        await db('referral_payouts', 'POST', {
          referrer_id: p.investor_id,
          reward_id: p.reward_id,
          amount: reward.amount,
          payout_method: payoutMethod,
          payout_details: payoutDetails,
          status: 'scheduled',
          scheduled_for: nextFriday.toISOString().split('T')[0]
        });

        // Send confirmation email
        if (inv?.[0]?.email) {
          await sendEmail(inv[0].email, 'Referral Payout Scheduled!', `
            <h2>Your Cash Payout is Scheduled!</h2>
            <p>Hi ${inv[0].full_name || 'Investor'},</p>
            <p>Your referral reward of <strong>$300</strong> has been scheduled for payout.</p>
            <p><strong>Payout Method:</strong> ${payoutMethod.charAt(0).toUpperCase() + payoutMethod.slice(1).replace('_', ' ')}</p>
            <p><strong>Scheduled Date:</strong> ${nextFriday.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</p>
            <p>Payouts are processed every Friday after 12 PM EST.</p>
          `);
        }
      }
      
      return new Response(JSON.stringify({ success: true, next_payout_date: getNextFridayPayout().toISOString() }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_leaderboard') {
      // Get top referrers
      const referrals = await db('investor_referrals?status=eq.rewarded&select=referrer_id', 'GET');
      const counts: Record<string, number> = {};
      (referrals || []).forEach((r: any) => {
        counts[r.referrer_id] = (counts[r.referrer_id] || 0) + 1;
      });
      
      const topIds = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([id]) => id);
      if (topIds.length === 0) {
        return new Response(JSON.stringify({ leaderboard: [] }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }
      
      const investors = await db(`investors?id=in.(${topIds.join(',')})&select=id,full_name`, 'GET');
      const investorMap: Record<string, string> = {};
      (investors || []).forEach((i: any) => { investorMap[i.id] = i.full_name; });
      
      const leaderboard = topIds.map((id, idx) => ({
        rank: idx + 1,
        investor_id: id,
        name: investorMap[id] || 'Anonymous',
        referral_count: counts[id],
        total_earned: counts[id] * 300
      }));
      
      return new Response(JSON.stringify({ leaderboard }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'get_analytics') {
      const referrals = await db('investor_referrals?order=created_at.desc&select=*,referrer:referrer_id(full_name,email),referred:referred_id(full_name,email)', 'GET');
      const rewards = await db('referral_rewards?order=created_at.desc&select=*', 'GET');
      const payouts = await db('referral_payouts?order=created_at.desc&select=*,referrer:referrer_id(full_name,email)', 'GET');
      
      const stats = {
        total_referrals: (referrals || []).length,
        signed_up: (referrals || []).filter((r: any) => r.status === 'signed_up').length,
        qualified: (referrals || []).filter((r: any) => r.status === 'qualified').length,
        rewarded: (referrals || []).filter((r: any) => r.status === 'rewarded').length,
        pending_payouts: (payouts || []).filter((p: any) => p.status === 'scheduled' || p.status === 'pending').length,
        total_paid: (payouts || []).filter((p: any) => p.status === 'paid').reduce((s: number, p: any) => s + parseFloat(p.amount || 0), 0),
        next_payout_date: getNextFridayPayout().toISOString()
      };
      
      return new Response(JSON.stringify({ referrals: referrals || [], rewards: rewards || [], payouts: payouts || [], stats }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'process_payout') {
      // Admin: Mark a payout as paid
      await fetch(`${url}/rest/v1/referral_payouts?id=eq.${p.payout_id}`, {
        method: 'PATCH',
        headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() })
      });
      
      // Update the reward status
      const payout = await db(`referral_payouts?id=eq.${p.payout_id}&select=reward_id,referrer_id,amount`, 'GET');
      if (payout?.[0]?.reward_id) {
        await fetch(`${url}/rest/v1/referral_rewards?id=eq.${payout[0].reward_id}`, {
          method: 'PATCH',
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'paid', paid_at: new Date().toISOString() })
        });
      }

      // Send confirmation email
      const inv = await db(`investors?id=eq.${payout[0].referrer_id}&select=email,full_name`, 'GET');
      if (inv?.[0]?.email) {
        await sendEmail(inv[0].email, 'Referral Payout Sent!', `
          <h2>Your Referral Payout Has Been Sent!</h2>
          <p>Hi ${inv[0].full_name || 'Investor'},</p>
          <p>Your referral reward of <strong>$${payout[0].amount}</strong> has been sent!</p>
          <p>Thank you for being part of the Access Your Place community.</p>
        `);
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'process_scheduled_payouts') {
      // Process all scheduled payouts for today (run on Fridays after 12 PM EST)
      const today = new Date().toISOString().split('T')[0];
      const scheduled = await db(`referral_payouts?status=eq.scheduled&scheduled_for=lte.${today}&select=*`, 'GET');
      
      let processed = 0;
      for (const payout of (scheduled || [])) {
        await fetch(`${url}/rest/v1/referral_payouts?id=eq.${payout.id}`, {
          method: 'PATCH',
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'processing' })
        });
        processed++;
      }
      
      return new Response(JSON.stringify({ success: true, processed }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'qualify_referral') {
      const referrals = await db(`investor_referrals?referred_id=eq.${p.referred_id}&select=*`, 'GET');
      const referral = referrals?.[0];
      
      if (referral && referral.status === 'signed_up') {
        await fetch(`${url}/rest/v1/investor_referrals?id=eq.${referral.id}`, {
          method: 'PATCH',
          headers: { 'apikey': key, 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'qualified', qualified_at: new Date().toISOString() })
        });
        
        await db('referral_rewards', 'POST', {
          referrer_id: referral.referrer_id,
          referral_id: referral.id,
          amount: 300,
          status: 'pending',
          reward_type: 'pending_choice'
        });

        // Send email to referrer
        const referrer = await db(`investors?id=eq.${referral.referrer_id}&select=email,full_name`, 'GET');
        const referred = await db(`investors?id=eq.${p.referred_id}&select=full_name`, 'GET');
        if (referrer?.[0]?.email) {
          await sendEmail(referrer[0].email, 'Congratulations! You Earned a $300 Referral Bonus!', `
            <h2>You Earned $300!</h2>
            <p>Hi ${referrer[0].full_name || 'Investor'},</p>
            <p>${referred?.[0]?.full_name || 'Your referral'} just completed their first acquisition!</p>
            <p>You've earned a <strong>$300 referral bonus</strong>.</p>
            <p>Log in to your portal to choose how you'd like to receive your reward:</p>
            <ul>
              <li><strong>YP Credit:</strong> Apply $300 towards your next acquisition</li>
              <li><strong>Cash:</strong> Receive $300 via Zelle, Cash App, Venmo, or Apple Pay</li>
            </ul>
            <p>Cash payouts are processed every Friday after 12 PM EST.</p>
          `);
        }
      }
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    if (action === 'invite_referral') {
      // Send invitation email to potential referral
      const inv = await db(`investors?id=eq.${p.investor_id}&select=full_name,referral_code`, 'GET');
      const referralLink = `https://accessyourplace.com/investor/login?ref=${inv?.[0]?.referral_code}`;
      
      await sendEmail(p.email, `${inv?.[0]?.full_name || 'An investor'} invited you to Access Your Place!`, `
        <h2>You've Been Invited!</h2>
        <p>${inv?.[0]?.full_name || 'An investor'} thinks you'd be a great fit for Access Your Place.</p>
        <p>Access Your Place helps investors acquire and manage rental arbitrage properties with ease.</p>
        <p><a href="${referralLink}" style="background: #d4a574; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Create Your Account</a></p>
        <p>When you complete your first acquisition, ${inv?.[0]?.full_name || 'your referrer'} will earn a $300 bonus!</p>
      `);
      
      return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});

