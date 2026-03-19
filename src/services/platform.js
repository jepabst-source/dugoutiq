// Platform detection for Dugout IQ
// Detects whether the app is running as native iOS, native Android, or web browser.
//
// Usage:
//   import { isNative, isIOS, isAndroid, isWeb } from '../services/platform';
//   if (isNative()) { ... use native APIs ... }

import { Capacitor } from '@capacitor/core';

/** True when running inside a Capacitor native shell (iOS or Android) */
export const isNative = () => Capacitor.isNativePlatform();

/** True when running on iOS (native only) */
export const isIOS = () => Capacitor.getPlatform() === 'ios';

/** True when running on Android (native only) */
export const isAndroid = () => Capacitor.getPlatform() === 'android';

/** True when running in a web browser (not native) */
export const isWeb = () => Capacitor.getPlatform() === 'web';

/** Returns 'ios' | 'android' | 'web' */
export const getPlatform = () => Capacitor.getPlatform();
