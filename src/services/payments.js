// Google Play Billing via cordova-plugin-purchase (CdvPurchase).
//
// Flow:
//   1. initPurchases() — register product + event handlers once after login.
//   2. User taps Unlock → purchaseLifetime() opens the Play Billing sheet.
//   3. "approved" event fires → we call our Firebase Cloud Function
//      (validateGooglePurchase) with the purchase token.
//   4. Function validates against Google Play Developer API server-side
//      and writes plan:'pro' to users/{uid}.
//   5. We finish() the transaction (Google requires ack within 3 days).
//   6. Promise returned by purchaseLifetime() resolves with { success: true }.
//
// iOS support would follow the same pattern, additionally registering for
// Platform.APPLE_APPSTORE and using Apple receipt validation server-side.

import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../lib/firebase';
import { isNative } from './platform';

const PRODUCT_ID = 'dugoutiq_pro_lifetime';

let store = null;
let initialized = false;
let pendingPurchaseResolver = null;

function getCdvStore() {
  if (typeof window === 'undefined') return null;
  return window.CdvPurchase?.store || null;
}

async function loadPlugin() {
  if (!isNative()) return null;
  if (getCdvStore()) return window.CdvPurchase;
  try {
    await import('cordova-plugin-purchase');
  } catch (err) {
    console.warn('CdvPurchase import failed:', err);
  }
  return window.CdvPurchase || null;
}

async function validateWithServer(purchaseToken) {
  const functions = getFunctions(app);
  const validate = httpsCallable(functions, 'validateGooglePurchase');
  const result = await validate({ purchaseToken, productId: PRODUCT_ID });
  if (!result.data?.success) {
    throw new Error(result.data?.error || 'Server validation failed');
  }
  return result.data;
}

export async function initPurchases() {
  if (initialized) return;
  const cdv = await loadPlugin();
  if (!cdv) return;

  const { Platform, ProductType, LogLevel } = cdv;
  store = cdv.store;
  store.verbosity = LogLevel.ERROR;

  store.register([{
    id: PRODUCT_ID,
    type: ProductType.NON_CONSUMABLE,
    platform: Platform.GOOGLE_PLAY,
  }]);

  store.when()
    .approved(async (transaction) => {
      try {
        const token = transaction.nativePurchase?.purchaseToken || transaction.purchaseId;
        await validateWithServer(token);
        await transaction.finish();
        pendingPurchaseResolver?.({ success: true });
      } catch (err) {
        console.error('Purchase approval error:', err);
        pendingPurchaseResolver?.({ success: false, error: err?.message || 'Validation failed' });
      } finally {
        pendingPurchaseResolver = null;
      }
    });

  try {
    await store.initialize([Platform.GOOGLE_PLAY]);
    initialized = true;
  } catch (err) {
    console.error('Store initialize error:', err);
  }
}

export function getLifetimeProduct() {
  if (!store) return null;
  const product = store.get(PRODUCT_ID);
  if (!product) return null;
  const offer = product.getOffer();
  const priceString = offer?.pricingPhases?.[0]?.price || '$5.99';
  return { priceString, title: product.title, description: product.description, owned: product.owned };
}

/**
 * Initiate the Play Billing purchase flow.
 * Resolves when: (a) server validation succeeds, (b) user cancels, or (c) an error occurs.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function purchaseLifetime() {
  if (!store) return { success: false, error: 'Store not initialized' };
  const product = store.get(PRODUCT_ID);
  if (!product) return { success: false, error: 'Product not found' };
  const offer = product.getOffer();
  if (!offer) return { success: false, error: 'No offer available' };

  return new Promise((resolve) => {
    pendingPurchaseResolver = resolve;
    store.order(offer).catch((err) => {
      if (pendingPurchaseResolver) {
        pendingPurchaseResolver({ success: false, error: err?.message || 'Order failed' });
        pendingPurchaseResolver = null;
      }
    });
  });
}

/**
 * Restore prior purchases for this Google account.
 * Useful after reinstall or sign-in on a new device.
 */
export async function restorePurchases() {
  if (!store) return { success: false };
  try {
    await store.restorePurchases();
    const product = store.get(PRODUCT_ID);
    if (product?.owned) {
      // Owned but not yet reflected server-side — replay validation.
      const tx = product.transactions?.[0];
      const token = tx?.nativePurchase?.purchaseToken;
      if (token) {
        await validateWithServer(token);
        return { success: true };
      }
    }
    return { success: false };
  } catch (err) {
    console.error('Restore error:', err);
    return { success: false, error: err?.message };
  }
}
