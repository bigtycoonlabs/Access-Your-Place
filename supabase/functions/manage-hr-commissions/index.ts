import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const REST = `${SUPABASE_URL}/rest/v1`
const H: Record<string, string> = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
}
const ENTRY_COLS = 'id,staff_id,start_time,end_time,duration_minutes,notes'
const COMM_COLS = 'id,staff_id,staff_name,client_name,property_address,deal_type,claimed_amount,approved_amount,status,payout_date,notes,admin_comment,reviewed_by,reviewed_at,paid_at,created_at'

async function restGet(path: string): Promise<any[]> {
  const r = await fetch(`${REST}/${path}`, { headers: H })
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status} ${await r.text()}`)
  return await r.json()
}
async function restInsert(table: string, row: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${REST}/${table}`, {
    method: 'POST',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(row),
  })
  if (!r.ok) throw new Error(`INSERT ${table} -> ${r.status} ${await r.text()}`)
  const rows = await r.json()
  return Array.isArray(rows) ? rows[0] : rows
}
async function restPatch(table: string, filter: string, patch: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${REST}/${table}?${filter}`, {
    method: 'PATCH',
    headers: { ...H, Prefer: 'return=representation' },
    body: JSON.stringify(patch),
  })
  if (!r.ok) throw new Error(`PATCH ${table} -> ${r.status} ${await r.text()}`)
  const rows = await r.json()
  return Array.isArray(rows) ? rows[0] : rows
}

// Monday 00:00 UTC of the current week
function weekStartISO(): string {
  const now = new Date()
  const back = now.getUTCDay() === 0 ? 6 : now.getUTCDay() - 1
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, 0, 0, 0)).toISOString()
}
// 1st of the current month 00:00 UTC
function monthStartISO(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0)).toISOString()
}

const ADMIN_ROLES = ['owner', 'admin', 'administrator', 'administrators', 'super_admin']
function staffIsAdmin(s: any): boolean {
  if (s?.is_admin === true) return true
  if (ADMIN_ROLES.includes(String(s?.role || '').toLowerCase())) return true
  let arr: any = s?.roles
  if (typeof arr === 'string') { try { arr = JSON.parse(arr) } catch { arr = [] } }
  if (Array.isArray(arr)) return arr.some((r: any) => ADMIN_ROLES.includes(String(r).toLowerCase()))
  return false
}

// Shared earnings definition (kept consistent between timer week_earnings and commission stats):
// a commission "earns" its approved_amount (fallback amount, then claimed_amount) once approved/paid.
const commEarned = (c: any) => Number(c.approved_amount ?? c.amount ?? c.claimed_amount ?? 0) || 0
const commEarnDate = (c: any) => c.paid_at || c.reviewed_at || c.created_at

const asEntry = (e: any) => ({
  id: e.id,
  staff_id: e.staff_id,
  start_time: e.start_time,
  end_time: e.end_time ?? null,
  duration_minutes: e.duration_minutes ?? null,
  notes: e.notes ?? null,
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')
    const staffId = String(body.staff_id || body.staffId || '')

    // ---- auth: caller must be an active staff user (admin derived server-side) ----
    if (!staffId) return json({ success: false, error: 'Staff identity required' }, 401)
    const staff = await restGet(
      `staff_users?id=eq.${encodeURIComponent(staffId)}&is_active=eq.true&select=id,role,roles&limit=1`,
    )
    if (!staff[0]) return json({ success: false, error: 'Staff access required' }, 403)
    const isAdmin = staffIsAdmin(staff[0])

    const sid = encodeURIComponent(staffId)

    // ========================= TIME TRACKER =========================
    if (action === 'get_active_timer') {
      const rows = await restGet(
        `staff_time_entries?staff_id=eq.${sid}&end_time=is.null&order=start_time.desc&limit=1&select=${ENTRY_COLS}`,
      )
      return json({ entry: rows[0] ? asEntry(rows[0]) : null })
    }

    if (action === 'get_time_entries') {
      const rows = await restGet(
        `staff_time_entries?staff_id=eq.${sid}&order=start_time.desc&limit=50&select=${ENTRY_COLS}`,
      )
      return json({ entries: rows.map(asEntry) })
    }

    if (action === 'get_time_stats') {
      const wk = weekStartISO()
      const rows = await restGet(
        `staff_time_entries?staff_id=eq.${sid}&start_time=gte.${wk}&select=duration_minutes,end_time`,
      )
      let total_minutes = 0
      for (const r of rows) total_minutes += Number(r.duration_minutes) || 0
      const session_count = rows.length
      let week_earnings = 0
      try {
        const comm = await restGet(
          `staff_commissions?staff_id=eq.${sid}&status=in.(approved,paid)&select=claimed_amount,approved_amount,amount,status,created_at,reviewed_at,paid_at&limit=2000`,
        )
        for (const c of comm) { const d = commEarnDate(c); if (d && d >= wk) week_earnings += commEarned(c) }
      } catch (_e) { /* earnings are best-effort; time stats stand alone */ }
      const total_hours = Math.round((total_minutes / 60) * 10) / 10
      const effective_hourly_rate = total_hours > 0 ? Math.round((week_earnings / total_hours) * 100) / 100 : 0
      return json({ stats: { total_minutes, total_hours, week_earnings, effective_hourly_rate, session_count } })
    }

    if (action === 'start_timer') {
      const existing = await restGet(
        `staff_time_entries?staff_id=eq.${sid}&end_time=is.null&order=start_time.desc&limit=1&select=${ENTRY_COLS}`,
      )
      if (existing[0]) return json({ entry: asEntry(existing[0]) }) // already running; idempotent
      const now = new Date().toISOString()
      const created = await restInsert('staff_time_entries', { id: crypto.randomUUID(), staff_id: staffId, start_time: now })
      return json({ entry: asEntry(created) })
    }

    if (action === 'stop_timer') {
      const active = await restGet(
        `staff_time_entries?staff_id=eq.${sid}&end_time=is.null&order=start_time.desc&limit=1&select=${ENTRY_COLS}`,
      )
      if (!active[0]) return json({ success: false, error: 'No active timer to stop' }, 400)
      const a = active[0]
      const now = new Date()
      const duration = Math.max(0, Math.round((now.getTime() - new Date(a.start_time).getTime()) / 60000))
      const updated = await restPatch('staff_time_entries', `id=eq.${a.id}`, {
        end_time: now.toISOString(),
        duration_minutes: duration,
        notes: body.notes != null ? String(body.notes) : null,
      })
      return json({ entry: asEntry(updated) })
    }

    // ========================= COMMISSIONS =========================
    if (action === 'get_commissions') {
      const scope = isAdmin ? '' : `&staff_id=eq.${sid}`
      const st = String(body.status || '').toLowerCase()
      const stFilter = st && st !== 'all' ? `&status=eq.${encodeURIComponent(st)}` : ''
      const rows = await restGet(`staff_commissions?select=${COMM_COLS}${scope}${stFilter}&order=created_at.desc&limit=500`)
      return json({ commissions: rows })
    }

    if (action === 'get_commission_stats') {
      const scope = isAdmin ? '' : `&staff_id=eq.${sid}`
      const rows = await restGet(
        `staff_commissions?select=claimed_amount,approved_amount,amount,status,created_at,reviewed_at,paid_at${scope}&limit=5000`,
      )
      const wk = weekStartISO(), mo = monthStartISO()
      let total_pending = 0, total_approved = 0, total_paid = 0, total_disputed = 0
      let pending_count = 0, approved_count = 0, paid_count = 0
      let this_week_earned = 0, this_month_earned = 0
      for (const c of rows) {
        const stt = String(c.status || '').toLowerCase()
        const claimed = Number(c.claimed_amount ?? 0) || 0
        if (stt === 'pending') { total_pending += claimed; pending_count++ }
        else if (stt === 'approved') { total_approved += commEarned(c); approved_count++ }
        else if (stt === 'paid') { total_paid += commEarned(c); paid_count++ }
        else if (stt === 'disputed') { total_disputed += claimed }
        if (stt === 'approved' || stt === 'paid') {
          const d = commEarnDate(c)
          if (d && d >= wk) this_week_earned += commEarned(c)
          if (d && d >= mo) this_month_earned += commEarned(c)
        }
      }
      return json({ stats: { total_pending, total_approved, total_paid, total_disputed, this_week_earned, this_month_earned, pending_count, approved_count, paid_count } })
    }

    if (action === 'submit_commission') {
      const client_name = String(body.client_name || '').trim()
      const property_address = String(body.property_address || '').trim()
      const claimed = Number(body.claimed_amount)
      if (!client_name || !property_address || !Number.isFinite(claimed) || claimed <= 0) {
        return json({ success: false, error: 'client_name, property_address and a positive claimed_amount are required' }, 400)
      }
      const created = await restInsert('staff_commissions', {
        id: crypto.randomUUID(),
        staff_id: staffId,
        staff_name: String(body.staff_name || '').trim() || 'Staff',
        client_name,
        property_address,
        deal_type: String(body.deal_type || 'finder'),
        claimed_amount: claimed,
        status: 'pending',
        notes: body.notes != null ? String(body.notes) : null,
      })
      return json({ success: true, commission: created })
    }

    if (action === 'update_commission_status') {
      // money/status mutation -> admins only, verified server-side (never trust client is_admin)
      if (!isAdmin) return json({ success: false, error: 'Admin access required to review commissions' }, 403)
      const commissionId = String(body.commission_id || '')
      const newStatus = String(body.status || '').toLowerCase()
      const allowed = ['pending', 'approved', 'paid', 'disputed', 'rejected']
      if (!commissionId) return json({ success: false, error: 'commission_id required' }, 400)
      if (!allowed.includes(newStatus)) return json({ success: false, error: `status must be one of: ${allowed.join(', ')}` }, 400)
      const patch: Record<string, unknown> = {
        status: newStatus,
        reviewed_by: body.reviewed_by != null ? String(body.reviewed_by) : null,
        reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      if (body.admin_comment != null) patch.admin_comment = String(body.admin_comment)
      if (body.approved_amount != null && body.approved_amount !== '') {
        const amt = Number(body.approved_amount)
        if (Number.isFinite(amt)) { patch.approved_amount = amt }
      }
      if (newStatus === 'paid') patch.paid_at = new Date().toISOString()
      const updated = await restPatch('staff_commissions', `id=eq.${encodeURIComponent(commissionId)}`, patch)
      return json({ success: true, commission: updated })
    }

    // ---- not yet rebuilt: compliance, payment profiles, weekly reports,
    //      deal records, staff list, executive overview, payouts ----
    return json({ success: false, error: `Action "${action || '(none)'}" is not implemented yet` }, 400)
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'error' }, 500)
  }
})
