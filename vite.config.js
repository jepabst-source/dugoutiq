import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const nativeExternals = [
  '@capacitor/core',
  '@capacitor/haptics',
  '@capacitor/share',
  '@capacitor/app',
  '@capacitor/status-bar',
  '@capacitor/splash-screen',
  '@capacitor/push-notifications',
  '@capacitor/local-notifications',
  '@revenuecat/purchases-capacitor',
  'capacitor-native-biometric',
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'UNRESOLVED_IMPORT' &&
            nativeExternals.some(ext => warning.message?.includes(ext))) {
          return;
        }
        warn(warning);
      },
      external: (id) => nativeExternals.some(ext => id === ext),
    },
  },
})
