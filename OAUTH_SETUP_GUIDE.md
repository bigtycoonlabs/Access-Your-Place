# OAuth Social Login Setup Guide

This guide explains how to configure Google OAuth and Apple Sign-In for investor authentication in the Access Your Place platform.

## Table of Contents

1. [Overview](#overview)
2. [Google OAuth Setup](#google-oauth-setup)
3. [Apple Sign-In Setup](#apple-sign-in-setup)
4. [Supabase Edge Function Configuration](#supabase-edge-function-configuration)
5. [Testing OAuth Flow](#testing-oauth-flow)
6. [Troubleshooting](#troubleshooting)

---

## Overview

The platform supports social login via:
- **Google Sign-In** - Uses Google OAuth 2.0
- **Apple Sign-In** - Uses Sign in with Apple

Users can:
- Sign up with a social account (creates new investor account)
- Sign in with a linked social account
- Link social accounts to existing investor accounts
- Unlink social accounts from their profile

---

## Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Enter project name: `Access Your Place` (or your preferred name)
4. Click "Create"

### Step 2: Enable Required APIs

1. In your project, go to **APIs & Services** → **Library**
2. Search for and enable:
   - **Google+ API** (for profile info)
   - **Google People API** (optional, for additional profile data)

### Step 3: Configure OAuth Consent Screen

1. Go to **APIs & Services** → **OAuth consent screen**
2. Select **External** user type (unless you have Google Workspace)
3. Fill in the required fields:
   - **App name**: Access Your Place
   - **User support email**: Your support email
   - **App logo**: Upload your logo (optional)
   - **App domain**: `https://yourdomain.com`
   - **Authorized domains**: Add your domain(s)
   - **Developer contact email**: Your email

4. Click "Save and Continue"

5. **Scopes**: Add the following scopes:
   - `email`
   - `profile`
   - `openid`

6. Click "Save and Continue"

7. **Test users** (for development):
   - Add test user emails while in testing mode
   - Once verified, you can publish the app

### Step 4: Create OAuth 2.0 Credentials

1. Go to **APIs & Services** → **Credentials**
2. Click **+ CREATE CREDENTIALS** → **OAuth client ID**
3. Select **Web application**
4. Configure:
   - **Name**: `Access Your Place Web Client`
   - **Authorized JavaScript origins**:
     ```
     https://yourdomain.com
     http://localhost:5173 (for development)
     http://localhost:3000 (for development)
     ```
   - **Authorized redirect URIs**:
     ```
     https://yourdomain.com/oauth/callback/investor
     http://localhost:5173/oauth/callback/investor
     http://localhost:3000/oauth/callback/investor
     ```

5. Click "Create"

6. **Save your credentials**:
   - **Client ID**: `xxxxxxxxxxxx.apps.googleusercontent.com`
   - **Client Secret**: `GOCSPX-xxxxxxxxxxxx`

### Step 5: Publish OAuth App (Production)

1. Go to **OAuth consent screen**
2. Click "PUBLISH APP"
3. Complete Google's verification process if required

---

## Apple Sign-In Setup

### Prerequisites

- Apple Developer Program membership ($99/year)
- Access to [Apple Developer Portal](https://developer.apple.com/)

### Step 1: Create an App ID

1. Go to **Certificates, Identifiers & Profiles**
2. Click **Identifiers** → **+** (Add)
3. Select **App IDs** → Continue
4. Select **App** → Continue
5. Configure:
   - **Description**: Access Your Place
   - **Bundle ID**: `com.accessyourplace.web` (Explicit)
6. Under **Capabilities**, check **Sign in with Apple**
7. Click "Continue" → "Register"

### Step 2: Create a Services ID

1. Go to **Identifiers** → **+** (Add)
2. Select **Services IDs** → Continue
3. Configure:
   - **Description**: Access Your Place Web
   - **Identifier**: `com.accessyourplace.web.service`
4. Click "Continue" → "Register"

5. Click on the newly created Services ID
6. Check **Sign in with Apple** → Click "Configure"
7. Configure Web Authentication:
   - **Primary App ID**: Select your App ID
   - **Domains and Subdomains**: `yourdomain.com`
   - **Return URLs**:
     ```
     https://yourdomain.com/oauth/callback/investor
     ```
8. Click "Save" → "Continue" → "Save"

### Step 3: Create a Key for Sign in with Apple

1. Go to **Keys** → **+** (Add)
2. Configure:
   - **Key Name**: Access Your Place Sign In
   - Check **Sign in with Apple**
   - Click "Configure" → Select your Primary App ID
3. Click "Continue" → "Register"
4. **Download the key file** (`.p8` file) - you can only download once!
5. Note the **Key ID** displayed

### Step 4: Generate Client Secret

Apple requires a JWT client secret that must be regenerated periodically. Here's how to generate it:

```javascript
// generate-apple-secret.js
const jwt = require('jsonwebtoken');
const fs = require('fs');

const privateKey = fs.readFileSync('AuthKey_XXXXXXXXXX.p8'); // Your .p8 file

const teamId = 'YOUR_TEAM_ID'; // Found in Apple Developer account
const clientId = 'com.accessyourplace.web.service'; // Your Services ID
const keyId = 'YOUR_KEY_ID'; // From Step 3

const token = jwt.sign({}, privateKey, {
  algorithm: 'ES256',
  expiresIn: '180d', // Max 6 months
  audience: 'https://appleid.apple.com',
  issuer: teamId,
  subject: clientId,
  keyid: keyId
});

console.log('Apple Client Secret:', token);
```

Run this script to generate your client secret:
```bash
npm install jsonwebtoken
node generate-apple-secret.js
```

**Important**: The client secret expires after 6 months. Set a reminder to regenerate it.

### Apple OAuth Values Summary

- **Client ID**: `com.accessyourplace.web.service` (your Services ID)
- **Client Secret**: The JWT generated above
- **Team ID**: Found in your Apple Developer account membership details
- **Key ID**: From the key you created

---

## Supabase Edge Function Configuration

### Setting Environment Variables

Add the OAuth credentials to your Supabase project:

#### Via Supabase Dashboard

1. Go to your Supabase project
2. Navigate to **Settings** → **Edge Functions**
3. Under **Secrets**, add the following:

```
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx
APPLE_CLIENT_ID=com.accessyourplace.web.service
APPLE_CLIENT_SECRET=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Via Supabase CLI

```bash
# Set Google OAuth credentials
supabase secrets set GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
supabase secrets set GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxx

# Set Apple OAuth credentials
supabase secrets set APPLE_CLIENT_ID=com.accessyourplace.web.service
supabase secrets set APPLE_CLIENT_SECRET=eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Verify Configuration

The `investor-oauth` edge function checks for configured providers. You can verify by calling:

```javascript
const { data } = await supabase.functions.invoke('investor-oauth', {
  body: { action: 'check_oauth_config' }
});

console.log(data);
// Expected: { success: true, providers: { google: true, apple: true } }
```

---

## Testing OAuth Flow

### Test Google Sign-In

1. Go to `/investor/login`
2. Click "Continue with Google"
3. Select a Google account
4. Verify redirect back to the app
5. Check that the investor account is created/linked

### Test Apple Sign-In

1. Go to `/investor/login`
2. Click "Continue with Apple"
3. Sign in with Apple ID
4. Choose to share or hide email
5. Verify redirect back to the app
6. Check that the investor account is created/linked

### Test Account Linking

1. Log in with email/password
2. Go to Account Settings → Security
3. Click "Link Google Account" or "Link Apple Account"
4. Complete OAuth flow
5. Verify account is linked in the Linked Accounts section

### Test Account Unlinking

1. Log in to an account with linked social accounts
2. Go to Account Settings → Security
3. Click "Unlink" on a linked account
4. Verify the account is unlinked
5. Note: Cannot unlink if it's the only login method

---

## Troubleshooting

### Google OAuth Issues

#### "redirect_uri_mismatch" Error
- Ensure the redirect URI exactly matches what's configured in Google Cloud Console
- Check for trailing slashes
- Verify the protocol (http vs https)

#### "access_denied" Error
- User cancelled the OAuth flow
- App is in testing mode and user is not a test user
- Required scopes were not granted

#### "invalid_client" Error
- Client ID or Client Secret is incorrect
- Credentials have been deleted or regenerated

### Apple Sign-In Issues

#### "invalid_client" Error
- Client ID (Services ID) is incorrect
- Client Secret JWT has expired (regenerate it)
- Team ID or Key ID is incorrect

#### "invalid_grant" Error
- Authorization code has expired (codes are single-use and expire quickly)
- Redirect URI doesn't match

#### User Email Not Received
- Apple allows users to hide their email
- A relay email like `xxxxx@privaterelay.appleid.com` will be provided
- Store and use this relay email for communication

### General Issues

#### Social Login Buttons Not Appearing
- Check that OAuth credentials are set in Supabase secrets
- Verify `check_oauth_config` returns the expected providers
- Check browser console for errors

#### "Account Already Linked" Error
- The social account is already linked to another investor account
- User must unlink from the other account first

#### "Cannot Unlink" Error
- This is the user's only login method
- User must set a password or link another account first

### Database Queries for Debugging

```sql
-- Check linked social accounts for an investor
SELECT * FROM investor_social_accounts 
WHERE investor_id = 'uuid-here';

-- Check OAuth states (for debugging flow issues)
SELECT * FROM oauth_states 
WHERE created_at > NOW() - INTERVAL '1 hour'
ORDER BY created_at DESC;

-- Find investor by social provider
SELECT i.*, isa.provider, isa.provider_user_id 
FROM investors i
JOIN investor_social_accounts isa ON i.id = isa.investor_id
WHERE isa.provider = 'google' 
AND isa.provider_email = 'user@gmail.com';
```

---

## Security Considerations

1. **Never expose client secrets** in frontend code
2. **Use HTTPS** in production for all OAuth redirect URIs
3. **Validate state parameter** to prevent CSRF attacks
4. **Store tokens securely** - access tokens in the database are encrypted
5. **Regenerate Apple client secret** before expiration (every 6 months)
6. **Monitor for suspicious activity** - multiple failed OAuth attempts
7. **Implement rate limiting** on OAuth endpoints

---

## Production Checklist

- [ ] Google OAuth app is published and verified
- [ ] Apple Sign-In is configured with production redirect URIs
- [ ] All environment variables are set in Supabase
- [ ] HTTPS is enabled for all redirect URIs
- [ ] OAuth consent screens have proper branding
- [ ] Privacy Policy and Terms of Service links are added
- [ ] Test accounts are removed from Google OAuth (if applicable)
- [ ] Apple client secret expiration is calendared
- [ ] Error monitoring is set up for OAuth failures
- [ ] Rate limiting is configured

---

## Support

For issues with OAuth setup, contact:
- **Email**: success@accessyourplace.com
- **Documentation**: Check the edge function logs in Supabase dashboard
