import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// Native-only packages that aren't installed for web builds.
// These are dynamically imported and guarded by isNative() checks,
// so they never actually load on web. We tell Vite to ignore them.
const nativeExternals = [
  '@revenuecat/purchases-capacitor',
  'capacitor-native-biometric',
];

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/',
  build: {
    rollupOptions: {
      // Don't fail on unresolved native-only imports
      onwarn(warning, warn) {
        if (warning.code === 'UNRESOLVED_IMPORT' &&
            nativeExternals.some(ext => warning.message?.includes(ext))) {
          return; // suppress
        }
        warn(warning);
      },
      external: (id) => nativeExternals.some(ext => id === ext),
    },
  },
})
