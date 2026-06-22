import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// IMPORTANT: only list packages that are genuinely NOT installed here.
// Anything in this list is left as a bare `import` in the output bundle, which
// the iOS/Android WebView cannot resolve at runtime ("Module name '…' does not
// resolve to a valid URL"). The installed Capacitor packages (core, haptics,
// share, app, status-bar, splash-screen, revenuecat) MUST be bundled — leaving
// @capacitor/core external is what broke Apple Sign In (the apple-sign-in plugin
// imports it internally) and caused the 2.1(a) login-error rejection of build 9.
//
// The three below are optional features whose dynamic imports are wrapped in
// try/catch (see notifications.js / biometric.js), so they fail silently when
// the package isn't present. Install them + re-run `cap sync` if/when we want
// push notifications or Face ID, then remove from this list.
const nativeExternals = [
  '@capacitor/push-notifications',
  '@capacitor/local-notifications',
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
      output: {
        manualChunks: {
          firebase: ['firebase/app', 'firebase/auth', 'firebase/firestore', 'firebase/analytics'],
        },
      },
    },
  },
})
