import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.accessyourplace.app',
  appName: 'Access Your Place',
  webDir: 'dist',
  
  // Server configuration
  server: {
    // For development, uncomment the following to use live reload:
    // url: 'http://YOUR_LOCAL_IP:8080',
    // cleartext: true,
    
    // Allow navigation to external URLs
    allowNavigation: [
      'accessyourplace.com',
      '*.accessyourplace.com',
      'zhobqrmkbtsqugtiahyn.databasepad.com',
      '*.supabase.co',
      '*.stripe.com',
      'accounts.google.com',
      '*.googleapis.com',
    ],
    
    // iOS specific
    iosScheme: 'capacitor',
    
    // Android specific  
    androidScheme: 'https',
  },

  // Plugin configurations
  plugins: {
    // Splash Screen
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      launchFadeOutDuration: 500,
      backgroundColor: '#1a365d',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: true,
      spinnerStyle: 'large',
      spinnerColor: '#d4a574',
      splashFullScreen: true,
      splashImmersive: true,
    },

    // Status Bar
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#1a365d',
      overlaysWebView: false,
    },

    // Push Notifications - FCM for both iOS and Android
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
      // iOS: Uses APNs through FCM
      // Android: Uses FCM directly
    },

    // Keyboard
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },

    // Local Notifications - with notification channels for Android
    LocalNotifications: {
      smallIcon: 'ic_notification',
      iconColor: '#d4a574',
      sound: 'default',
      // Android notification channels
      channels: [
        {
          id: 'deal_alerts',
          name: 'Deal Alerts',
          description: 'New property deals matching your criteria',
          importance: 5, // IMPORTANCE_HIGH
          visibility: 1, // VISIBILITY_PUBLIC
          sound: 'deal_alert',
          vibration: true,
          lights: true,
          lightColor: '#d4a574',
        },
        {
          id: 'documents',
          name: 'Document Updates',
          description: 'Updates to your documents and contracts',
          importance: 4, // IMPORTANCE_DEFAULT
          visibility: 1,
          sound: 'default',
          vibration: true,
        },
        {
          id: 'acquisitions',
          name: 'Acquisition Milestones',
          description: 'Progress updates on your acquisitions',
          importance: 5,
          visibility: 1,
          sound: 'milestone',
          vibration: true,
          lights: true,
          lightColor: '#22c55e',
        },
        {
          id: 'messages',
          name: 'Messages',
          description: 'New messages from your team',
          importance: 4,
          visibility: 1,
          sound: 'message',
          vibration: true,
        },
        {
          id: 'general',
          name: 'General Notifications',
          description: 'Platform updates and announcements',
          importance: 3, // IMPORTANCE_DEFAULT
          visibility: 1,
          sound: 'default',
        },
      ],
    },

    // App - Deep linking configuration
    App: {
      // iOS Universal Links and Android App Links are configured
      // via apple-app-site-association and assetlinks.json files
    },

    // Browser - External links
    Browser: {
      // Will use SFSafariViewController on iOS, Chrome Custom Tabs on Android
    },

    // Network
    Network: {
      // No additional config needed
    },
  },

  // iOS specific configuration
  ios: {
    contentInset: 'automatic',
    allowsLinkPreview: true,
    scrollEnabled: true,
    backgroundColor: '#1a365d',
    preferredContentMode: 'mobile',
    // Custom URL scheme for deep linking
    scheme: 'accessyourplace',
    // WebView configuration
    webContentsDebuggingEnabled: false, // Set to true for development
    // Handle associated domains for Universal Links
    // Add in Xcode: applinks:accessyourplace.com
  },

  // Android specific configuration
  android: {
    backgroundColor: '#1a365d',
    allowMixedContent: false,
    captureInput: true,
    webContentsDebuggingEnabled: false, // Set to true for development
    // Custom URL scheme for deep linking
    // Intent filters configured in AndroidManifest.xml
    // Build type
    buildOptions: {
      keystorePath: undefined,
      keystorePassword: undefined,
      keystoreAlias: undefined,
      keystoreAliasPassword: undefined,
      signingType: 'apksigner',
    },
  },
};

export default config;
