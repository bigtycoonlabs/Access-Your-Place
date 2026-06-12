# Investor Registration Fix

This document explains how to fix the "Failed to send a request to the edge function" error when investors try to create accounts.

## Problem

The investor registration is failing with the error "Failed to send a request to the edge function" because:
1. The `investor-auth-v2` edge function may not be deployed
2. The edge function endpoint may not be accessible
3. Required database tables (`investor_sessions`, `investor_login_history`, `security_alerts`) may not exist
4. Required columns on the `investors` table may be missing

## Quick Diagnosis

### Check Browser Console
1. Open your browser's Developer Tools (F12)
2. Go to the Console tab
3. Try to register and look for error messages like:
   - `"Failed to fetch"` - Network/CORS issue or function doesn't exist
   - `"Edge function returned a non-2xx status code"` - Function exists but has an error
   - `"investor-auth-v2 function may not be deployed"` - Function not found

### Check Network Tab
1. Open Developer Tools (F12) → Network tab
2. Try to register
3. Look for a request to `/functions/v1/investor-auth-v2`
4. Check the response status and body

## Solution

### Step 1: Run Database Migrations

Execute the following SQL in your Supabase SQL Editor:

```sql
-- Add columns to investors table for email verification and security
ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verification_token TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_verification_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS otp_code TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS otp_expires TIMESTAMP WITH TIME ZONE;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS last_login TIMESTAMP WITH TIME ZONE;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS sms_opt_in BOOLEAN DEFAULT FALSE;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS email_opt_in BOOLEAN DEFAULT TRUE;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS linked_staff_id UUID REFERENCES staff_users(id);
ALTER TABLE investors ADD COLUMN IF NOT EXISTS security_alerts_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS known_devices JSONB DEFAULT '[]';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS known_ips JSONB DEFAULT '[]';
ALTER TABLE investors ADD COLUMN IF NOT EXISTS show_guided_tour BOOLEAN DEFAULT TRUE;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS reset_token TEXT;
ALTER TABLE investors ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP WITH TIME ZONE;

-- Investor sessions table
CREATE TABLE IF NOT EXISTS investor_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  session_token TEXT UNIQUE NOT NULL,
  device_info JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  remember_me BOOLEAN DEFAULT FALSE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_investor_sessions_token ON investor_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_investor_sessions_investor ON investor_sessions(investor_id);
CREATE INDEX IF NOT EXISTS idx_investor_sessions_active ON investor_sessions(is_active, expires_at);

-- Investor login history table
CREATE TABLE IF NOT EXISTS investor_login_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID REFERENCES investors(id) ON DELETE CASCADE,
  email TEXT,
  ip_address TEXT,
  user_agent TEXT,
  device_info JSONB DEFAULT '{}',
  location TEXT,
  success BOOLEAN DEFAULT TRUE,
  failure_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_login_history_investor ON investor_login_history(investor_id);
CREATE INDEX IF NOT EXISTS idx_login_history_email ON investor_login_history(email);
CREATE INDEX IF NOT EXISTS idx_login_history_created ON investor_login_history(created_at);

-- Security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  investor_id UUID NOT NULL REFERENCES investors(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT,
  device_info JSONB DEFAULT '{}',
  ip_address TEXT,
  location TEXT,
  is_acknowledged BOOLEAN DEFAULT FALSE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_investor ON security_alerts(investor_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_unread ON security_alerts(investor_id, is_acknowledged);
```

### Step 2: Deploy the Edge Function

1. Go to your Supabase Dashboard
2. Navigate to Edge Functions
3. Create a new function named `investor-auth-v2`
4. Copy the code from `INVESTOR_AUTH_V2_FUNCTION.md` into the function
5. Deploy the function

**Using Supabase CLI:**
```bash
# Create the function
supabase functions new investor-auth-v2

# Copy the code from INVESTOR_AUTH_V2_FUNCTION.md to supabase/functions/investor-auth-v2/index.ts

# Deploy
supabase functions deploy investor-auth-v2
```

### Step 3: Set Environment Variables

Make sure these environment variables are set in your Supabase project:

- `SUPABASE_URL` - Automatically set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Automatically set by Supabase  
- `RESEND_API_KEY` - Your Resend API key for sending emails

To set the Resend API key:
1. Go to Supabase Dashboard > Settings > Edge Functions
2. Add `RESEND_API_KEY` with your Resend API key value

### Step 4: Verify Edge Function is Deployed

1. Go to Supabase Dashboard > Edge Functions
2. Look for `investor-auth-v2` in the list
3. Check that the status shows "Active" or "Deployed"
4. Click on the function to see logs

### Step 5: Test Registration

1. Go to `/investor/login?tab=register`
2. Fill in the registration form
3. Submit and check the browser console for any errors
4. Check the Supabase Edge Function logs for detailed error messages

## Debugging

### If registration still fails, check:

1. **Edge Function Logs**: Supabase Dashboard > Edge Functions > investor-auth-v2 > Logs
2. **Browser Console**: Open DevTools (F12) and check the Console tab
3. **Network Tab**: Check the response from the edge function call

### Common Error Messages and Solutions:

| Error Message | Cause | Solution |
|--------------|-------|----------|
| "Failed to send a request to the edge function" | Function not deployed or network issue | Deploy the edge function |
| "Edge function returned a non-2xx status code" | Function has an error | Check edge function logs |
| "Unable to connect to the registration service" | Function endpoint not accessible | Verify function is deployed and active |
| "Registration failed. Please try again." | Database or function error | Check edge function logs for details |

### Common Issues:

- **Missing `RESEND_API_KEY`** - Registration will work but verification emails won't send
- **Database column missing** - Check that all ALTER TABLE commands ran successfully
- **Table doesn't exist** - Check that CREATE TABLE commands ran successfully
- **CORS issues** - The edge function includes CORS headers, but check if there are proxy issues

## Frontend Changes Made

The `InvestorLogin.tsx` file has been updated with:
- Better error handling and logging
- Specific error messages for edge function connection issues
- Console logging for debugging with detailed request/response info
- Graceful handling when session token is not returned
- Increased timeout to 30 seconds
- More descriptive error messages for users

## Testing the Edge Function Directly

You can test the edge function using curl:

```bash
curl -X POST 'https://your-project-ref.supabase.co/functions/v1/investor-auth-v2' \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -d '{"action": "register", "email": "test@example.com", "password": "testpassword123", "full_name": "Test User"}'
```

Replace:
- `your-project-ref` with your Supabase project reference
- `YOUR_ANON_KEY` with your Supabase anon key

## Support

If you continue to experience issues:
1. Contact support at success@accessyourplace.com
2. Include the browser console logs
3. Include the edge function logs if available
4. Describe the exact error message you see
