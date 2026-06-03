const { onCall } = require('firebase-functions/v2/https');
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const stripeSecretKey = defineSecret('STRIPE_SECRET_KEY');
const stripeWebhookSecret = defineSecret('STRIPE_WEBHOOK_SECRET');

// 'lifetime' is the only purchasable plan: one-time $1.99, mirrors the
// native IAP. monthly/annual are the legacy subscription prices, kept so
// existing subscribers keep renewing/cancelling normally.
const PRICES = {
  lifetime: 'price_1TeJNCHbpYF4shFM7giagikc',
  monthly: 'price_1TBZTMHbpYF4shFMitP14xYU',
  annual: 'price_1TBZTPHbpYF4shFMLKjmyU8E',
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
  if (!priceId) {
    throw new Error('Invalid plan');
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
    metadata: { firebaseUID: uid },
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
      const update = {
        plan: 'pro',
        stripeCustomerId: session.customer || null,
        upgradedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      if (session.mode === 'payment') {
        // One-time lifetime purchase — mirrors the native purchaseStore field.
        update.purchaseStore = 'stripe';
        update.stripePaymentIntentId = session.payment_intent || null;
      } else {
        update.stripeSubscriptionId = session.subscription;
      }
      await db.collection('users').doc(uid).update(update);
      console.log(`User ${uid} upgraded to pro (${session.mode})`);
    }
  }

  if (event.type === 'customer.subscription.deleted') {
    const subscription = event.data.object;
    const uid = subscription.metadata?.firebaseUID;
    if (uid) {
      // Legacy subscription lapsed. Don't downgrade users who own a
      // lifetime unlock (stripe/apple/google) — purchaseStore marks those.
      const snap = await db.collection('users').doc(uid).get();
      if (snap.exists && snap.data().purchaseStore) {
        console.log(`User ${uid} subscription ended but owns lifetime — keeping pro`);
      } else {
        await db.collection('users').doc(uid).update({
          plan: 'free',
          downgradedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`User ${uid} downgraded to free`);
      }
    }
  }

  res.status(200).json({ received: true });
});
