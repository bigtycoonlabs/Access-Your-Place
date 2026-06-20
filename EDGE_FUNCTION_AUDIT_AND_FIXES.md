# Edge Function Audit & Direct REST API Migration Guide

## Date: April 10, 2026
## Issue: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` fails to send auth headers

---

## Root Cause

The Supabase JS client library (v2.39.3+) running inside Deno edge functions intermittently fails to attach the `Authorization: Bearer <service_role_key>` header to PostgREST requests. This causes the database to reject queries with:

```
"Authorization token is required"
```

**The fix**: Replace `createClient()` with direct `fetch()` calls to the PostgREST REST API, explicitly setting `apikey` and `Authorization` headers.

---

## Audit Results

### ✅ FIXED (Direct REST API)

| Function | Version | Fixed Date | Notes |
|----------|---------|------------|-------|
| `get-leads` | v2.0 | Apr 9, 2026 | Returns `{ success: true, leads: [] }` |
| `manage-landlord-portal` | v5.0 | Apr 9, 2026 | All 20+ action handlers migrated |
| `cleanup-error-logs` | v1.0 | Apr 9, 2026 | Built with direct REST from start |
| `check-error-thresholds` | v1.0 | Apr 9, 2026 | Built with direct REST from start |

### 🔴 VULNERABLE (Still using createClient)

| Function | Priority | Impact | Tables Accessed |
|----------|----------|--------|-----------------|
| `manage-staff` | CRITICAL | Staff management broken, AM assignments fail | `staff`, `am_assignment_requests` |
| `investor-auth-v2` | CRITICAL | Investor portal completely broken | `investors`, `portfolio_properties`, `investor_credits` |
| `staff-login` | CRITICAL | Staff cannot log in | `staff` |
| `investor-login` | CRITICAL | Investors cannot log in | `investors` |
| `manage-investor-admin` | HIGH | Unassigned investor count wrong, admin actions fail | `investors`, `staff` |
| `manage-acquisitions` | HIGH | Acquisition workflow broken | `acquisitions`, `acquisition_notes` |
| `manage-deal-marketplace` | HIGH | Marketplace listings/verification broken | `marketplace_listings`, `marketplace_offers` |
| `manage-support-requests` | MEDIUM | Support tickets inaccessible | `support_requests` |
| `ai-investor-chat` | MEDIUM | Penny AI can't access DB for context | `investors`, `properties`, `portfolio_properties` |
| `get-deal-analytics` | MEDIUM | Analytics dashboard shows fallback data | `deal_inquiries`, `properties`, `investors` |
| `send-investor-invitation` | MEDIUM | Invitations and AM agreements fail | `investor_invitations`, `am_agreements` |

### ⚠️ UNKNOWN (Need testing)

| Function | Notes |
|----------|-------|
| `investor-session` | Session validation - may use different auth pattern |
| `investor-register` | Registration flow |
| `process-property-photos` | Photo processing |
| `sync-static-articles` | Article sync |
| `update-property` | Property updates |
| `add-property` | Property creation |
| `get-properties` | Property listing |

---

## Migration Pattern

### Before (Vulnerable)
```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

// This FAILS intermittently:
const { data, error } = await supabase
  .from('staff')
  .select('*')
  .eq('active', true);
```

### After (Fixed)
```typescript
// No imports needed - uses native fetch()

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Direct REST API helper
async function db(table: string, options: {
  method?: string;
  filters?: string;
  body?: any;
  select?: string;
  single?: boolean;
  headers?: Record<string, string>;
} = {}) {
  const { 
    method = 'GET', 
    filters = '', 
    body, 
    select = '*',
    single = false,
    headers: extraHeaders = {}
  } = options;
  
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}${filters}`;
  
  const headers: Record<string, string> = {
    'apikey': SERVICE_KEY,
    'Authorization': `Bearer ${SERVICE_KEY}`,
    'Content-Type': 'application/json',
    ...extraHeaders,
  };
  
  if (method === 'POST') headers['Prefer'] = 'return=representation';
  if (method === 'PATCH') headers['Prefer'] = 'return=representation';
  if (method === 'DELETE') headers['Prefer'] = 'return=minimal';
  if (single) headers['Accept'] = 'application/vnd.pgrst.object+json';
  
  const res = await fetch(url, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`DB ${method} ${table} failed (${res.status}): ${errText}`);
  }
  
  if (method === 'DELETE') return null;
  if (res.status === 204) return null;
  
  return res.json();
}

// Usage examples:

// SELECT * FROM staff WHERE active = true
const staff = await db('staff', { filters: '&active=eq.true' });

// SELECT id, name FROM staff WHERE department = 'success_managers' LIMIT 10
const managers = await db('staff', { 
  select: 'id,name',
  filters: '&department=eq.success_managers&limit=10' 
});

// INSERT INTO staff (name, email) VALUES (...)
const newStaff = await db('staff', { 
  method: 'POST', 
  body: { name: 'John', email: 'john@example.com' } 
});

// UPDATE staff SET active = false WHERE id = 'xxx'
await db('staff', { 
  method: 'PATCH', 
  filters: '&id=eq.xxx',
  body: { active: false } 
});

// DELETE FROM staff WHERE id = 'xxx'
await db('staff', { 
  method: 'DELETE', 
  filters: '&id=eq.xxx' 
});

// Single row (returns object, not array)
const singleStaff = await db('staff', { 
  filters: '&id=eq.xxx',
  single: true 
});
```

---

## Priority Migration Order

1. **`staff-login`** — Staff can't log in without this
2. **`investor-login`** — Investors can't log in without this  
3. **`investor-auth-v2`** — Core investor portal functionality
4. **`manage-staff`** — Staff management and AM assignments
5. **`manage-investor-admin`** — Admin investor management
6. **`manage-acquisitions`** — Acquisition workflow
7. **`manage-deal-marketplace`** — Marketplace operations
8. **`manage-support-requests`** — Support tickets
9. **`ai-investor-chat`** — Penny AI database access
10. **`get-deal-analytics`** — Analytics dashboard
11. **`send-investor-invitation`** — Invitations and agreements

---

## Testing Verification

After migrating each function:

1. Go to Staff Dashboard → Analytics tab
2. Expand the "Edge Function Health & Audit" widget
3. Click "Live Tests" tab
4. Run the test for the migrated function
5. Verify:
   - Status shows ✅ PASS (green checkmark)
   - Response time is < 3000ms
   - Expected fields are present in the response
   - No "Authorization token is required" errors

### Quick Test Commands (Browser Console)

```javascript
// Test get-leads
const { data } = await window.supabase.functions.invoke('get-leads');
console.log('get-leads:', data);

// Test manage-landlord-portal
const { data: apps } = await window.supabase.functions.invoke('manage-landlord-portal', {
  body: { action: 'get_applications' }
});
console.log('applications:', apps);

// Test manage-staff
const { data: staff } = await window.supabase.functions.invoke('manage-staff', {
  body: { action: 'get_staff_list' }
});
console.log('staff:', staff);
```

---

## Database Tables for Error Monitoring

The following tables support the cleanup and alerting infrastructure:

### error_alert_log
```sql
CREATE TABLE IF NOT EXISTS error_alert_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  alert_key TEXT NOT NULL,
  function_name TEXT,
  error_category TEXT,
  error_count INTEGER DEFAULT 0,
  details JSONB DEFAULT '{}',
  email_sent_to TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_error_alert_log_key ON error_alert_log(alert_key);
CREATE INDEX idx_error_alert_log_created ON error_alert_log(created_at DESC);
```

### error_digest_log
```sql
CREATE TABLE IF NOT EXISTS error_digest_log (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  digest_date DATE UNIQUE NOT NULL,
  total_errors INTEGER DEFAULT 0,
  auto_resolved_count INTEGER DEFAULT 0,
  deleted_count INTEGER DEFAULT 0,
  top_functions JSONB DEFAULT '[]',
  category_breakdown JSONB DEFAULT '{}',
  comparison_vs_previous JSONB DEFAULT '{}',
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_to TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### error_logs additions
```sql
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS auto_resolved BOOLEAN DEFAULT FALSE;
ALTER TABLE error_logs ADD COLUMN IF NOT EXISTS auto_resolved_at TIMESTAMPTZ;
```

---

## Cron Schedule

| Function | Schedule | Purpose |
|----------|----------|---------|
| `cleanup-error-logs` | Daily at 6:00 AM UTC | Auto-resolve 7d+ errors, delete 30d+ entries, email digest |
| `check-error-thresholds` | Every 15 minutes | Detect threshold breaches, send alert emails |

### pg_cron Setup (if available)
```sql
SELECT cron.schedule('cleanup-error-logs', '0 6 * * *', 
  $$SELECT net.http_post(
    'https://zhobqrmkbtsqugtiahyn.databasepad.com/functions/v1/cleanup-error-logs',
    '{}',
    'application/json',
    ARRAY[
      ('apikey', 'YOUR_ANON_KEY')::net.http_header,
      ('Authorization', 'Bearer YOUR_ANON_KEY')::net.http_header
    ]
  )$$
);

SELECT cron.schedule('check-error-thresholds', '*/15 * * * *',
  $$SELECT net.http_post(
    'https://zhobqrmkbtsqugtiahyn.databasepad.com/functions/v1/check-error-thresholds',
    '{}',
    'application/json',
    ARRAY[
      ('apikey', 'YOUR_ANON_KEY')::net.http_header,
      ('Authorization', 'Bearer YOUR_ANON_KEY')::net.http_header
    ]
  )$$
);
```

### Alternative: External Cron (if pg_cron unavailable)
Use an external service like cron-job.org, GitHub Actions, or Vercel Cron:

```bash
# Daily cleanup at 6 AM UTC
curl -X POST https://zhobqrmkbtsqugtiahyn.databasepad.com/functions/v1/cleanup-error-logs \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{}'

# Every 15 minutes threshold check
curl -X POST https://zhobqrmkbtsqugtiahyn.databasepad.com/functions/v1/check-error-thresholds \
  -H "Content-Type: application/json" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{}'
```
