// Dynamic Expo config — reads secrets from environment variables.
// Values in .env are read at build time (NOT at runtime) by the Expo CLI.
//
// Usage:
//   1. Copy .env.example → .env and fill in real values.
//   2. All constants are exposed via Constants.expoConfig.extra in the app.
//   3. Import them through config/constants.ts — never read process.env directly
//      inside React Native code.

const IS_DEV = process.env.APP_VARIANT === 'development';

module.exports = ({ config }) => ({
  ...config,
  name: IS_DEV ? 'trace+ (Dev)' : 'trace+',
  slug: 'gimi-mobile',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/images/icon.png',
  scheme: 'gimimobile',
  userInterfaceStyle: 'automatic',
  newArchEnabled: true,
  splash: {
    image: './assets/images/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#0a0f1d',
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: 'com.traceplus.fleet',
  },
  android: {
    package: 'com.saudiex.gimimobile.v2',
    adaptiveIcon: {
      foregroundImage: './assets/images/adaptive-icon.png',
      backgroundColor: '#0a0f1d',
    },
    edgeToEdgeEnabled: true,
    predictiveBackGestureEnabled: false,
  },
  web: {
    bundler: 'metro',
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-secure-store',
    'expo-web-browser',
    [
      'expo-notifications',
      {
        icon: './assets/images/notification-icon.png',
        color: '#00d4aa',
        defaultChannel: 'fleet-alerts',
      },
    ],
    'expo-task-manager',
  ],
  experiments: {
    typedRoutes: true,
  },
  // All secrets are injected at build time from environment variables.
  // They are accessible via Constants.expoConfig.extra inside the app.
  extra: {
    appKey:       process.env.EXPO_PUBLIC_APP_KEY      || '',
    appSecret:    process.env.EXPO_PUBLIC_APP_SECRET   || '',
    tagAppKey:    process.env.EXPO_PUBLIC_TAG_APP_KEY  || '',
    shareSecret:  process.env.EXPO_PUBLIC_SHARE_SECRET || '',
  },
});
