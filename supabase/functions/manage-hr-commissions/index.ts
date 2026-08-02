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
const COMP_COLS = 'id,staff_id,doc_type,title,file_url,file_name,year,uploaded_by,uploaded_by_name,notes,created_at'
// NOTE: staff_weekly_reports.status is GENERATED ALWAYS (reviewed_at IS NOT NULL -> 'reviewed' else 'pending'); never write it.
const WR_COLS = 'id,staff_id,staff_name,week_start,week_end,client_volume,closings,new_inventory,notes,reviewed_by,reviewed_at,admin_feedback,status,created_at,updated_at'

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
async function restDelete(table: string, filter: string): Promise<void> {
  const r = await fetch(`${REST}/${table}?${filter}`, { method: 'DELETE', headers: H })
  if (!r.ok) throw new Error(`DELETE ${table} -> ${r.status} ${await r.text()}`)
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
// 1st of the current year 00:00 UTC
function yearStartISO(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), 0, 1, 0, 0, 0)).toISOString()
}

// Company profit & loss over a set of flattened deal rows, optionally since an ISO timestamp.
// Revenue = acquisition fees + funded payments; net profit = revenue - commissions paid.
// (Tentative definition; sourced from the closings we input into deal records.)
function computePnl(deals: any[], sinceISO: string | null) {
  let acquisition_fees = 0, funded_payments = 0, commissions_paid = 0
  let deal_count = 0, closed_count = 0, pending_count = 0
  for (const d of deals) {
    if (sinceISO && !(String(d.created_at || '') >= sinceISO)) continue
    deal_count++
    acquisition_fees += Number(d.acquisition_fee_total) || 0
    funded_payments += Number(d.funded_payment) || 0
    commissions_paid += Number(d.commission_paid) || 0
    const st = String(d.deal_status || '').toLowerCase()
    if (st === 'closed' || st === 'completed') closed_count++
    if (st.includes('pending') || st.includes('application')) pending_count++
  }
  const r2 = (x: number) => Math.round(x * 100) / 100
  const revenue = r2(acquisition_fees + funded_payments)
  return {
    revenue,
    acquisition_fees: r2(acquisition_fees),
    funded_payments: r2(funded_payments),
    commissions_paid: r2(commissions_paid),
    net_profit: r2(revenue - commissions_paid),
    deal_count, closed_count, pending_count,
  }
}

const money = (n: unknown) => '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const ADMIN_ROLES = ['owner', 'admin', 'administrator', 'administrators', 'super_admin']
function staffIsAdmin(s: any): boolean {
  if (s?.is_admin === true || s?.is_platform_owner === true) return true
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

// staff_deal_records stores each deal as a jsonb blob in deal_data; flatten it back to the
// top-level shape the front-end expects (id + created_at from the row, everything else from deal_data).
const dealFromRow = (r: any) => ({
  id: r.id,
  ...(r.deal_data && typeof r.deal_data === 'object' ? r.deal_data : {}),
  assigned_staff_id: (r.deal_data && r.deal_data.assigned_staff_id) || r.staff_id || null,
  created_at: r.created_at,
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || '')

    // The acting user's id. For document uploads the front-end puts the *target* staff in
    // staff_id and the actual uploader in uploaded_by, so prefer uploaded_by when present.
    const staffId = String(body.uploaded_by || body.staff_id || body.staffId || '')

    // ---- auth: caller must be an active staff user (admin derived server-side) ----
    if (!staffId) return json({ success: false, error: 'Staff identity required' }, 401)
    const staff = await restGet(
      `staff_users?id=eq.${encodeURIComponent(staffId)}&is_active=eq.true&select=id,role,roles,is_platform_owner&limit=1`,
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

    // ========================= COMPLIANCE DOCUMENTS =========================
    if (action === 'get_compliance_docs') {
      const scope = isAdmin ? '' : `&staff_id=eq.${sid}`
      const rows = await restGet(`staff_compliance_docs?select=${COMP_COLS}${scope}&order=created_at.desc&limit=1000`)
      return json({ documents: rows })
    }

    if (action === 'upload_compliance_doc') {
      // caller == uploaded_by (that is what `staffId` resolved to). staff_id in the body is the
      // *target* owner of the document. Uploading for someone else requires admin.
      const targetStaffId = String(body.staff_id || staffId)
      if (targetStaffId !== staffId && !isAdmin) {
        return json({ success: false, error: 'Admin access required to upload documents for another staff member' }, 403)
      }
      const doc_type = String(body.doc_type || 'other')
      const title = String(body.title || body.file_name || 'Document').trim() || 'Document'
      let year: number | null = null
      if (body.year != null && body.year !== '') { const y = Number(body.year); if (Number.isFinite(y)) year = y }
      const created = await restInsert('staff_compliance_docs', {
        id: crypto.randomUUID(),
        staff_id: targetStaffId,
        doc_type,
        title,
        file_url: body.file_url != null ? String(body.file_url) : null,
        file_name: body.file_name != null ? String(body.file_name) : null,
        year,
        uploaded_by: staffId,
        uploaded_by_name: body.uploaded_by_name != null ? String(body.uploaded_by_name) : null,
        notes: body.notes != null ? String(body.notes) : null,
      })
      return json({ success: true, document: created })
    }

    if (action === 'delete_compliance_doc') {
      const docId = String(body.doc_id || '')
      if (!docId) return json({ success: false, error: 'doc_id required' }, 400)
      const docs = await restGet(`staff_compliance_docs?id=eq.${encodeURIComponent(docId)}&select=id,staff_id&limit=1`)
      if (!docs[0]) return json({ success: false, error: 'Document not found' }, 404)
      // owner or admin only
      if (docs[0].staff_id !== staffId && !isAdmin) {
        return json({ success: false, error: 'You can only delete your own documents' }, 403)
      }
      await restDelete('staff_compliance_docs', `id=eq.${encodeURIComponent(docId)}`)
      return json({ success: true })
    }

    // ========================= STAFF ROSTER =========================
    if (action === 'get_staff_list') {
      // roster includes staff emails -> admin only
      if (!isAdmin) return json({ success: false, error: 'Admin access required' }, 403)
      const dept = String(body.department || '').toLowerCase()
      const rows = await restGet(
        `staff_users?is_active=eq.true&select=id,first_name,last_name,name,email,department,role,roles&order=first_name.asc&limit=1000`,
      )
      let list = rows
      if (dept) {
        list = rows.filter((s: any) => {
          if (String(s.department || '').toLowerCase() === dept) return true
          if (String(s.role || '').toLowerCase() === dept) return true
          let arr: any = s.roles
          if (typeof arr === 'string') { try { arr = JSON.parse(arr) } catch { arr = [] } }
          return Array.isArray(arr) && arr.some((r: any) => String(r).toLowerCase() === dept)
        })
      }
      const staffOut = list.map((s: any) => ({
        id: s.id,
        first_name: s.first_name ?? null,
        last_name: s.last_name ?? null,
        name: s.name ?? ([s.first_name, s.last_name].filter(Boolean).join(' ') || null),
        email: s.email ?? null,
        department: s.department ?? null,
        role: s.role ?? null,
      }))
      return json({ staff: staffOut })
    }

    // ========================= PAYMENT PROFILES =========================
    // Self-service payout methods. account_details is a jsonb blob of method-specific
    // fields (routing/account numbers, Zelle/Venmo handles, etc.). Scoped strictly to the
    // caller: a staff member only ever sees or edits their own methods.
    if (action === 'get_payment_profiles') {
      const rows = await restGet(
        `staff_payment_profiles?staff_id=eq.${sid}&select=id,staff_id,method_type,is_primary,account_details,label,created_at&order=is_primary.desc,created_at.desc&limit=100`,
      )
      return json({ profiles: rows })
    }

    if (action === 'save_payment_profile') {
      const method_type = String(body.method_type || '').trim()
      if (!method_type) return json({ success: false, error: 'method_type is required' }, 400)
      const account_details = (body.account_details && typeof body.account_details === 'object' && !Array.isArray(body.account_details))
        ? body.account_details : {}
      const label = body.label != null ? String(body.label) : null
      const is_primary = body.is_primary === true
      const profileId = String(body.profile_id || '')
      let saved: any
      if (profileId) {
        const existing = await restGet(`staff_payment_profiles?id=eq.${encodeURIComponent(profileId)}&select=id,staff_id&limit=1`)
        if (!existing[0]) return json({ success: false, error: 'Payment profile not found' }, 404)
        if (existing[0].staff_id !== staffId && !isAdmin) {
          return json({ success: false, error: 'You can only edit your own payment methods' }, 403)
        }
        saved = await restPatch('staff_payment_profiles', `id=eq.${encodeURIComponent(profileId)}`, {
          method_type, account_details, label, is_primary, updated_at: new Date().toISOString(),
        })
      } else {
        saved = await restInsert('staff_payment_profiles', {
          id: crypto.randomUUID(),
          staff_id: staffId,
          method_type, account_details, label, is_primary,
          created_at: new Date().toISOString(),
        })
      }
      // enforce a single primary per staff (best-effort; never fail a saved profile on dedup)
      if (is_primary && saved?.id) {
        try {
          await restPatch('staff_payment_profiles', `staff_id=eq.${sid}&id=neq.${encodeURIComponent(saved.id)}`, { is_primary: false })
        } catch (_e) { /* dedup is best-effort */ }
      }
      return json({ success: true, profile: saved })
    }

    if (action === 'delete_payment_profile') {
      const profileId = String(body.profile_id || '')
      if (!profileId) return json({ success: false, error: 'profile_id required' }, 400)
      const existing = await restGet(`staff_payment_profiles?id=eq.${encodeURIComponent(profileId)}&select=id,staff_id&limit=1`)
      if (!existing[0]) return json({ success: false, error: 'Payment profile not found' }, 404)
      if (existing[0].staff_id !== staffId && !isAdmin) {
        return json({ success: false, error: 'You can only delete your own payment methods' }, 403)
      }
      await restDelete('staff_payment_profiles', `id=eq.${encodeURIComponent(profileId)}`)
      return json({ success: true })
    }

    // ========================= WEEKLY REPORTS =========================
    // One report per staff per (UTC) week. Staff see their own; admins see everyone.
    // NB: status is a generated column (from reviewed_at) -> never write it.
    if (action === 'get_weekly_reports') {
      const scope = isAdmin ? '' : `&staff_id=eq.${sid}`
      const rows = await restGet(`staff_weekly_reports?select=${WR_COLS}${scope}&order=week_start.desc,created_at.desc&limit=1000`)
      return json({ reports: rows })
    }

    if (action === 'submit_weekly_report') {
      // The front-end sends only the metrics; the server owns the week boundary so every
      // record for a given week keys the same way (upsert on staff_id + week_start).
      const wkStart = new Date(weekStartISO())
      const ws = wkStart.toISOString().split('T')[0]
      const wkEnd = new Date(Date.UTC(wkStart.getUTCFullYear(), wkStart.getUTCMonth(), wkStart.getUTCDate() + 6))
      const we = wkEnd.toISOString().split('T')[0]
      const toInt = (v: unknown) => { const n = parseInt(String(v ?? ''), 10); return Number.isFinite(n) ? n : 0 }
      const client_volume = toInt(body.client_volume)
      const closings = toInt(body.closings)
      const new_inventory = toInt(body.new_inventory)
      const notes = body.notes != null && String(body.notes) !== '' ? String(body.notes) : null
      const staff_name = String(body.staff_name || '').trim() || 'Staff'
      const existing = await restGet(`staff_weekly_reports?staff_id=eq.${sid}&week_start=eq.${ws}&select=id&limit=1`)
      let report: any
      if (existing[0]) {
        report = await restPatch('staff_weekly_reports', `id=eq.${existing[0].id}`, {
          staff_name, client_volume, closings, new_inventory, notes, updated_at: new Date().toISOString(),
        })
      } else {
        report = await restInsert('staff_weekly_reports', {
          id: crypto.randomUUID(),
          staff_id: staffId, staff_name, week_start: ws, week_end: we,
          client_volume, closings, new_inventory, notes,
          created_at: new Date().toISOString(),
        })
      }
      return json({ success: true, report })
    }

    if (action === 'review_weekly_report') {
      // admin-only: attaches feedback + marks a staff member's report reviewed
      if (!isAdmin) return json({ success: false, error: 'Admin access required to review reports' }, 403)
      const reportId = String(body.report_id || '')
      if (!reportId) return json({ success: false, error: 'report_id required' }, 400)
      const report = await restPatch('staff_weekly_reports', `id=eq.${encodeURIComponent(reportId)}`, {
        reviewed_by: body.reviewed_by != null ? String(body.reviewed_by) : null,
        reviewed_at: new Date().toISOString(),
        admin_feedback: body.admin_feedback != null ? String(body.admin_feedback) : null,
        updated_at: new Date().toISOString(),
      })
      if (!report) return json({ success: false, error: 'Report not found' }, 404)
      return json({ success: true, report })
    }

    if (action === 'get_master_weekly_report') {
      // admin-only rollup of the current week across all staff
      if (!isAdmin) return json({ success: false, error: 'Admin access required' }, 403)
      const wkISO = weekStartISO()
      const ws = new Date(wkISO).toISOString().split('T')[0]
      const reports = await restGet(`staff_weekly_reports?week_start=eq.${ws}&select=${WR_COLS}&order=staff_name.asc&limit=1000`)
      let total_clients = 0, total_closings = 0, total_new_inventory = 0
      for (const r of reports) {
        total_clients += Number(r.client_volume) || 0
        total_closings += Number(r.closings) || 0
        total_new_inventory += Number(r.new_inventory) || 0
      }
      let total_commissions_this_week = 0
      try {
        const comm = await restGet(`staff_commissions?status=in.(approved,paid)&select=claimed_amount,approved_amount,amount,status,created_at,reviewed_at,paid_at&limit=5000`)
        for (const c of comm) { const d = commEarnDate(c); if (d && d >= wkISO) total_commissions_this_week += commEarned(c) }
      } catch (_e) { /* commissions rollup is best-effort */ }
      let week_deals: any[] = []
      try {
        const dealRows = await restGet(`staff_deal_records?created_at=gte.${wkISO}&select=id,staff_id,deal_data,created_at&order=created_at.desc&limit=1000`)
        week_deals = dealRows.map(dealFromRow)
      } catch (_e) { /* deals rollup is best-effort */ }
      return json({
        master_report: {
          week_start: ws,
          staff_reports: reports,
          total_clients, total_closings, total_new_inventory,
          total_commissions_this_week,
          week_deals,
          reports_submitted: reports.length,
        },
      })
    }

    // ========================= DEAL RECORDS =========================
    // Admin-entered ledger of completed/pending deals. Each deal's fields live inside the
    // deal_data jsonb blob; reads flatten it, writes pack it.
    if (action === 'submit_deal_record') {
      if (!isAdmin) return json({ success: false, error: 'Admin access required to record deals' }, 403)
      const client_name = String(body.client_name || '').trim()
      if (!client_name) return json({ success: false, error: 'client_name is required' }, 400)
      const toNum = (v: unknown) => { const n = parseFloat(String(v ?? '')); return Number.isFinite(n) ? n : 0 }
      const acquisition_fee_total = toNum(body.acquisition_fee_total)
      const funded_payment = toNum(body.funded_payment)
      const commission_paid = toNum(body.commission_paid)
      const net_after_commission = Math.round((acquisition_fee_total - commission_paid) * 100) / 100
      const assignedId = String(body.assigned_staff_id || '')
      const deal_data = {
        client_name,
        property_address: String(body.property_address || ''),
        deal_status: String(body.deal_status || 'closed'),
        payment_type: String(body.payment_type || 'cash'),
        acquisition_fee_total, funded_payment, commission_paid, net_after_commission,
        assigned_staff_id: assignedId || null,
        assigned_staff_name: String(body.assigned_staff_name || ''),
        staff_role: String(body.staff_role || ''),
        notes: String(body.notes || ''),
        submitted_by: String(body.submitted_by || ''),
      }
      const created = await restInsert('staff_deal_records', {
        id: crypto.randomUUID(),
        staff_id: assignedId || staffId,
        deal_data,
        created_at: new Date().toISOString(),
      })
      return json({ success: true, deal: dealFromRow(created) })
    }

    if (action === 'delete_deal_record') {
      if (!isAdmin) return json({ success: false, error: 'Admin access required to delete deal records' }, 403)
      const dealId = String(body.deal_id || '')
      if (!dealId) return json({ success: false, error: 'deal_id required' }, 400)
      const existing = await restGet(`staff_deal_records?id=eq.${encodeURIComponent(dealId)}&select=id&limit=1`)
      if (!existing[0]) return json({ success: false, error: 'Deal record not found' }, 404)
      await restDelete('staff_deal_records', `id=eq.${encodeURIComponent(dealId)}`)
      return json({ success: true })
    }

    // ========================= EXECUTIVE OVERVIEW =========================
    if (action === 'get_executive_overview') {
      if (!isAdmin) return json({ success: false, error: 'Admin access required' }, 403)
      const rows = await restGet('staff_deal_records?select=id,staff_id,deal_data,created_at&order=created_at.desc&limit=2000')
      const deals = rows.map(dealFromRow)
      let total_acquisition_fees = 0, total_funded_payments = 0, total_commissions_paid = 0
      let closed_deals = 0, completed_deals = 0, credit_deals = 0, cash_deals = 0, pending_application = 0
      const byStaff: Record<string, any> = {}
      for (const d of deals) {
        const fee = Number(d.acquisition_fee_total) || 0
        const funded = Number(d.funded_payment) || 0
        const comm = Number(d.commission_paid) || 0
        total_acquisition_fees += fee
        total_funded_payments += funded
        total_commissions_paid += comm
        const st = String(d.deal_status || '').toLowerCase()
        const pt = String(d.payment_type || '').toLowerCase()
        if (st === 'closed') closed_deals++
        if (st === 'completed') completed_deals++
        if (st.includes('pending') || st.includes('application')) pending_application++
        if (pt === 'credit') credit_deals++
        if (pt === 'cash') cash_deals++
        const key = String(d.assigned_staff_name || d.assigned_staff_id || 'Unassigned')
        if (!byStaff[key]) byStaff[key] = { name: key, deals: [], totalFees: 0, totalCommissions: 0 }
        byStaff[key].deals.push(d)
        byStaff[key].totalFees += fee
        byStaff[key].totalCommissions += comm
      }
      const net_earnings = Math.round((total_acquisition_fees + total_funded_payments - total_commissions_paid) * 100) / 100
      const overview = {
        total_deals: deals.length,
        closed_deals, completed_deals, credit_deals, cash_deals, pending_application,
        total_acquisition_fees, total_funded_payments, total_commissions_paid,
        net_earnings,
        by_staff: Object.values(byStaff),
      }
      return json({ overview, deals })
    }

    // ========================= PROFIT & LOSS =========================
    // Company P&L sourced from the deal-records ledger (the closings we input). Auto-updates as
    // deals are added. Returns week / month / year / all-time together, or one via `period`.
    if (action === 'get_profit_statement') {
      if (!isAdmin) return json({ success: false, error: 'Admin access required' }, 403)
      const rows = await restGet('staff_deal_records?select=id,staff_id,deal_data,created_at&limit=5000')
      const deals = rows.map(dealFromRow)
      const wk = weekStartISO(), mo = monthStartISO(), yr = yearStartISO()
      const period = String(body.period || '').toLowerCase()
      const bounds: Record<string, string | null> = { week: wk, month: mo, year: yr, all: null, all_time: null }
      if (period && period in bounds) {
        return json({ statement: { period, period_start: bounds[period], ...computePnl(deals, bounds[period]) } })
      }
      return json({
        statements: {
          week: { period: 'week', period_start: wk, ...computePnl(deals, wk) },
          month: { period: 'month', period_start: mo, ...computePnl(deals, mo) },
          year: { period: 'year', period_start: yr, ...computePnl(deals, yr) },
          all_time: { period: 'all_time', period_start: null, ...computePnl(deals, null) },
        },
      })
    }

    // ========================= FRIDAY PAYOUT SUMMARY =========================
    // Each active staff member gets their OWN commission brief; the platform owner gets the full
    // company overview. All mail is sent as Penny. Pass preview:true to compose without sending.
    if (action === 'send_friday_payout_summary') {
      if (!isAdmin) return json({ success: false, error: 'Admin access required' }, 403)
      const preview = body.preview === true

      const staffRows = await restGet('staff_users?is_active=eq.true&select=id,first_name,last_name,name,email,is_platform_owner&limit=1000')
      const comms = await restGet('staff_commissions?select=staff_id,claimed_amount,approved_amount,amount,status,created_at,reviewed_at,paid_at&limit=10000')
      const wk = weekStartISO(), mo = monthStartISO(), yr = yearStartISO()

      const byStaff: Record<string, any> = {}
      for (const c of comms) {
        const k = String(c.staff_id || '')
        if (!byStaff[k]) byStaff[k] = { pending: 0, approved: 0, paid: 0, this_week: 0, this_month: 0, pending_count: 0, approved_count: 0, paid_count: 0 }
        const st = String(c.status || '').toLowerCase()
        const claimed = Number(c.claimed_amount || 0) || 0
        if (st === 'pending') { byStaff[k].pending += claimed; byStaff[k].pending_count++ }
        else if (st === 'approved') { byStaff[k].approved += commEarned(c); byStaff[k].approved_count++ }
        else if (st === 'paid') { byStaff[k].paid += commEarned(c); byStaff[k].paid_count++ }
        if (st === 'approved' || st === 'paid') {
          const d = commEarnDate(c)
          if (d && d >= wk) byStaff[k].this_week += commEarned(c)
          if (d && d >= mo) byStaff[k].this_month += commEarned(c)
        }
      }

      const dealRows = await restGet('staff_deal_records?select=id,staff_id,deal_data,created_at&limit=5000')
      const deals = dealRows.map(dealFromRow)

      const shell = (title: string, inner: string) =>
        `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;color:#1a365d">` +
        `<h2 style="color:#1a365d">${title}</h2>${inner}` +
        `<p style="color:#64748b;font-size:12px;margin-top:24px">Sent by Penny at Access Your Place. This is an automated summary.</p></div>`

      const staffHtml = (name: string, b: any) => shell(
        'Your Commission Brief',
        `<p>Hi ${name}, here is your commission brief for the week.</p>` +
        `<ul style="line-height:1.8">` +
        `<li>Earned this week: <strong>${money(b.this_week)}</strong></li>` +
        `<li>Earned this month: <strong>${money(b.this_month)}</strong></li>` +
        `<li>Paid to date: <strong>${money(b.paid)}</strong> (${b.paid_count})</li>` +
        `<li>Approved, awaiting payout: <strong>${money(b.approved)}</strong> (${b.approved_count})</li>` +
        `<li>Pending review: <strong>${money(b.pending)}</strong> (${b.pending_count})</li>` +
        `</ul>`,
      )

      const pnlRow = (label: string, p: any) =>
        `<tr><td style="padding:6px 12px">${label}</td>` +
        `<td style="padding:6px 12px;text-align:right">${money(p.revenue)}</td>` +
        `<td style="padding:6px 12px;text-align:right">${money(p.commissions_paid)}</td>` +
        `<td style="padding:6px 12px;text-align:right"><strong>${money(p.net_profit)}</strong></td>` +
        `<td style="padding:6px 12px;text-align:right">${p.deal_count}</td></tr>`

      const ownerHtml = (name: string) => shell(
        'Company Overview',
        `<p>Hi ${name}, here is the company overview.</p>` +
        `<table style="border-collapse:collapse;width:100%;font-size:14px">` +
        `<thead><tr style="border-bottom:1px solid #cbd5e1">` +
        `<th style="text-align:left;padding:6px 12px">Period</th>` +
        `<th style="text-align:right;padding:6px 12px">Revenue</th>` +
        `<th style="text-align:right;padding:6px 12px">Commissions</th>` +
        `<th style="text-align:right;padding:6px 12px">Net profit</th>` +
        `<th style="text-align:right;padding:6px 12px">Deals</th></tr></thead><tbody>` +
        pnlRow('This week', computePnl(deals, wk)) +
        pnlRow('This month', computePnl(deals, mo)) +
        pnlRow('This year', computePnl(deals, yr)) +
        pnlRow('All time', computePnl(deals, null)) +
        `</tbody></table>`,
      )

      const recipients: any[] = []
      for (const st of staffRows) {
        if (!st.email) continue
        const name = st.name || [st.first_name, st.last_name].filter(Boolean).join(' ') || 'there'
        if (st.is_platform_owner) {
          recipients.push({ to: st.email, name, kind: 'owner', subject: 'Company Overview - Access Your Place', html: ownerHtml(name) })
        } else {
          const b = byStaff[st.id] || { pending: 0, approved: 0, paid: 0, this_week: 0, this_month: 0, pending_count: 0, approved_count: 0, paid_count: 0 }
          recipients.push({ to: st.email, name, kind: 'staff', subject: 'Your Commission Brief - Access Your Place', html: staffHtml(name, b) })
        }
      }

      if (preview) {
        return json({
          sent: false, preview: true, count: recipients.length,
          recipients: recipients.map((r) => ({ to: r.to, name: r.name, kind: r.kind, subject: r.subject, html_length: r.html.length })),
        })
      }

      const resendKey = Deno.env.get('RESEND_API_KEY')
      if (!resendKey) return json({ success: false, error: 'Email is not configured' }, 500)
      const sent_to: string[] = []
      const failures: any[] = []
      for (const r of recipients) {
        try {
          const er = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resendKey}` },
            body: JSON.stringify({ from: 'Penny <penny@accessyourplace.com>', to: [r.to], subject: r.subject, html: r.html }),
          })
          if (er.ok) sent_to.push(r.to)
          else failures.push({ to: r.to, error: (await er.text()).slice(0, 200) })
        } catch (e) { failures.push({ to: r.to, error: String(e).slice(0, 200) }) }
      }
      return json({ sent: true, sent_to, failures, count: sent_to.length })
    }

    return json({ success: false, error: `Action "${action || '(none)'}" is not implemented yet` }, 400)
  } catch (error) {
    return json({ success: false, error: error instanceof Error ? error.message : 'error' }, 500)
  }
})
