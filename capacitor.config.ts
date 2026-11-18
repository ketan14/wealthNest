import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.wealthnest.app',
  appName: 'WealthNest',
  webDir: 'apps/web/dist',
  bundledWebRuntime: false,
  server: {
    // Android WebViews will load assets locally from apps/web/dist
    androidScheme: 'https',
    cleartext: false,
  },
  plugins: {
    // Secure Keystore & App Links configurations
  },
};

export default config;
