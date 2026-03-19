import { useState, useEffect } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../lib/firebase';
import { isNative } from '../../services/platform';
import { getOfferings, purchasePackage, restorePurchases } from '../../services/payments';
import { useAuth } from '../../contexts/AuthContext';

export default function UpgradeModal({ onClose, lockReason }) {
  const [loading, setLoading] = useState('');
  const [nativePackages, setNativePackages] = useState([]);
  const [restoring, setRestoring] = useState(false);
  const { refreshUserDoc } = useAuth();

  // Load RevenueCat offerings on native
  useEffect(() => {
    if (isNative()) {
      getOfferings().then(pkgs => setNativePackages(pkgs));
    }
  }, []);

  // ── WEB: Stripe Checkout ──
  const handleStripeUpgrade = async (plan) => {
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
      alert('Something went wrong. Please try again.');
    }
    setLoading('');
  };

  // ── NATIVE: RevenueCat IAP ──
  const handleNativeUpgrade = async (pkg) => {
    setLoading(pkg.identifier);
    const result = await purchasePackage(pkg);
    if (result.success) {
      await refreshUserDoc();
      onClose();
    } else if (result.error && result.error !== 'cancelled') {
      alert('Purchase failed. Please try again.');
    }
    setLoading('');
  };

  const handleRestore = async () => {
    setRestoring(true);
    const restored = await restorePurchases();
    if (restored) {
      await refreshUserDoc();
      onClose();
    } else {
      alert('No previous purchases found.');
    }
    setRestoring(false);
  };

  // Find seasonal and annual packages from RevenueCat offerings
  const seasonalPkg = nativePackages.find(p =>
    p.identifier?.includes('season') || p.identifier?.includes('monthly') || p.packageType === 'MONTHLY'
  );
  const annualPkg = nativePackages.find(p =>
    p.identifier?.includes('annual') || p.identifier?.includes('yearly') || p.packageType === 'ANNUAL'
  );

  const useNative = isNative() && nativePackages.length > 0;

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
          Dugout IQ Pro unlocks unlimited games, at-bats, and full season tracking.
          Your roster, stats, and history are all still here — just upgrade to keep going.
        </p>

        {/* Pricing cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Season / Monthly */}
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">1 Season</div>
            <div className="text-2xl font-bold text-gray-800">
              {useNative && seasonalPkg ? seasonalPkg.product.priceString : '$11.99'}
            </div>
            <div className="text-[10px] text-gray-400">3 months</div>
            <button
              onClick={() => useNative && seasonalPkg
                ? handleNativeUpgrade(seasonalPkg)
                : handleStripeUpgrade('monthly')
              }
              disabled={!!loading}
              className="w-full mt-3 py-2 rounded-lg bg-gray-200 text-gray-700 font-bold text-xs
                         hover:bg-gray-300 active:scale-[0.97] transition-all disabled:opacity-50">
              {loading === (useNative ? seasonalPkg?.identifier : 'monthly') ? 'Loading...' : 'Choose Season'}
            </button>
          </div>

          {/* Annual */}
          <div className="bg-sky/5 border-2 border-sky rounded-xl p-4 relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-sky text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
              Best Value
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Full Year</div>
            <div className="text-2xl font-bold text-sky">
              {useNative && annualPkg ? annualPkg.product.priceString : '$19.99'}
            </div>
            <div className="text-[10px] text-gray-400">12 months</div>
            <button
              onClick={() => useNative && annualPkg
                ? handleNativeUpgrade(annualPkg)
                : handleStripeUpgrade('annual')
              }
              disabled={!!loading}
              className="w-full mt-3 py-2 rounded-lg bg-sky text-white font-bold text-xs
                         hover:bg-sky-dim active:scale-[0.97] transition-all disabled:opacity-50">
              {loading === (useNative ? annualPkg?.identifier : 'annual') ? 'Loading...' : 'Choose Year'}
            </button>
          </div>
        </div>

        {/* Restore purchases (native only) */}
        {isNative() && (
          <button onClick={handleRestore} disabled={restoring}
            className="text-xs text-sky hover:text-sky-dim transition-colors mb-3 block mx-auto">
            {restoring ? 'Restoring...' : 'Restore previous purchase'}
          </button>
        )}

        <button onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Maybe later
        </button>
      </div>
    </div>
  );
}
