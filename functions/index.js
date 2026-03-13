const functions = require('firebase-functions');
const admin = require('firebase-admin');
const stripe = require('stripe');

admin.initializeApp();
const db = admin.firestore();

const PRICES = {
  monthly: 'price_1TAbb3HN43f29F77XeMwzMcc',
  annual: 'price_1TAbbnHN43f29F77DgrJEGIJ',
};

// Create a Stripe Checkout session
// Called from the frontend when coach clicks "Upgrade"
exports.createCheckoutSession = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Must be logged in');
  }

  const { plan } = data; // 'monthly' or 'annual'
  const priceId = PRICES[plan];
  if (!priceId) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid plan');
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret;
  const stripeClient = stripe(stripeKey);

  const uid = context.auth.uid;
  const email = context.auth.token.email || '';

  const session = await stripeClient.checkout.sessions.create({
    mode: 'subscription',
    payment_method_types: ['card'],
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${data.origin || 'https://lineupman.com'}/?upgraded=true`,
    cancel_url: `${data.origin || 'https://lineupman.com'}/?upgraded=false`,
    metadata: { firebaseUID: uid },
    subscription_data: { metadata: { firebaseUID: uid } },
  });

  return { sessionId: session.id, url: session.url };
});

// Stripe webhook — receives payment events
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
  const stripeKey = process.env.STRIPE_SECRET_KEY || functions.config().stripe?.secret;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || functions.config().stripe?.webhook_secret;
  const stripeClient = stripe(stripeKey);

  let event;

  if (webhookSecret) {
    const sig = req.headers['stripe-signature'];
    try {
      event = stripeClient.webhooks.constructEvent(req.rawBody, sig, webhookSecret);
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }
  } else {
    event = req.body;
  }

  // Handle checkout.session.completed — upgrade user to pro
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

  // Handle subscription deleted — downgrade user
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
