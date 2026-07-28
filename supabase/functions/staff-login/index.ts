import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import * as bcrypt from 'https://deno.land/x/bcrypt@v0.4.1/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

const isBcryptHash = (value: string) => /^\$2[aby]\$/.test(value)
const isSha256Hash = (value: string) => /^[a-f0-9]{64}$/i.test(value)

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function verifyPassword(input: string, stored: string): Promise<boolean> {
  if (isBcryptHash(stored)) return bcrypt.compare(input, stored)
  if (isSha256Hash(stored)) {
    const target = stored.toLowerCase()
    // Unsalted SHA-256, then the legacy salted variant used by the old client.
    if ((await sha256(input)).toLowerCase() === target) return true
    if ((await sha256(input + 'ayp_staff_salt_2024')).toLowerCase() === target) return true
    return false
  }
  return input === stored
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ success: false, error: 'Method not allowed' }, 405)

  try {
    const body = await req.json().catch(() => ({}))
    const { action, email, password, staff_id, current_password, new_password, investor_email } = body
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceKey) return json({ success: false, error: 'Server configuration error' }, 500)

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
    }

    const read = async (path: string) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, { headers })
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error(data?.message || data?.error || `Database read failed (${response.status})`)
      return Array.isArray(data) ? data : []
    }

    const patch = async (path: string, payload: Record<string, unknown>) => {
      const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
        method: 'PATCH',
        headers: { ...headers, Prefer: 'return=representation' },
        body: JSON.stringify(payload),
      })
      const data = await response.json().catch(() => [])
      if (!response.ok) throw new Error(data?.message || data?.error || `Database update failed (${response.status})`)
      return data
    }

    if (action === 'change_password') {
      if (!staff_id || !current_password || !new_password) return json({ success: false, error: 'Missing password fields' }, 400)
      const users = await read(`staff_users?id=eq.${encodeURIComponent(staff_id)}&select=id,password_hash`)
      if (!users[0]) return json({ success: false, error: 'User not found' }, 404)
      if (!(await verifyPassword(String(current_password), String(users[0].password_hash || '')))) {
        return json({ success: false, error: 'Current password is incorrect' }, 401)
      }
      await patch(`staff_users?id=eq.${encodeURIComponent(staff_id)}`, {
        password_hash: await bcrypt.hash(String(new_password)),
        updated_at: new Date().toISOString(),
      })
      return json({ success: true })
    }

    if (action === 'link_investor_account') {
      if (!staff_id || !investor_email) return json({ success: false, error: 'staff_id and investor_email are required' }, 400)
      const investors = await read(`investors?email=eq.${encodeURIComponent(String(investor_email).toLowerCase())}&select=id,full_name,email,company_name,phone&limit=1`)
      if (!investors[0]) return json({ success: false, error: 'No investor found with that email' }, 404)
      await patch(`staff_users?id=eq.${encodeURIComponent(staff_id)}`, {
        linked_investor_id: investors[0].id,
        updated_at: new Date().toISOString(),
      })
      return json({ success: true, investor_id: investors[0].id, investor: investors[0] })
    }

    if (action === 'unlink_investor_account') {
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400)
      await patch(`staff_users?id=eq.${encodeURIComponent(staff_id)}`, {
        linked_investor_id: null,
        updated_at: new Date().toISOString(),
      })
      return json({ success: true })
    }

    if (action === 'get_linked_investor') {
      if (!staff_id) return json({ success: false, error: 'staff_id is required' }, 400)
      const users = await read(`staff_users?id=eq.${encodeURIComponent(staff_id)}&select=linked_investor_id&limit=1`)
      const investorId = users[0]?.linked_investor_id
      if (!investorId) return json({ success: true, investor: null })
      const investors = await read(`investors?id=eq.${encodeURIComponent(investorId)}&select=*&limit=1`)
      return json({ success: true, investor: investors[0] || null })
    }

    // ── Validate a staff invitation token (server-side; replaces the old
    //    insecure client-side staff_users read in the frontend) ──
    if (action === 'validate_invitation') {
      const token = body.invitation_token
      if (!token) return json({ success: false, valid: false, error: 'Invitation token required' }, 400)
      const rows = await read(`staff_users?invitation_token=eq.${encodeURIComponent(String(token))}&select=id,email,first_name,last_name,department,invitation_expires,account_completed&limit=1`)
      const invite = rows[0]
      if (!invite) return json({ success: true, valid: false, error: 'This invitation link is invalid or has expired.' })
      if (invite.account_completed) return json({ success: true, valid: false, error: 'This account has already been set up. Please log in.' })
      if (invite.invitation_expires && new Date(invite.invitation_expires).getTime() < Date.now()) {
        return json({ success: true, valid: false, error: 'This invitation link has expired. Please contact an administrator.' })
      }
      return json({ success: true, valid: true, email: invite.email, first_name: invite.first_name, last_name: invite.last_name, department: invite.department })
    }

    // ── Complete a staff invitation: bcrypt-hash the new password server-side,
    //    activate the account, and return a session (replaces the old insecure
    //    client-side plaintext password write in the frontend) ──
    if (action === 'complete_invitation') {
      const token = body.invitation_token
      const newPass = body.new_password
      if (!token || !newPass) return json({ success: false, error: 'Invitation token and new password are required' }, 400)
      const rows = await read(`staff_users?invitation_token=eq.${encodeURIComponent(String(token))}&select=*&limit=1`)
      const invite = rows[0]
      if (!invite) return json({ success: false, error: 'This invitation link is invalid or has expired.' }, 404)
      if (invite.account_completed) return json({ success: false, error: 'This account has already been set up. Please log in.' }, 409)
      if (invite.invitation_expires && new Date(invite.invitation_expires).getTime() < Date.now()) {
        return json({ success: false, error: 'This invitation link has expired. Please contact an administrator.' }, 410)
      }

      const sessionToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`
      const sessionExpires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
      await patch(`staff_users?id=eq.${encodeURIComponent(invite.id)}`, {
        password_hash: await bcrypt.hash(String(newPass)),
        phone: body.phone ? String(body.phone) : invite.phone,
        whatsapp_number: body.whatsapp_number ? String(body.whatsapp_number) : invite.whatsapp_number,
        invitation_token: null,
        invitation_expires: null,
        account_completed: true,
        is_active: true,
        session_token: sessionToken,
        session_expires: sessionExpires,
        last_login: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })

      let permissions = Array.isArray(invite.permissions) ? invite.permissions : []
      if (invite.department === 'success_managers' || invite.department === 'leadership' || ['admin', 'super_admin'].includes(String(invite.role || '').toLowerCase())) {
        permissions = Array.from(new Set([...permissions, 'all']))
      }

      let agreement_signed = true
      let agreement_id: string | null = null
      const isAM = invite.department === 'acquisition_managers' || (Array.isArray(invite.roles) ? invite.roles : []).includes('acquisition_managers')
      if (isAM) {
        const agreements = await read(`am_agreements?staff_id=eq.${encodeURIComponent(invite.id)}&select=id,status&order=created_at.desc&limit=1`).catch(() => [])
        if (agreements[0] && agreements[0].status !== 'signed') { agreement_signed = false; agreement_id = agreements[0].id }
      }

      return json({
        success: true,
        id: invite.id,
        email: invite.email,
        name: invite.name || `${invite.first_name || ''} ${invite.last_name || ''}`.trim(),
        first_name: invite.first_name,
        last_name: invite.last_name,
        team: invite.team || invite.department,
        role: invite.role,
        department: invite.department,
        permissions,
        roles: Array.isArray(invite.roles) ? invite.roles : [],
        linked_investor_id: invite.linked_investor_id,
        session_token: sessionToken,
        session_expires: sessionExpires,
        agreement_signed,
        agreement_id,
      })
    }

    if (!email || !password) return json({ success: false, error: 'Email and password required' }, 400)

    const normalizedEmail = String(email).trim().toLowerCase()
    const users = await read(`staff_users?email=eq.${encodeURIComponent(normalizedEmail)}&is_active=eq.true&select=*&limit=1`)
    const user = users[0]
    if (!user || !user.password_hash) return json({ success: false, error: 'Invalid email or password' }, 401)

    if (user.locked_until && new Date(user.locked_until).getTime() > Date.now()) {
      return json({ success: false, error: 'Account temporarily locked. Try again later.' }, 423)
    }

    const valid = await verifyPassword(String(password), String(user.password_hash))
    if (!valid) {
      const attempts = Number(user.failed_login_attempts || 0) + 1
      const updates: Record<string, unknown> = {
        failed_login_attempts: attempts,
        last_failed_login: new Date().toISOString(),
      }
      if (attempts >= 10) updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString()
      await patch(`staff_users?id=eq.${encodeURIComponent(user.id)}`, updates).catch(() => undefined)
      return json({ success: false, error: 'Invalid email or password' }, 401)
    }

    const sessionToken = `${crypto.randomUUID()}-${crypto.randomUUID()}`
    const sessionExpires = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString()
    const updates: Record<string, unknown> = {
      last_login: new Date().toISOString(),
      failed_login_attempts: 0,
      last_failed_login: null,
      locked_until: null,
      session_token: sessionToken,
      session_expires: sessionExpires,
      updated_at: new Date().toISOString(),
    }
    if (!isBcryptHash(String(user.password_hash))) updates.password_hash = await bcrypt.hash(String(password))
    await patch(`staff_users?id=eq.${encodeURIComponent(user.id)}`, updates)

    let permissions = Array.isArray(user.permissions) ? user.permissions : []
    if (user.department === 'success_managers' || user.department === 'leadership' || ['admin', 'super_admin'].includes(String(user.role || '').toLowerCase())) {
      permissions = Array.from(new Set([...permissions, 'all']))
    }

    return json({
      success: true,
      id: user.id,
      email: user.email,
      name: user.name || `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      first_name: user.first_name,
      last_name: user.last_name,
      team: user.team || user.department,
      role: user.role,
      department: user.department,
      permissions,
      roles: Array.isArray(user.roles) ? user.roles : [],
      linked_investor_id: user.linked_investor_id,
      session_token: sessionToken,
      session_expires: sessionExpires,
    })
  } catch (error) {
    console.error('staff-login:', error)
    return json({ success: false, error: error instanceof Error ? error.message : 'Login failed' }, 500)
  }
})
