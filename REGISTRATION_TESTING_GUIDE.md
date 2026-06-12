# Investor Registration & Login Testing Guide

## Status: CACHE PURGE REQUIRED ⚠️

Last Updated: 2026-01-22T00:00:00Z

## Edge Functions Status

| Function | Deployed Version | Cached Version | Status |
|----------|------------------|----------------|--------|
| investor-register | v9 | v7 | ❌ Serving stale cache with bcrypt errors |
| investor-login | v7 | Unknown | ⚠️ May be serving old version |
| investor-session | v8 | Unknown | ⚠️ May be serving old version |

## ACTION REQUIRED: Contact Supabase Support

See `EDGE_FUNCTION_CACHE_SUPPORT_REQUEST.md` for the support request template.

**Request:** Purge all cached instances for investor-register, investor-login, and investor-session functions.

---

## Password Hashing Implementation

### New Hash Format (v9+)
Passwords are now stored in the format: `v1$salt$hash`

Example: `v1$a1b2c3d4e5f6$7g8h9i0j1k2l3m4n5o6p`

### Hashing Algorithm
- Pure JavaScript implementation (no external dependencies)
- Uses salted iterated djb2 hashing with 100 passes
- No bcrypt/argon2 imports (these caused "require is not defined" errors)

### Verify Password Hashing in Database
```sql
SELECT 
  email,
  CASE 
    WHEN password_hash LIKE 'v1$%' THEN 'HASHED ✅'
    WHEN password_hash IS NULL THEN 'NO PASSWORD'
    ELSE 'PLAIN TEXT ❌ (needs upgrade)'
  END as hash_status,
  LEFT(password_hash, 25) as hash_preview
FROM investors
ORDER BY created_at DESC
LIMIT 10;
```

### Legacy Password Auto-Upgrade
When a user with a plain text password logs in:
1. Login function verifies plain text password
2. Automatically hashes and updates to v1 format
3. Future logins use hashed comparison

---

## Test Commands

### 1. Test Registration (After Cache Purge)
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/investor-register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "register",
    "email": "newuser@example.com",
    "password": "SecurePassword123!",
    "first_name": "Test",
    "last_name": "User",
    "phone": "555-123-4567"
  }'
```

Expected Response:
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "investor_id": "uuid-here",
  "email_sent": true
}
```

### 2. Test Login
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "login",
    "email": "newuser@example.com",
    "password": "SecurePassword123!"
  }'
```

### 3. Test Email Verification
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/investor-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "verify_email",
    "token": "TOKEN_FROM_EMAIL_LINK"
  }'
```

### 4. Test Session Validation
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/investor-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "validate_session",
    "session_token": "SESSION_TOKEN_FROM_LOGIN"
  }'
```

### 5. Test Password Reset
```bash
# Request reset
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "forgot_password",
    "email": "newuser@example.com"
  }'

# Complete reset (with token from email)
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "reset_password",
    "token": "RESET_TOKEN_FROM_EMAIL",
    "new_password": "NewSecurePassword456!"
  }'
```

---

## Email Verification Flow

1. User registers → Verification email sent via Resend API
2. Email contains link: `https://yoursite.com/investor/verify-email?token=XXX`
3. User clicks link → Frontend calls investor-session with verify_email action
4. Token validated → `email_verified` set to true in database
5. User redirected to login page

### Resend Verification Email
```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/functions/v1/investor-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "resend_verification",
    "email": "user@example.com",
    "base_url": "https://yoursite.com"
  }'
```

---

## Known Issues

### 1. Edge Function Caching (CRITICAL)
Old versions with bcrypt imports are being served despite v9 deployment.
**Error:** `require is not defined`
**Solution:** Contact Supabase support to purge cache

### 2. RPC Fallback Available
The frontend has fallback RPC functions:
- `validate_investor_session` - Validates session tokens
- `register_investor` - Fallback registration
- `login_investor` - Fallback login

---

## Database Tables

### investors
- `id` - UUID primary key
- `email` - Unique email address
- `password_hash` - Hashed password (v1$salt$hash format)
- `first_name`, `last_name` - User name
- `email_verified` - Boolean verification status
- `referral_code` - Unique referral code

### investor_sessions
- `id` - UUID primary key
- `investor_id` - Foreign key to investors
- `session_token` - Unique session token
- `expires_at` - Session expiration timestamp
- `is_active` - Boolean active status

### email_verification_tokens
- `id` - UUID primary key
- `investor_id` - Foreign key to investors
- `token` - Verification token
- `expires_at` - Token expiration (24 hours)
- `used` - Boolean used status

### password_reset_tokens
- `id` - UUID primary key
- `investor_id` - Foreign key to investors
- `token` - Reset token
- `expires_at` - Token expiration (1 hour)
- `used` - Boolean used status

---

## Complete Test Flow Checklist

After cache is purged, run through this checklist:

- [ ] 1. Check email availability (should return `available: true`)
- [ ] 2. Register new user (should return `success: true`)
- [ ] 3. Verify password_hash starts with `v1$` in database
- [ ] 4. Check verification email received
- [ ] 5. Click verification link (or call verify_email API)
- [ ] 6. Verify email_verified = true in database
- [ ] 7. Login with credentials (should return session token)
- [ ] 8. Validate session (should return `valid: true`)
- [ ] 9. Request password reset
- [ ] 10. Complete password reset with new password
- [ ] 11. Login with new password
- [ ] 12. Logout (invalidate session)

See `AUTH_FLOW_TEST_SCRIPT.md` for detailed curl commands for each step.
