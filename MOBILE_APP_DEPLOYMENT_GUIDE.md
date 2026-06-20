# Access Your Place - Mobile App Deployment Guide

## Overview

This guide covers deploying the Access Your Place platform as a native iOS app, Android app, and web application simultaneously using **Capacitor 6** by Ionic.

**Architecture:** Your existing React + Vite web app runs inside a native WebView on iOS/Android, with access to native device APIs through Capacitor plugins.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Initial Setup](#initial-setup)
3. [iOS Deployment](#ios-deployment)
4. [Android Deployment](#android-deployment)
5. [App Icons & Splash Screens](#app-icons--splash-screens)
6. [Push Notifications Setup](#push-notifications-setup)
7. [Deep Linking / Universal Links](#deep-linking--universal-links)
8. [OAuth Configuration for Native](#oauth-configuration-for-native)
9. [App Store Submission](#app-store-submission)
10. [Google Play Submission](#google-play-submission)
11. [Development Workflow](#development-workflow)
12. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### For iOS Development
- **macOS** (Sonoma 14+ recommended)
- **Xcode 15+** (download from Mac App Store)
- **Apple Developer Account** ($99/year) - https://developer.apple.com
- **CocoaPods** (installed via `sudo gem install cocoapods`)
- **Node.js 18+** and **npm 9+**

### For Android Development
- **Android Studio** (Hedgehog 2023.1+ recommended) - https://developer.android.com/studio
- **Google Play Developer Account** ($25 one-time) - https://play.google.com/console
- **Java Development Kit (JDK) 17+**
- **Node.js 18+** and **npm 9+**

### For Web Deployment
- Your existing hosting setup (Vercel, Netlify, etc.)
- No additional requirements

---

## Initial Setup

### Step 1: Install Dependencies

```bash
# Install all dependencies including Capacitor
npm install

# Verify Capacitor CLI is available
npx cap --version
```

### Step 2: Build the Web App

```bash
# Build the production web app
npm run build
```

This creates the `dist/` folder that Capacitor will bundle into native apps.

### Step 3: Add Native Platforms

```bash
# Add iOS platform (requires macOS)
npm run cap:add:ios

# Add Android platform
npm run cap:add:android
```

This creates `ios/` and `android/` directories with native project files.

### Step 4: Sync Web Assets to Native

```bash
# Build and sync to both platforms
npm run cap:sync
```

---

## iOS Deployment

### Opening in Xcode

```bash
npm run cap:open:ios
```

### Configure iOS Project in Xcode

1. **Bundle Identifier**: `com.accessyourplace.app`
2. **Display Name**: `Access Your Place`
3. **Deployment Target**: iOS 16.0+
4. **Team**: Select your Apple Developer team
5. **Signing**: Enable "Automatically manage signing"

### iOS Info.plist Additions

Add these to `ios/App/App/Info.plist`:

```xml
<!-- Camera Permission (if needed) -->
<key>NSCameraUsageDescription</key>
<string>Access Your Place needs camera access to upload property photos</string>

<!-- Photo Library Permission -->
<key>NSPhotoLibraryUsageDescription</key>
<string>Access Your Place needs photo library access to upload property images</string>

<!-- Location Permission (if needed) -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>Access Your Place uses your location to find nearby properties</string>

<!-- Push Notifications -->
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

### Running on iOS Simulator

```bash
npm run cap:run:ios
```

### Running on Physical Device

1. Connect your iPhone via USB
2. Trust the computer on your device
3. In Xcode, select your device as the build target
4. Click the Play button or press `Cmd + R`

### Live Reload During Development

```bash
npm run mobile:dev:ios
```

This enables hot-reload so changes appear instantly on the device.

---

## Android Deployment

### Opening in Android Studio

```bash
npm run cap:open:android
```

### Configure Android Project

1. **Package Name**: `com.accessyourplace.app`
2. **Min SDK**: API 24 (Android 7.0)
3. **Target SDK**: API 34 (Android 14)
4. **Compile SDK**: API 34

### Android Permissions

These are automatically added by Capacitor plugins. Verify in `android/app/src/main/AndroidManifest.xml`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

### Running on Android Emulator

```bash
npm run cap:run:android
```

### Running on Physical Device

1. Enable Developer Options on your Android device
2. Enable USB Debugging
3. Connect via USB
4. Select your device in Android Studio
5. Click Run

### Live Reload During Development

```bash
npm run mobile:dev:android
```

---

## App Icons & Splash Screens

### Required Assets

Create these source images in the project root:

```
assets/
├── icon-only.png          (1024x1024, app icon without background)
├── icon-foreground.png    (1024x1024, adaptive icon foreground)
├── icon-background.png    (1024x1024, adaptive icon background)
├── splash.png             (2732x2732, splash screen)
└── splash-dark.png        (2732x2732, dark mode splash screen)
```

### Generate All Sizes

```bash
npm run icons:generate
```

This uses `@capacitor/assets` to automatically generate all required icon sizes and splash screens for both iOS and Android.

### Manual Icon Sizes Needed

**iOS:**
- 20x20, 29x29, 40x40, 58x58, 60x60, 76x76, 80x80, 87x87, 120x120, 152x152, 167x167, 180x180, 1024x1024

**Android:**
- 48x48 (mdpi), 72x72 (hdpi), 96x96 (xhdpi), 144x144 (xxhdpi), 192x192 (xxxhdpi)

---

## Push Notifications Setup

### iOS (APNs)

1. **Apple Developer Portal** → Certificates, Identifiers & Profiles
2. Create an **APNs Key** (or Certificate):
   - Go to Keys → Create New Key
   - Enable "Apple Push Notifications service (APNs)"
   - Download the `.p8` file
3. Note your **Key ID** and **Team ID**
4. Configure your backend (Supabase Edge Function) with these credentials

### Android (FCM)

1. **Firebase Console** → Create/Select Project
2. Add Android app with package name `com.accessyourplace.app`
3. Download `google-services.json`
4. Place in `android/app/google-services.json`
5. Get your **Server Key** from Project Settings → Cloud Messaging
6. Configure your backend with the FCM server key

### In-App Registration

The app automatically handles push notification registration through `src/lib/capacitor.ts`:

```typescript
import { registerPushNotifications } from '@/lib/capacitor';

// Call this after user logs in
const token = await registerPushNotifications();
if (token) {
  // Send token to your backend to associate with user
  await savePushToken(token);
}
```

---

## Deep Linking / Universal Links

### iOS Universal Links

1. Create `apple-app-site-association` file on your web server:

```json
{
  "applinks": {
    "apps": [],
    "details": [
      {
        "appID": "TEAM_ID.com.accessyourplace.app",
        "paths": [
          "/deals/*",
          "/investor/*",
          "/blog/*",
          "/knowledge/*"
        ]
      }
    ]
  }
}
```

2. Host at `https://accessyourplace.com/.well-known/apple-app-site-association`
3. In Xcode → Signing & Capabilities → Add "Associated Domains"
4. Add: `applinks:accessyourplace.com`

### Android App Links

1. Create `assetlinks.json`:

```json
[{
  "relation": ["delegate_permission/common.handle_all_urls"],
  "target": {
    "namespace": "android_app",
    "package_name": "com.accessyourplace.app",
    "sha256_cert_fingerprints": ["YOUR_SHA256_FINGERPRINT"]
  }
}]
```

2. Host at `https://accessyourplace.com/.well-known/assetlinks.json`
3. Add intent filters in `AndroidManifest.xml`:

```xml
<intent-filter android:autoVerify="true">
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="https" android:host="accessyourplace.com" />
</intent-filter>
```

---

## OAuth Configuration for Native

### Google OAuth

For native apps, you need separate OAuth client IDs:

1. **Google Cloud Console** → APIs & Services → Credentials
2. Create OAuth 2.0 Client ID for:
   - **iOS**: Bundle ID `com.accessyourplace.app`
   - **Android**: Package name + SHA-1 fingerprint
3. Update your Supabase auth configuration with these client IDs

### Supabase Auth for Native

Update your Supabase client to handle native OAuth:

```typescript
// In your OAuth flow, use the native browser plugin
import { openExternalUrl } from '@/lib/capacitor';

// For OAuth, redirect through the native browser
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
  options: {
    redirectTo: 'com.accessyourplace.app://oauth/callback',
    skipBrowserRedirect: true,
  }
});

if (data?.url) {
  await openExternalUrl(data.url);
}
```

---

## App Store Submission

### Prepare for iOS App Store

1. **App Store Connect** (https://appstoreconnect.apple.com)
2. Create new app:
   - **Name**: Access Your Place
   - **Bundle ID**: com.accessyourplace.app
   - **SKU**: accessyourplace-app
   - **Primary Language**: English (U.S.)

3. **Required Information**:
   - App description (up to 4000 characters)
   - Keywords (up to 100 characters)
   - Support URL: https://accessyourplace.com/support
   - Marketing URL: https://accessyourplace.com
   - Privacy Policy URL: https://accessyourplace.com/privacy-policy

4. **Screenshots Required**:
   - 6.7" (iPhone 15 Pro Max): 1290 x 2796
   - 6.5" (iPhone 14 Plus): 1284 x 2778
   - 5.5" (iPhone 8 Plus): 1242 x 2208
   - iPad Pro 12.9" (if supporting iPad): 2048 x 2732

5. **Build & Upload**:
   ```bash
   # In Xcode: Product → Archive
   # Then: Distribute App → App Store Connect
   ```

6. **Submit for Review**
   - Review typically takes 24-48 hours
   - Ensure compliance with App Store Review Guidelines

### Common Rejection Reasons to Avoid
- Login required without guest access → Add "Browse as Guest" option
- Broken links or placeholder content
- Crashes or bugs
- Missing privacy policy
- In-app purchases not using Apple's payment system

---

## Google Play Submission

### Prepare for Google Play

1. **Google Play Console** (https://play.google.com/console)
2. Create new app:
   - **App name**: Access Your Place
   - **Default language**: English (United States)
   - **App or game**: App
   - **Free or paid**: Free

3. **Required Information**:
   - Short description (up to 80 characters)
   - Full description (up to 4000 characters)
   - App icon: 512 x 512 PNG
   - Feature graphic: 1024 x 500 PNG
   - Screenshots: minimum 2, up to 8 per device type
   - Privacy policy URL

4. **Build Signed APK/AAB**:
   ```bash
   # Generate signing key (one-time)
   keytool -genkey -v -keystore ayp-release.keystore \
     -alias ayp-key -keyalg RSA -keysize 2048 -validity 10000

   # Build release AAB in Android Studio
   # Build → Generate Signed Bundle/APK → Android App Bundle
   ```

5. **Upload to Play Console**:
   - Production → Create new release
   - Upload the `.aab` file
   - Add release notes
   - Review and roll out

---

## Development Workflow

### Daily Development

```bash
# 1. Start web dev server
npm run dev

# 2. Make changes in your React code

# 3. Test in browser first (fastest)

# 4. When ready to test on device:
npm run cap:sync
npm run cap:run:ios     # or cap:run:android

# 5. For live reload on device:
npm run mobile:dev:ios  # or mobile:dev:android
```

### Build Commands Reference

| Command | Description |
|---------|-------------|
| `npm run dev` | Start web dev server |
| `npm run build` | Build for production |
| `npm run cap:sync` | Build + sync to native |
| `npm run cap:open:ios` | Open iOS in Xcode |
| `npm run cap:open:android` | Open Android in Android Studio |
| `npm run cap:run:ios` | Build + run on iOS device/sim |
| `npm run cap:run:android` | Build + run on Android device/emu |
| `npm run mobile:dev:ios` | Live reload on iOS |
| `npm run mobile:dev:android` | Live reload on Android |
| `npm run cap:doctor` | Diagnose Capacitor issues |

### Platform-Specific Code

Use the utility functions and CSS classes to handle platform differences:

```typescript
// In React components
import { usePlatform } from '@/hooks/useCapacitor';

const MyComponent = () => {
  const { isNative, isIOS, isAndroid, isWeb } = usePlatform();
  
  return (
    <div>
      {isWeb && <p>Web-specific content</p>}
      {isNative && <p>Native-specific content</p>}
    </div>
  );
};
```

```html
<!-- In JSX, use CSS classes -->
<div className="web-only">Only visible on web</div>
<div className="native-only">Only visible on iOS/Android</div>
```

---

## Troubleshooting

### Common Issues

**1. "Capacitor could not find the web assets directory"**
```bash
npm run build  # Build first, then sync
npm run cap:sync
```

**2. iOS build fails with signing errors**
- Open Xcode → Signing & Capabilities
- Ensure your team is selected
- Enable "Automatically manage signing"

**3. Android build fails with Gradle errors**
```bash
cd android
./gradlew clean
cd ..
npm run cap:sync:android
```

**4. Plugins not working on web**
- Most Capacitor plugins gracefully degrade on web
- Check `isPluginAvailable()` before using native-only features

**5. White screen on native app**
```bash
# Ensure dist/ folder exists and has content
npm run build
ls dist/

# Re-sync
npm run cap:sync
```

**6. OAuth not working on native**
- Ensure redirect URLs include your app scheme: `com.accessyourplace.app://`
- Add the scheme to your Supabase allowed redirect URLs

### Debug on Device

**iOS:** Safari → Develop → [Your Device] → [Your App]
**Android:** Chrome → `chrome://inspect` → Select your device

### Check Capacitor Health

```bash
npx cap doctor
```

---

## Estimated Timeline

| Phase | Duration | Tasks |
|-------|----------|-------|
| Setup | 1-2 days | Install tools, add platforms, configure |
| Icons & Splash | 1 day | Design and generate all asset sizes |
| Testing | 3-5 days | Test on devices, fix platform issues |
| Push Notifications | 2-3 days | Configure APNs, FCM, backend |
| Deep Linking | 1-2 days | Universal Links, App Links |
| OAuth | 1-2 days | Native OAuth client IDs, redirect flows |
| App Store Prep | 2-3 days | Screenshots, descriptions, metadata |
| Submission | 1-3 weeks | Review process, fixes if rejected |
| **Total** | **3-6 weeks** | |

---

## Cost Summary

| Item | Cost |
|------|------|
| Apple Developer Account | $99/year |
| Google Play Developer Account | $25 (one-time) |
| Mac (if needed) | $1,000+ |
| Development Time | 80-120 hours |
| **Total** | **~$125 + hardware + time** |

---

## Files Modified/Created for Capacitor

| File | Purpose |
|------|---------|
| `capacitor.config.ts` | Capacitor configuration |
| `package.json` | Added Capacitor deps + scripts |
| `src/lib/capacitor.ts` | Platform utilities & native API wrappers |
| `src/hooks/useCapacitor.ts` | React hooks for native features |
| `src/components/NativeShell.tsx` | Safe area & platform wrapper |
| `src/main.tsx` | Capacitor initialization |
| `src/App.tsx` | Wrapped with NativeShell |
| `src/index.css` | Native CSS (safe areas, keyboard, etc.) |
| `index.html` | Updated viewport for native |
| `public/site.webmanifest` | PWA manifest |

---

*Last updated: February 14, 2026*
