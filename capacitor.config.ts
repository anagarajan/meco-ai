import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.mecoai.app',
  appName: 'MeCo AI',
  webDir: 'dist',
  ios: {
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'MeCo AI',
  },
  server: {
    // Allow inline media playback (needed for voice recording UI)
    iosScheme: 'capacitor',
  },
  plugins: {
    // App plugin handles appStateChange (clipboard detection) and appUrlOpen (deep links)
    App: {},
    // Browser plugin opens provider key pages in an in-app sheet
    Browser: {},
    // Clipboard plugin reads copied API keys on app resume
    Clipboard: {},
  },
};

export default config;
