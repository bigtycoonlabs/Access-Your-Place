# Push Notification Setup Guide - Access Your Place

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    NOTIFICATION FLOW                      │
│                                                           │
│  Deal Published → check-deal-alerts → send-push-notification  │
│                                           │                │
│                    ┌──────────────────────┼────────────┐  │
│                    │                      │            │  │
│                    ▼                      ▼            ▼  │
│              FCM (Android)         FCM→APNs (iOS)  Email  │
│                    │                      │            │  │
│                    ▼                      ▼            ▼  │
│              Android Device        iOS Device      Inbox  │
│                    │                      │               │
│                    └──────────┬───────────┘               │
│                               ▼                           │
│                    Notification Tapped                     │
│                               │                           │
│                               ▼                           │
│                    Deep Link → Portal Tab                  │
└─────────────────────────────────────────────────────────┘
```

## Database Tables

### device_tokens
Stores push notification tokens for each investor's devices.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| investor_id | UUID | Investor reference |
| token | TEXT | FCM/APNs token |
| platform | TEXT | ios, android, or web |
| device_id | TEXT | Unique device identifier |
| device_model | TEXT | Device model name |
| os_version | TEXT | OS version |
| app_version | TEXT | App version |
| is_active | BOOLEAN | Whether token is active |
| last_used_at | TIMESTAMPTZ | Last notification sent |
| created_at | TIMESTAMPTZ | Token registration time |

### push_notification_log
Tracks all sent push notifications for analytics.

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| investor_id | UUID | Target investor |
| device_token_id | UUID | Device token reference |
| notification_type | TEXT | deal_alert, document_update, etc. |
| title | TEXT | Notification title |
| body | TEXT | Notification body |
| data | JSONB | Additional data payload |
| platform | TEXT | Target platform |
| status | TEXT | pending, sent, delivered, failed, clicked |
| deep_link | TEXT | Deep link URL |
| sent_at | TIMESTAMPTZ | When notification was sent |
| clicked_at | TIMESTAMPTZ | When notification was tapped |

## Edge Functions

### send-push-notification
Handles all push notification operations:

**Actions:**
- `register_token` - Register a device token
- `unregister_token` - Deactivate a device token
- `send_deal_alert` - Send deal alert to investor(s)
- `send_document_update` - Send document update notification
- `send_acquisition_milestone` - Send acquisition milestone notification
- `send_notification` - Send custom notification
- `send_message_notification` - Send new message notification
- `broadcast` - Send to all active investors
- `get_history` - Get notification history
- `get_tokens` - Get registered device tokens
- `mark_clicked` - Mark notification as clicked
- `cleanup_stale` - Remove tokens unused for 90+ days

### check-deal-alerts (Updated)
Now triggers push notifications alongside email when `push_alerts` is enabled in investor preferences.

## Setup Instructions

### 1. Firebase Cloud Messaging (FCM) Setup

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project or select existing
3. Add iOS and Android apps
4. Download configuration files:
   - iOS: `GoogleService-Info.plist` → place in `ios/App/App/`
   - Android: `google-services.json` → place in `android/app/`

### 2. iOS APNs Configuration

1. **Apple Developer Portal:**
   - Go to Certificates, Identifiers & Profiles
   - Create an APNs Key (or certificate)
   - Download the `.p8` key file

2. **Firebase Console:**
   - Go to Project Settings → Cloud Messaging → iOS app
   - Upload the APNs key (.p8 file)
   - Enter Key ID and Team ID

3. **Xcode Configuration:**
   ```
   - Open ios/App/App.xcworkspace
   - Select App target → Signing & Capabilities
   - Add "Push Notifications" capability
   - Add "Background Modes" capability → check "Remote notifications"
   ```

4. **Info.plist additions:**
   ```xml
   <key>UIBackgroundModes</key>
   <array>
     <string>remote-notification</string>
   </array>
   ```

### 3. Android FCM Configuration

1. **Firebase Console:**
   - Add Android app with package name: `com.accessyourplace.app`
   - Download `google-services.json`
   - Place in `android/app/`

2. **AndroidManifest.xml additions:**
   ```xml
   <!-- FCM Default Notification Channel -->
   <meta-data
     android:name="com.google.firebase.messaging.default_notification_channel_id"
     android:value="deal_alerts" />
   
   <!-- FCM Default Notification Icon -->
   <meta-data
     android:name="com.google.firebase.messaging.default_notification_icon"
     android:resource="@drawable/ic_notification" />
   
   <!-- FCM Default Notification Color -->
   <meta-data
     android:name="com.google.firebase.messaging.default_notification_color"
     android:resource="@color/notification_color" />
   
   <!-- Deep Link Intent Filters -->
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="accessyourplace" />
   </intent-filter>
   
   <intent-filter android:autoVerify="true">
     <action android:name="android.intent.action.VIEW" />
     <category android:name="android.intent.category.DEFAULT" />
     <category android:name="android.intent.category.BROWSABLE" />
     <data android:scheme="https"
           android:host="accessyourplace.com"
           android:pathPrefix="/investor" />
   </intent-filter>
   ```

### 4. Deep Linking Setup

**iOS Universal Links:**
- File: `public/.well-known/apple-app-site-association`
- Replace `TEAM_ID` with your Apple Developer Team ID
- Host at: `https://accessyourplace.com/.well-known/apple-app-site-association`
- Content-Type must be `application/json`

**Android App Links:**
- File: `public/.well-known/assetlinks.json`
- Replace `SHA256_CERT_FINGERPRINT_HERE` with your signing certificate fingerprint
- Get fingerprint: `keytool -list -v -keystore your-keystore.jks`
- Host at: `https://accessyourplace.com/.well-known/assetlinks.json`

**Custom URL Scheme:**
- Both platforms support: `accessyourplace://`
- Examples:
  - `accessyourplace://investor?tab=deal-alerts`
  - `accessyourplace://deals/DEAL_ID`
  - `accessyourplace://investor?tab=documents`

### 5. App Icon Assets

Generated app icon images:
- **Icon (1024x1024):** `https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1771044924967_36387b2f.jpg`
- **Foreground (1024x1024):** `https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1771044943917_478a3395.png`
- **Splash (1024x1024):** `https://d64gsuwffb70l.cloudfront.net/6912a1d2ea97d4e30b03d36a_1771044961828_17fb30dd.jpg`

**To generate all icon sizes:**
```bash
# Download icons to assets/ directory
curl -o assets/icon-only.png "ICON_URL"
curl -o assets/icon-foreground.png "FOREGROUND_URL"  
curl -o assets/splash.png "SPLASH_URL"

# Create solid navy background for Android adaptive icon
# (Use any image editor to create 1024x1024 solid #1a365d)
# Save as assets/icon-background.png

# Generate all sizes automatically
npx @capacitor/assets generate \
  --iconBackgroundColor '#1a365d' \
  --iconBackgroundColorDark '#0f1f33' \
  --splashBackgroundColor '#1a365d' \
  --splashBackgroundColorDark '#0f1f33'
```

## Notification Types & Deep Links

| Type | Title Example | Deep Link |
|------|--------------|-----------|
| deal_alert | "New 85% Match in Austin, TX" | `accessyourplace://investor?tab=deal-alerts` |
| document_update | "Document Updated" | `accessyourplace://investor?tab=documents` |
| acquisition_milestone | "Milestone: Lease Signed!" | `accessyourplace://investor?tab=acquisitions` |
| message | "New Message from AM" | `accessyourplace://investor?tab=messages` |
| general | "Platform Update" | `accessyourplace://investor?tab=dashboard` |

## Frontend Integration

### Token Registration Flow
1. User logs in → `InvestorPortal` mounts
2. `PushNotificationManager` component initializes
3. Calls `registerDeviceToken(investorId)` from `PushNotificationService`
4. Requests notification permission from OS
5. Gets FCM token from Capacitor `PushNotifications` plugin
6. Sends token to `send-push-notification` edge function with `register_token` action
7. Token stored in `device_tokens` table

### Notification Tap Handling
1. User taps notification
2. `pushNotificationActionPerformed` listener fires
3. Extracts `deep_link` and `notification_type` from payload
4. Maps to portal tab using `DEEP_LINK_TAB_MAP`
5. Calls `onNavigateToTab(tab)` callback
6. Portal navigates to correct tab
7. Marks notification as clicked in backend

### Logout Cleanup
1. User clicks logout
2. `unregisterDeviceToken(investorId)` called
3. Token marked as `is_active: false` in database
4. Local storage tokens cleared

## Android Notification Channels

| Channel ID | Name | Priority | Sound |
|-----------|------|----------|-------|
| deal_alerts | Deal Alerts | HIGH | deal_alert |
| documents | Document Updates | DEFAULT | default |
| acquisitions | Acquisition Milestones | HIGH | milestone |
| messages | Messages | DEFAULT | message |
| general | General Notifications | DEFAULT | default |

## Testing

### Test Push Notification
```bash
# Send test notification via edge function
curl -X POST https://api.databasepad.com/functions/v1/send-push-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "send_notification",
    "investor_id": "INVESTOR_UUID",
    "title": "Test Notification",
    "body": "This is a test push notification",
    "notification_type": "general",
    "deep_link": "accessyourplace://investor?tab=dashboard"
  }'
```

### Check Registered Tokens
```bash
curl -X POST https://api.databasepad.com/functions/v1/send-push-notification \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -d '{
    "action": "get_tokens",
    "investor_id": "INVESTOR_UUID"
  }'
```

## Cron Jobs

Add these to your cron schedule:

```sql
-- Daily digest at 8 AM EST
SELECT cron.schedule('daily-deal-digest', '0 13 * * *', $$
  SELECT net.http_post(
    url := 'https://api.databasepad.com/functions/v1/check-deal-alerts',
    body := '{"action": "send_digest", "frequency": "daily"}'::jsonb
  );
$$);

-- Weekly digest on Mondays at 8 AM EST
SELECT cron.schedule('weekly-deal-digest', '0 13 * * 1', $$
  SELECT net.http_post(
    url := 'https://api.databasepad.com/functions/v1/check-deal-alerts',
    body := '{"action": "send_digest", "frequency": "weekly"}'::jsonb
  );
$$);

-- Cleanup stale tokens monthly
SELECT cron.schedule('cleanup-push-tokens', '0 0 1 * *', $$
  SELECT net.http_post(
    url := 'https://api.databasepad.com/functions/v1/send-push-notification',
    body := '{"action": "cleanup_stale"}'::jsonb
  );
$$);
```
