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
  const day = now.getUTCDay() // 0 Sun .. 6 Sat
  const back = day === 0 ? 6 : day - 1
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - back, 0, 0, 0))
  return monday.toISOString()
}

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

    // ---- auth: caller must be an active staff user ----
    if (!staffId) return json({ success: false, error: 'Staff identity required' }, 401)
    let staff: any[] = []
    try {
      staff = await restGet(
        `staff_users?id=eq.${encodeURIComponent(staffId)}&is_active=eq.true&select=id&limit=1`,
      )
    } catch (_e) {
      // malformed id (e.g. non-uuid) or lookup failure -> deny, never leak internals
      return json({ success: false, error: 'Staff access required' }, 403)
    }
    if (!staff[0]) return json({ success: false, error: 'Staff access required' }, 403)

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
      // week_earnings = approved/paid commissions this week (staff_commissions may be empty -> 0)
      let week_earnings = 0
      try {
        const comm = await restGet(
          `staff_commissions?staff_id=eq.${sid}&created_at=gte.${wk}&select=amount,approved_amount,status`,
        )
        for (const c of comm) {
          const st = String(c.status || '').toLowerCase()
          if (st === 'approved' || st === 'paid') week_earnings += Number(c.amount ?? c.approved_amount ?? 0) || 0
        }
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
      const created = await restInsert('staff_time_entries', {
        id: crypto.randomUUID(),
        staff_id: staffId,
        start_time: now,
      })
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

    // ---- not yet rebuilt: commissions, compliance, payment profiles, weekly reports,
    //      deal records, staff list, executive overview, payouts ----
    return json({ success: false, error: `Action "${action || '(none)'}" is not implemented yet` }, 400)
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'error' }, 500)
  }
})
