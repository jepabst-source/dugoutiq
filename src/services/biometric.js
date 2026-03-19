// Biometric authentication service for Dugout IQ
//
// On native: Uses device biometrics (Face ID / Touch ID / Fingerprint) to
// allow returning coaches to skip the full login flow.
//
// How it works:
// 1. After first successful login, we store a flag in localStorage
// 2. On next app launch, if biometric is available, we prompt for it
// 3. If biometric succeeds, Firebase Auth's persistence handles the actual session
// 4. If biometric fails or isn't available, fall through to normal login
//
// This doesn't replace Firebase Auth — it gates access to the already-persisted session.

import { isNative } from './platform';

let NativeBiometric = null;

async function getBiometric() {
  if (NativeBiometric) return NativeBiometric;
  if (!isNative()) return null;
  try {
    // capacitor-native-biometric is a community plugin
    // Install: npm install capacitor-native-biometric
    const mod = await import('capacitor-native-biometric');
    NativeBiometric = mod.NativeBiometric;
    return NativeBiometric;
  } catch {
    return null;
  }
}

/**
 * Check if biometric authentication is available on this device.
 * @returns {Promise<boolean>}
 */
export async function isBiometricAvailable() {
  const bio = await getBiometric();
  if (!bio) return false;

  try {
    const result = await bio.isAvailable();
    return result.isAvailable;
  } catch {
    return false;
  }
}

/**
 * Prompt the user for biometric authentication.
 * @returns {Promise<boolean>} true if authentication succeeded
 */
export async function authenticateWithBiometric() {
  const bio = await getBiometric();
  if (!bio) return false;

  try {
    await bio.verifyIdentity({
      reason: 'Unlock Dugout IQ',
      title: 'Dugout IQ',
      subtitle: 'Use Face ID or Touch ID to open your dugout',
      description: '',
    });
    return true;
  } catch {
    // User cancelled or biometric failed
    return false;
  }
}

/**
 * Mark that biometric login should be offered on next launch.
 * Call after a successful Google/email login.
 */
export function enableBiometricLogin() {
  if (isNative()) {
    localStorage.setItem('dugoutiq_biometric_enabled', 'true');
  }
}

/**
 * Check if the user has opted into biometric login.
 */
export function isBiometricEnabled() {
  return isNative() && localStorage.getItem('dugoutiq_biometric_enabled') === 'true';
}

/**
 * Disable biometric login (e.g., on logout).
 */
export function disableBiometricLogin() {
  localStorage.removeItem('dugoutiq_biometric_enabled');
}
