const { onCall } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const stripe = require('stripe');
const { google } = require('googleapis');

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');
const googlePlayServiceAccount = defineSecret('GOOGLE_PLAY_SERVICE_ACCOUNT');

const ANDROID_PACKAGE_NAME = 'com.dugoutiq.app';

// Stripe price IDs — create these in the Stripe Dashboard and paste their IDs here.
// season  = $1.99 / 3 months recurring subscription
// lifetime = $5.99 one-time payment
const PRICES = {
  season: 'REPLACE_WITH_NEW_SEASON_PRICE_ID',
  lifetime: 'REPLACE_WITH_NEW_LIFETIME_PRICE_ID',
};

// Create a Stripe Checkout session
exports.createCheckoutSession = onCall({
  secrets: [stripeSecretKey],
  invoker: 'public',
}, async (request) => {
  if (!request.auth) {
    throw new Error('Must be logged in');
  }

  const { plan, origin } = request.data;
  const priceId = PRICES[plan];
  if (!priceId || priceId.startsWith('REPLACE_WITH')) {
    throw new Error('Invalid or unconfigured plan');
  }

  const stripeClient = stripe(stripeSecretKey.value());
  const uid = request.auth.uid;
  const email = request.auth.token.email || '';

  const isLifetime = plan === 'lifetime';

  const session = await stripeClient.checkout.sessions.create({
    mode: isLifetime ? 'payment' : 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${origin || 'https://lineupman.com'}/?upgraded=true`,
    cancel_url: `${origin || 'https://lineupman.com'}/?upgraded=false`,
    metadata: { firebaseUID: uid, plan },
    ...(isLifetime ? {} : { subscription_data: { metadata: { firebaseUID: uid } } }),
  });

  return { sessionId: session.id, url: session.url };
});

// Stripe webhook
exports.stripeWebhook = onRequest({ secrets: [stripeSecretKey, stripeWebhookSecret] }, async (req, res) => {
  const stripeClient = stripe(stripeSecretKey.value());

  let event;

  try {
    const sig = req.headers['stripe-signature'];
    const secret = stripeWebhookSecret.value();
    if (secret) {
      event = stripeClient.webhooks.constructEvent(req.rawBody, sig, secret);
    } else {
      event = req.body;
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const uid = session.metadata?.firebaseUID;
    if (uid) {
      await db.collection('users').doc(uid).update({
        plan: 'pro',
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`User ${uid} upgraded to pro`);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const uid = subscription.metadata?.firebaseUID;
    if (uid) {
      await db.collection('users').doc(uid).update({
        plan: 'free',
        downgradedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log(`User ${uid} downgraded to free`);
    }
  }

  res.status(200).json({ received: true });
});

// Validate a Google Play in-app purchase and mark the user as Pro
exports.validateGooglePurchase = onCall({
  secrets: [googlePlayServiceAccount],
}, async (request) => {
  if (!request.auth) throw new Error('Must be logged in');
  const uid = request.auth.uid;
  const { purchaseToken, productId } = request.data || {};
  if (!purchaseToken || !productId) {
    return { success: false, error: 'purchaseToken and productId required' };
  }

  let serviceAccount;
  try {
    serviceAccount = JSON.parse(googlePlayServiceAccount.value());
  } catch {
    return { success: false, error: 'Invalid service account configuration' };
  }

  const jwt = new google.auth.JWT(
    serviceAccount.client_email,
    null,
    serviceAccount.private_key,
    ['https://www.googleapis.com/auth/androidpublisher']
  );
  const androidpublisher = google.androidpublisher({ version: 'v3', auth: jwt });

  try {
    const { data } = await androidpublisher.purchases.products.get({
      packageName: ANDROID_PACKAGE_NAME,
      productId,
      token: purchaseToken,
    });

    // purchaseState: 0 = Purchased, 1 = Canceled, 2 = Pending
    if (data.purchaseState !== 0) {
      return { success: false, error: `Purchase state ${data.purchaseState} — not completed` };
    }

    await db.collection('users').doc(uid).update({
      plan: 'pro',
      googlePurchaseToken: purchaseToken,
      googleProductId: productId,
      googleOrderId: data.orderId || null,
      upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Acknowledge within 3 days or Google auto-refunds the purchase
    if (data.acknowledgementState === 0) {
      await androidpublisher.purchases.products.acknowledge({
        packageName: ANDROID_PACKAGE_NAME,
        productId,
        token: purchaseToken,
      });
    }

    console.log(`User ${uid} upgraded to pro via Google Play (order ${data.orderId})`);
    return { success: true };
  } catch (err) {
    console.error('validateGooglePurchase error:', err);
    return { success: false, error: err?.message || 'Validation failed' };
  }
});
