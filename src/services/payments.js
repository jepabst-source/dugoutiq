// Google Play Billing via cordova-plugin-purchase (CdvPurchase).
//
// v1 model: client-trust. When the plugin reports an approved purchase,
// we mark the user as Pro in Firestore directly — no server-side receipt
// validation. Acceptable for a $1.99 one-time lifetime unlock; abuse risk
// is minimal relative to the engineering cost of proper validation.
//
// Web is a no-op: loadPlugin returns null off native, so initPurchases,
// getLifetimeProduct, purchaseLifetime, and restorePurchases all safely
// early-return without touching the CdvPurchase globals.

import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { isNative, isIOS } from './platform';

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

async function markProInFirestore(purchaseToken, productId) {
  const user = auth.currentUser;
  if (!user) return;
  const tokenField = isIOS() ? 'applePurchaseToken' : 'googlePurchaseToken';
  const productField = isIOS() ? 'appleProductId' : 'googleProductId';
  await updateDoc(doc(db, 'users', user.uid), {
    plan: 'pro',
    [tokenField]: purchaseToken || null,
    [productField]: productId || PRODUCT_ID,
    purchaseStore: isIOS() ? 'apple' : 'google',
    upgradedAt: serverTimestamp(),
  });
}

export async function initPurchases() {
  if (initialized) return;
  const cdv = await loadPlugin();
  if (!cdv) return;

  const { Platform, ProductType, LogLevel } = cdv;
  store = cdv.store;
  store.verbosity = LogLevel.ERROR;

  const platform = isIOS() ? Platform.APPLE_APPSTORE : Platform.GOOGLE_PLAY;
  store.register([{
    id: PRODUCT_ID,
    type: ProductType.NON_CONSUMABLE,
    platform,
  }]);

  store.when()
    .approved(async (transaction) => {
      try {
        const token = transaction.nativePurchase?.purchaseToken || transaction.purchaseId || null;
        const productId = transaction.products?.[0]?.id || PRODUCT_ID;
        await markProInFirestore(token, productId);
        await transaction.finish();
        pendingPurchaseResolver?.({ success: true });
      } catch (err) {
        console.error('Approved-handler error:', err);
        pendingPurchaseResolver?.({ success: false, error: err?.message || 'Upgrade failed' });
      } finally {
        pendingPurchaseResolver = null;
      }
    });

  try {
    await store.initialize([platform]);
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
  return {
    priceString: offer?.pricingPhases?.[0]?.price || '$1.99',
    title: product.title,
    description: product.description,
    owned: product.owned,
  };
}

/**
 * Trigger the Google Play Billing purchase sheet.
 * Resolves when the purchase is approved+acknowledged, user cancels, or an error occurs.
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
 * Restore prior purchases for the signed-in Google account.
 * Useful after reinstall or sign-in on a new device.
 */
export async function restorePurchases() {
  if (!store) return { success: false };
  try {
    await store.restorePurchases();
    const product = store.get(PRODUCT_ID);
    if (product?.owned) {
      const tx = product.transactions?.[0];
      const token = tx?.nativePurchase?.purchaseToken;
      await markProInFirestore(token, PRODUCT_ID);
      return { success: true };
    }
    return { success: false };
  } catch (err) {
    console.error('Restore error:', err);
    return { success: false, error: err?.message };
  }
}
