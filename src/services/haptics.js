/**
 * Haptic feedback service for Dugout IQ
 * 
 * Provides tactile feedback on native platforms (iOS/Android).
 * Silently does nothing on web — safe to call anywhere.
 * 
 * Usage:
 *   import { hapticSuccess, hapticLight, hapticError } from '../services/haptics';
 *   hapticSuccess();  // call after a hit
 *   hapticLight();    // call after recording an out
 */

import { isNative } from './platform';

let Haptics = null;
let ImpactStyle = null;
let NotificationType = null;

// Lazy-load the Capacitor Haptics plugin only on native
async function getHaptics() {
  if (Haptics) return Haptics;
  if (!isNative()) return null;
  try {
    const mod = await import('@capacitor/haptics');
    Haptics = mod.Haptics;
    ImpactStyle = mod.ImpactStyle;
    NotificationType = mod.NotificationType;
    return Haptics;
  } catch {
    return null;
  }
}

/** Strong success vibration — use for hits, walks, HBP (on-base results) */
export async function hapticSuccess() {
  const h = await getHaptics();
  if (h) {
    try { await h.notification({ type: NotificationType.Success }); } catch {}
  }
}

/** Light tap — use for outs, strikeouts */
export async function hapticLight() {
  const h = await getHaptics();
  if (h) {
    try { await h.impact({ style: ImpactStyle.Light }); } catch {}
  }
}

/** Medium tap — use for general button presses */
export async function hapticMedium() {
  const h = await getHaptics();
  if (h) {
    try { await h.impact({ style: ImpactStyle.Medium }); } catch {}
  }
}

/** Error vibration — use for errors or limit reached */
export async function hapticError() {
  const h = await getHaptics();
  if (h) {
    try { await h.notification({ type: NotificationType.Error }); } catch {}
  }
}

/** Heavy tap — use for committing a game */
export async function hapticHeavy() {
  const h = await getHaptics();
  if (h) {
    try { await h.impact({ style: ImpactStyle.Heavy }); } catch {}
  }
}
