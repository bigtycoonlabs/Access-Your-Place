# Complete Authentication Flow Test Script

## Prerequisites

Replace these variables with your actual values:
```bash
export SUPABASE_URL="https://YOUR_PROJECT_REF.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key-here"
export TEST_EMAIL="testuser_$(date +%s)@example.com"
export TEST_PASSWORD="SecureTestPass123!"
```

---

## Test 1: Check if investor-register is working (no bcrypt errors)

```bash
echo "=== Test 1: Check Email Availability ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{\"action\": \"check_email\", \"email\": \"$TEST_EMAIL\"}" | jq .
```

**Expected Response:**
```json
{
  "available": true
}
```

**If you see this error, cache is still stale:**
```json
{
  "error": "require is not defined"
}
```

---

## Test 2: Register a New User

```bash
echo "=== Test 2: Register New User ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-register" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"action\": \"register\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"first_name\": \"Test\",
    \"last_name\": \"User\",
    \"phone\": \"555-123-4567\"
  }" | jq .
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Registration successful. Please check your email to verify your account.",
  "investor_id": "uuid-here",
  "email_sent": true
}
```

---

## Test 3: Verify Password is Hashed in Database

Run this SQL in Supabase SQL Editor:

```sql
-- Check the password hash format
SELECT 
  id,
  email,
  first_name,
  last_name,
  LEFT(password_hash, 20) as hash_preview,
  CASE 
    WHEN password_hash LIKE 'v1$%' THEN 'HASHED (v1 format)'
    WHEN password_hash IS NULL THEN 'NO PASSWORD'
    ELSE 'PLAIN TEXT (INSECURE!)'
  END as hash_status,
  email_verified,
  created_at
FROM investors
WHERE email = 'YOUR_TEST_EMAIL_HERE'
ORDER BY created_at DESC
LIMIT 5;
```

**Expected:** hash_status should show "HASHED (v1 format)"

---

## Test 4: Check Email Verification Token

```sql
-- Check verification token was created
SELECT 
  i.email,
  evt.token,
  evt.expires_at,
  evt.used,
  evt.created_at
FROM email_verification_tokens evt
JOIN investors i ON i.id = evt.investor_id
WHERE i.email = 'YOUR_TEST_EMAIL_HERE'
ORDER BY evt.created_at DESC
LIMIT 1;
```

---

## Test 5: Simulate Email Verification (if email not received)

```bash
# First get the token from the database query above, then:
export VERIFICATION_TOKEN="token-from-database"

echo "=== Test 5: Verify Email ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"action\": \"verify_email\",
    \"token\": \"$VERIFICATION_TOKEN\"
  }" | jq .
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

---

## Test 6: Login with Credentials

```bash
echo "=== Test 6: Login ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"action\": \"login\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }" | jq .
```

**Expected Response:**
```json
{
  "success": true,
  "session_token": "session-uuid-here",
  "investor": {
    "id": "investor-uuid",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User"
  }
}
```

**Save the session token:**
```bash
export SESSION_TOKEN="session-token-from-response"
```

---

## Test 7: Validate Session

```bash
echo "=== Test 7: Validate Session ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-session" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"action\": \"validate_session\",
    \"session_token\": \"$SESSION_TOKEN\"
  }" | jq .
```

**Expected Response:**
```json
{
  "valid": true,
  "investor": {
    "id": "investor-uuid",
    "email": "test@example.com",
    "first_name": "Test",
    "last_name": "User"
  }
}
```

---

## Test 8: Password Reset Flow

### 8a: Request Password Reset
```bash
echo "=== Test 8a: Request Password Reset ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"action\": \"forgot_password\",
    \"email\": \"$TEST_EMAIL\"
  }" | jq .
```

**Expected Response:**
```json
{
  "success": true,
  "message": "If an account exists with this email, a password reset link has been sent."
}
```

### 8b: Get Reset Token from Database
```sql
SELECT token, expires_at, used
FROM password_reset_tokens
WHERE investor_id = (SELECT id FROM investors WHERE email = 'YOUR_TEST_EMAIL')
ORDER BY created_at DESC
LIMIT 1;
```

### 8c: Reset Password
```bash
export RESET_TOKEN="token-from-database"
export NEW_PASSWORD="NewSecurePass456!"

echo "=== Test 8c: Reset Password ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"action\": \"reset_password\",
    \"token\": \"$RESET_TOKEN\",
    \"new_password\": \"$NEW_PASSWORD\"
  }" | jq .
```

### 8d: Login with New Password
```bash
echo "=== Test 8d: Login with New Password ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"action\": \"login\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$NEW_PASSWORD\"
  }" | jq .
```

---

## Test 9: Logout

```bash
echo "=== Test 9: Logout ==="
curl -s -X POST "$SUPABASE_URL/functions/v1/investor-login" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $SUPABASE_ANON_KEY" \
  -d "{
    \"action\": \"logout\",
    \"session_token\": \"$SESSION_TOKEN\"
  }" | jq .
```

---

## Verification Checklist

After running all tests, verify:

- [ ] Test 1: No "require is not defined" error (cache cleared)
- [ ] Test 2: User registration successful
- [ ] Test 3: Password stored as `v1$salt$hash` format (not plain text)
- [ ] Test 4: Verification token created in database
- [ ] Test 5: Email verification works
- [ ] Test 6: Login returns session token
- [ ] Test 7: Session validation works
- [ ] Test 8: Password reset flow complete
- [ ] Test 9: Logout invalidates session

---

## Troubleshooting

### Error: "require is not defined"
- Cache still serving old version with bcrypt import
- Contact Supabase support to purge edge function cache

### Error: "Invalid password"
- Check if password_hash in database starts with `v1$`
- If not, the old plain text password may need to be reset

### Error: "Email not verified"
- Run Test 5 to manually verify the email
- Or check email_verified column in investors table

### Error: "Session expired"
- Sessions expire after 7 days
- Login again to get a new session token

### Error: 502/504 Gateway Timeout
- Edge function may be timing out
- Check Supabase dashboard for function logs
- May need to simplify database queries further
