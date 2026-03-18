import { useState } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import app from '../../lib/firebase';

export default function UpgradeModal({ onClose, lockReason }) {
  const [loading, setLoading] = useState('');

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
      alert('Something went wrong. Please try again.');
    }
    setLoading('');
  };

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

        {/* Pricing cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Monthly</div>
            <div className="text-2xl font-bold text-gray-800">$3.99</div>
            <div className="text-[10px] text-gray-400">/month</div>
            <button
              onClick={() => handleUpgrade('monthly')}
              disabled={!!loading}
              className="w-full mt-3 py-2 rounded-lg bg-gray-200 text-gray-700 font-bold text-xs
                         hover:bg-gray-300 active:scale-[0.97] transition-all disabled:opacity-50">
              {loading === 'monthly' ? 'Loading...' : 'Choose Monthly'}
            </button>
          </div>

          <div className="bg-sky/5 border-2 border-sky rounded-xl p-4 relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-sky text-white text-[9px] font-bold rounded-full uppercase tracking-wider">
              Best Value
            </div>
            <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Annual</div>
            <div className="text-2xl font-bold text-sky">$19.99</div>
            <div className="text-[10px] text-gray-400">/year</div>
            <button
              onClick={() => handleUpgrade('annual')}
              disabled={!!loading}
              className="w-full mt-3 py-2 rounded-lg bg-sky text-white font-bold text-xs
                         hover:bg-sky-dim active:scale-[0.97] transition-all disabled:opacity-50">
              {loading === 'annual' ? 'Loading...' : 'Choose Annual'}
            </button>
          </div>
        </div>

        <button onClick={onClose}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
          Maybe later
        </button>
      </div>
    </div>
  );
}
