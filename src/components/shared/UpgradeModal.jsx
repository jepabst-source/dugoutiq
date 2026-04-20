import { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../lib/firebase';
import { useAuth } from '../../contexts/AuthContext';
import { isNative } from '../../services/platform';
import { getLifetimeProduct, purchaseLifetime, restorePurchases } from '../../services/payments';
import { useToast } from './Toast';

export default function UpgradeModal({ onClose, lockReason }) {
  const native = isNative();
  return native
    ? <NativeUpgrade onClose={onClose} lockReason={lockReason} />
    : <WebUpgrade onClose={onClose} lockReason={lockReason} />;
}

// ── WEB: Stripe Checkout via Firebase Cloud Function ──
function WebUpgrade({ onClose, lockReason }) {
  const [loading, setLoading] = useState('');
  const toast = useToast();

  const handleUpgrade = async (plan) => {
    setLoading(plan);
    try {
      const functions = getFunctions(app);
      const createCheckoutSession = httpsCallable(functions, 'createCheckoutSession');
      const result = await createCheckoutSession({ plan, origin: window.location.origin });
      if (result.data?.url) {
        window.location.href = result.data.url;
      }
    } catch (err) {
      console.error('Checkout error:', err);
      toast('Something went wrong. Please try again.', 'error');
    }
    setLoading('');
  };

  return (
    <Shell onClose={onClose} lockReason={lockReason}>
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">1 Season</div>
          <div className="text-2xl font-bold text-gray-800">$1.99</div>
          <div className="text-[10px] text-gray-400">3 months</div>
          <button
            onClick={() => handleUpgrade('season')}
            disabled={!!loading}
            className="w-full mt-3 py-2 rounded-lg bg-gray-200 text-gray-700 font-bold text-xs
                       hover:bg-gray-300 active:scale-[0.97] transition-all disabled:opacity-50">
            {loading === 'season' ? 'Loading...' : 'Choose Season'}
          </button>
        </div>

        <div className="bg-sky/5 border-2 border-sky rounded-xl p-4 relative">
          <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-sky text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
            Best Value
          </div>
          <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Lifetime</div>
          <div className="text-2xl font-bold text-sky">$5.99</div>
          <div className="text-[10px] text-gray-400">One-time</div>
          <button
            onClick={() => handleUpgrade('lifetime')}
            disabled={!!loading}
            className="w-full mt-3 py-2 rounded-lg bg-sky text-white font-bold text-xs
                       hover:bg-sky-dim active:scale-[0.97] transition-all disabled:opacity-50">
            {loading === 'lifetime' ? 'Loading...' : 'Choose Lifetime'}
          </button>
        </div>
      </div>
      <button onClick={onClose}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
        Maybe later
      </button>
    </Shell>
  );
}

// ── NATIVE (Android): Google Play Billing via CdvPurchase + server-side validation ──
function NativeUpgrade({ onClose, lockReason }) {
  const { refreshUserDoc } = useAuth();
  const [product, setProduct] = useState(null);
  const [busy, setBusy] = useState('');
  const toast = useToast();

  useEffect(() => {
    // Poll briefly for the product to load (store init happens in AuthContext).
    let attempts = 0;
    const tick = () => {
      const p = getLifetimeProduct();
      if (p) { setProduct(p); return; }
      if (attempts++ < 20) setTimeout(tick, 250);
    };
    tick();
  }, []);

  const handleBuy = async () => {
    setBusy('buy');
    const result = await purchaseLifetime();
    if (result.success) {
      await refreshUserDoc();
      toast('You\'re Pro! Enjoy.', 'success');
      onClose();
    } else if (result.error === 'cancelled' || /cancel/i.test(result.error || '')) {
      // user dismissed — silent
    } else {
      toast(result.error || 'Purchase failed. Please try again.', 'error');
    }
    setBusy('');
  };

  const handleRestore = async () => {
    setBusy('restore');
    const result = await restorePurchases();
    if (result.success) {
      await refreshUserDoc();
      toast('Pro restored. Welcome back!', 'success');
      onClose();
    } else {
      toast('No previous purchase found on this account.', 'info');
    }
    setBusy('');
  };

  const priceString = product?.priceString || '$5.99';

  return (
    <Shell onClose={onClose} lockReason={lockReason}>
      <div className="bg-sky/5 border-2 border-sky rounded-xl p-5 mb-4 relative">
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-sky text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
          One-Time
        </div>
        <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Lifetime Pro</div>
        <div className="text-3xl font-bold text-sky mb-1">{priceString}</div>
        <div className="text-[11px] text-gray-500 mb-4">Pay once, never again</div>
        <button
          onClick={handleBuy}
          disabled={!!busy}
          className="w-full py-2.5 rounded-lg bg-sky text-white font-bold text-sm
                     hover:bg-sky-dim active:scale-[0.97] transition-all disabled:opacity-50">
          {busy === 'buy' ? 'Processing…' : 'Unlock Pro'}
        </button>
      </div>

      <button
        onClick={handleRestore}
        disabled={!!busy}
        className="text-xs text-gray-500 hover:text-gray-700 underline mb-3 disabled:opacity-50">
        {busy === 'restore' ? 'Checking…' : 'Restore Purchases'}
      </button>

      <div>
        <button onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Maybe later
        </button>
      </div>
    </Shell>
  );
}

// ── Shared modal chrome ──
function Shell({ onClose, lockReason, children }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white border border-gray-200 rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl text-center"
           onClick={e => e.stopPropagation()}>

        <div className="text-4xl mb-3">⚾</div>
        <h2 className="text-2xl font-bold text-lime mb-2">Upgrade to Pro</h2>

        <p className="text-gray-600 text-sm mb-4">
          {lockReason || 'You\'ve reached the free tier limit.'}
        </p>

        <p className="text-gray-400 text-xs mb-6">
          Lineup Man Pro unlocks unlimited games, at-bats, and full season tracking.
          Your roster, stats, and history are all still here — just upgrade to keep going.
        </p>

        {children}
      </div>
    </div>
  );
}
