import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.myvision.studio',
  appName: 'My Vision',
  webDir: 'dist',
  android: {
    backgroundColor: '#0A0A0A',
    allowMixedContent: false,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: '#0A0A0A',
      androidSplashResourceName: 'splash',
      androidScaleType: 'CENTER_CROP',
      showSpinner: false,
    },
    StatusBar: {
      style: 'LIGHT',
      backgroundColor: '#0A0A0A',
      overlaysWebView: false,
    },
  },
};

export default config;
