// RevenueCat payment service for Dugout IQ
//
// On native (iOS/Android): uses RevenueCat to manage Apple IAP / Google Play Billing
// On web: falls back to existing Stripe Checkout flow
//
// RevenueCat API keys and entitlement IDs are configured here.
// These will need to be updated once you create the RevenueCat project.

import { isNative } from './platform';

// ── CONFIGURATION (update these after RevenueCat setup) ──
const REVENUECAT_IOS_KEY = 'YOUR_REVENUECAT_IOS_API_KEY';
const REVENUECAT_ANDROID_KEY = 'YOUR_REVENUECAT_ANDROID_API_KEY';
const ENTITLEMENT_ID = 'pro'; // The entitlement identifier in RevenueCat

let Purchases = null;
let LOG_LEVEL = null;
let initialized = false;

// Lazy-load RevenueCat SDK only on native
async function getPurchases() {
  if (Purchases) return Purchases;
  if (!isNative()) return null;
  try {
    const mod = await import('@revenuecat/purchases-capacitor');
    Purchases = mod.Purchases;
    LOG_LEVEL = mod.LOG_LEVEL;
    return Purchases;
  } catch {
    console.warn('RevenueCat SDK not available');
    return null;
  }
}

/**
 * Initialize RevenueCat. Call once after user logs in.
 * @param {string} userId - Firebase user UID (used as RevenueCat app user ID)
 */
export async function initRevenueCat(userId) {
  const purchases = await getPurchases();
  if (!purchases || initialized) return;

  try {
    const { Capacitor } = await import('@capacitor/core');
    const platform = Capacitor.getPlatform();
    const apiKey = platform === 'ios' ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;

    await purchases.setLogLevel({ level: LOG_LEVEL.DEBUG });
    await purchases.configure({
      apiKey,
      appUserID: userId,
    });
    initialized = true;
    console.log('RevenueCat initialized for', platform);
  } catch (err) {
    console.error('RevenueCat init error:', err);
  }
}

/**
 * Check if user has active Pro entitlement via RevenueCat.
 * @returns {Promise<boolean>} true if user has active pro subscription
 */
export async function checkProEntitlement() {
  const purchases = await getPurchases();
  if (!purchases || !initialized) return false;

  try {
    const { customerInfo } = await purchases.getCustomerInfo();
    const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
    return !!entitlement;
  } catch (err) {
    console.error('RevenueCat entitlement check error:', err);
    return false;
  }
}

/**
 * Get available subscription packages from RevenueCat.
 * @returns {Promise<Array>} available packages (seasonal, annual, etc.)
 */
export async function getOfferings() {
  const purchases = await getPurchases();
  if (!purchases || !initialized) return [];

  try {
    const { offerings } = await purchases.getOfferings();
    if (offerings.current) {
      return offerings.current.availablePackages;
    }
    return [];
  } catch (err) {
    console.error('RevenueCat offerings error:', err);
    return [];
  }
}

/**
 * Purchase a subscription package via native IAP.
 * @param {Object} pkg - A RevenueCat package object from getOfferings()
 * @returns {Promise<{success: boolean, customerInfo?: Object, error?: string}>}
 */
export async function purchasePackage(pkg) {
  const purchases = await getPurchases();
  if (!purchases || !initialized) {
    return { success: false, error: 'RevenueCat not initialized' };
  }

  try {
    const { customerInfo } = await purchases.purchasePackage({ aPackage: pkg });
    const isPro = !!customerInfo.entitlements.active[ENTITLEMENT_ID];
    return { success: isPro, customerInfo };
  } catch (err) {
    // User cancelled purchase
    if (err?.code === 'PURCHASE_CANCELLED_ERROR' || err?.userCancelled) {
      return { success: false, error: 'cancelled' };
    }
    console.error('RevenueCat purchase error:', err);
    return { success: false, error: err?.message || 'Purchase failed' };
  }
}

/**
 * Restore previous purchases (e.g., user reinstalled the app).
 * @returns {Promise<boolean>} true if pro entitlement was restored
 */
export async function restorePurchases() {
  const purchases = await getPurchases();
  if (!purchases || !initialized) return false;

  try {
    const { customerInfo } = await purchases.restorePurchases();
    return !!customerInfo.entitlements.active[ENTITLEMENT_ID];
  } catch (err) {
    console.error('RevenueCat restore error:', err);
    return false;
  }
}

/**
 * Log out from RevenueCat. Call when user signs out.
 */
export async function logoutRevenueCat() {
  const purchases = await getPurchases();
  if (!purchases || !initialized) return;

  try {
    await purchases.logOut();
    initialized = false;
  } catch {}
}
