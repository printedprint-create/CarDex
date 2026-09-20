import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cardex.app',
  appName: 'Cardex',
  webDir: 'dist/client',
  bundledWebRuntime: false,
  android: {
    allowMixedContent: false,
  },
  server: {
    // Keep this disabled for production APKs so the app uses its bundled web assets.
    cleartext: false,
  },
};

export default config;
