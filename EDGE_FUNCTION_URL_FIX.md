# Edge Function URL Configuration Fix

## Issue
Edge functions are returning "Failed to parse URL from rest/v1/properties" errors, preventing deal creation and deletion from working.

## Immediate Fix Applied (Frontend)
The frontend code has been updated to use **direct database operations as the primary method**, with edge functions as a fallback. This means:

1. **Deal Creation (AddDealModal.tsx)**: Now tries direct database insert first, then falls back to edge function
2. **Deal Deletion (DealFlowTab.tsx)**: Now tries direct database delete first, then falls back to edge function
3. **All other operations**: Have similar fallback mechanisms

**Staff can now upload and delete deals immediately** using the direct database connection.

## Long-term Fix: Configure Edge Function Environment Variables

To fully fix the edge functions, configure the following environment variables in the Supabase Dashboard:

### Steps:

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `zhobqrmkbtsqugtiahyn`
3. **Navigate to**: Edge Functions → Select each function
4. **Add Environment Variables**:

For each of these edge functions:
- `new-deal-create`
- `delete-property`
- `update-property`
- `get-properties`

Add these environment variables:

| Variable Name | Value |
|---------------|-------|
| `SUPABASE_URL` | `https://zhobqrmkbtsqugtiahyn.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | (Get from Settings → API → service_role key) |

### Finding the Service Role Key:
1. Go to **Settings** → **API** in your Supabase Dashboard
2. Under "Project API keys", find the `service_role` key (starts with `eyJ...`)
3. Copy this key and use it for `SUPABASE_SERVICE_ROLE_KEY`

### After Setting Variables:
1. Click "Save" for each edge function
2. Redeploy each function by clicking "Deploy" or making a small code change

## Verification

After configuring, test by:
1. Creating a new deal in the Staff Dashboard
2. Deleting a deal
3. Updating a deal's status

Check the browser console for messages like:
- "Direct database insert successful" - Using the frontend fallback
- "Edge function successful" - Edge function is working

## Technical Details

### Why This Happens
Edge functions need the `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` environment variables to create a Supabase client. Without these, the functions can't connect to the database.

### Current Workaround
The frontend now uses the Supabase JS client directly with the anon key for all operations. This works because:
1. The anon key has sufficient permissions for CRUD operations on the `properties` table
2. RLS (Row Level Security) policies allow these operations

### Edge Function Code Pattern
Edge functions should use this pattern:

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Validate environment variables
if (!supabaseUrl || !supabaseKey) {
  return new Response(
    JSON.stringify({ error: 'Missing environment variables' }),
    { status: 500 }
  )
}

const supabase = createClient(supabaseUrl, supabaseKey)
```

## Status
- ✅ Frontend fallback implemented and working
- ⏳ Edge function environment variables need to be configured in Supabase Dashboard
- ⏳ Edge functions need to be redeployed after configuration
