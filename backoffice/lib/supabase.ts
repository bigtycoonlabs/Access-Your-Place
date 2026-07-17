// lib/supabase.ts
// Supabase clients for the AYP backoffice.
// Project: accessyourplace | Ref: prjynolwltwsmsamocyt

import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!url || !anon) {
  throw new Error('[supabase] NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set')
}

// Browser client (anon key — RLS enforced)
export const supabase = createClient(url, anon)

// Server client (service role — bypasses RLS, use only in API routes)
export const supabaseAdmin = svc
  ? createClient(url, svc)
  : createClient(url, anon)
