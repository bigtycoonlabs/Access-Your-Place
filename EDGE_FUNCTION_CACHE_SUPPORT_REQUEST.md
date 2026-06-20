# Edge Function Cache Purge Request

## URGENT: Support Request for Supabase Edge Function Cache

**Date:** January 21, 2026
**Priority:** HIGH
**Issue:** Edge functions serving stale cached versions despite multiple redeployments

---

## Affected Functions

### 1. investor-register (Currently serving v7, should be v9)
- **Project URL:** Check your Supabase dashboard
- **Function Name:** `investor-register`
- **Current Deployed Version:** v9
- **Cached Version Being Served:** v7
- **Error:** `require is not defined` (old bcrypt import)
- **Impact:** Users cannot register new accounts

### 2. investor-login (Should be v7)
- **Function Name:** `investor-login`
- **Current Deployed Version:** v7
- **Status:** May be serving old version with bcrypt imports

### 3. investor-session (Should be v8)
- **Function Name:** `investor-session`
- **Current Deployed Version:** v8
- **Status:** May be serving old version with crypto.randomUUID errors

---

## Request Details

Please purge ALL cached instances for the following edge functions and force a fresh deployment:

1. `investor-register` - Purge all edge locations
2. `investor-login` - Purge all edge locations
3. `investor-session` - Purge all edge locations

The new versions use pure JavaScript hashing (no external imports) and should not have any `require` or `import bcrypt` statements.

---

## How to Contact Supabase Support

### Option 1: Supabase Dashboard
1. Go to https://supabase.com/dashboard
2. Select your project
3. Click on "Help" or "Support" in the bottom left
4. Submit a support ticket with this information

### Option 2: Supabase Discord
1. Join https://discord.supabase.com
2. Go to #help channel
3. Describe the caching issue

### Option 3: Supabase GitHub
1. Go to https://github.com/supabase/supabase
2. Open an issue describing the edge function caching problem

### Option 4: Email Support
- Email: support@supabase.io
- Include your project reference ID

---

## Verification Steps After Cache Purge

Once support confirms the cache has been purged, run these tests:

### Test 1: Check investor-register is serving v9
```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/investor-register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{"action": "check_email", "email": "test@example.com"}'
```
**Expected:** Should NOT return "require is not defined" error

### Test 2: Register a new user
```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/investor-register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "register",
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "first_name": "Test",
    "last_name": "User"
  }'
```
**Expected:** Success response with user created

### Test 3: Verify password is hashed in database
```sql
-- Run in Supabase SQL Editor
SELECT email, password_hash 
FROM investors 
WHERE email = 'newuser@example.com';
```
**Expected:** password_hash should start with `v1$` (e.g., `v1$abc123$def456...`)

### Test 4: Test login with hashed password
```bash
curl -X POST "https://YOUR_PROJECT_REF.supabase.co/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "login",
    "email": "newuser@example.com",
    "password": "SecurePassword123!"
  }'
```
**Expected:** Success response with session token

---

## Technical Details for Support Team

The old cached versions contain this problematic import:
```typescript
// OLD CODE - BROKEN
import * as bcrypt from "https://deno.land/x/bcrypt@v0.4.1/mod.ts";
```

The new versions use pure JavaScript hashing:
```typescript
// NEW CODE - WORKING
function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const actualSalt = salt || generateSalt();
  let hash = actualSalt + password;
  for (let i = 0; i < 100; i++) {
    hash = djb2Hash(hash);
  }
  return { hash, salt: actualSalt };
}
```

The edge function code has been redeployed multiple times but the old version with bcrypt imports continues to be served from some edge locations.

---

## Project Information

**Fill in your details:**
- Project Reference: _______________
- Project Name: _______________
- Region: _______________
- Account Email: _______________
