# Complete Setup Guide for Access Your Place Platform

## 1. Database Setup

Run the following SQL in Supabase SQL Editor:

```sql
-- See DATABASE_SCHEMA.sql for complete schema
-- Key tables: staff_users, investors, email_templates, email_logs, referrals, referral_rewards
```

## 2. Edge Functions Deployment

Deploy these edge functions in Supabase Dashboard > Edge Functions:

1. **staff-login** - Staff authentication (see STAFF_LOGIN_FUNCTION.md)
2. **staff-forgot-password** - Staff password reset (see STAFF_FORGOT_PASSWORD_FUNCTION.md)
3. **investor-auth** - Investor authentication (see INVESTOR_AUTH_FUNCTION.md)
4. **manage-referrals** - Referral program (see MANAGE_REFERRALS_FUNCTION.md)
5. **manage-email-templates** - Email templates (see EMAIL_TEMPLATES_FUNCTIONS.md)
6. **send-inquiry-notifications** - Email sending (see SEND_NOTIFICATIONS_FUNCTION.md)

## 3. Environment Variables

Set these in Supabase Dashboard > Edge Functions > Secrets:

- `RESEND_API_KEY` - Your Resend API key
- `SUPABASE_URL` - Auto-set by Supabase
- `SUPABASE_SERVICE_ROLE_KEY` - Auto-set by Supabase

## 4. Resend Setup

1. Go to https://resend.com/domains
2. Add domain: accessyourplace.com
3. Add DNS records as instructed
4. Wait for verification (usually 5-10 minutes)
5. Copy API key to Supabase secrets

## 5. Default Credentials

**Staff Login:**
- URL: /staff/login
- Email: hello@accessyourplace.com
- Password: VigVission55!

**Investor Portal:**
- URL: /investor/login
- Create new account via registration form

## 6. Testing Checklist

### Staff Authentication
- [ ] Login at /staff/login with hello@accessyourplace.com / VigVission55!
- [ ] Click "Forgot password?" and enter email
- [ ] Check email_logs table for sent status
- [ ] Check inbox for reset email
- [ ] Click reset link and set new password

### Investor Authentication
- [ ] Go to /investor/login
- [ ] Click "Register" tab
- [ ] Fill out registration form
- [ ] Complete onboarding wizard
- [ ] Test Deal Locator AI
- [ ] Test referral program
- [ ] Test forgot password flow

### Email Templates
- [ ] Go to Staff Dashboard > Email Templates
- [ ] Select a template
- [ ] Enter test email address
- [ ] Click "Send Test"
- [ ] Verify email arrives
- [ ] Check email_logs table

## 7. Troubleshooting

### Emails Not Sending
1. Verify RESEND_API_KEY is set correctly
2. Check domain is verified in Resend
3. Check email_logs table for error messages
4. Try sending from Resend dashboard directly

### Login Issues
1. Verify staff_users/investors table has correct data
2. Check password hash is valid bcrypt
3. Check edge function logs in Supabase

### 404 Errors
1. Verify edge function is deployed
2. Check function name matches exactly
3. Wait 2-3 minutes for cache to clear
