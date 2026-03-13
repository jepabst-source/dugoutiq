export default function UpgradeModal({ onClose, lockReason }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-panel border border-lime rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl text-center"
           onClick={e => e.stopPropagation()}>

        <div className="text-4xl mb-3">⚾</div>
        <h2 className="text-2xl font-bold text-lime mb-2">Upgrade to Pro</h2>

        <p className="text-chalk-dim text-sm mb-4">
          {lockReason || 'You\'ve reached the free tier limit.'}
        </p>

        <p className="text-chalk-muted text-xs mb-6">
          Dugout IQ Pro unlocks unlimited games, at-bats, and full season tracking.
          Your roster, stats, and history are all still here — just upgrade to keep going.
        </p>

        {/* Pricing cards */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-field border border-border rounded-xl p-4">
            <div className="text-xs text-chalk-muted uppercase tracking-wider mb-1">Monthly</div>
            <div className="text-2xl font-bold text-chalk">$3.99</div>
            <div className="text-[10px] text-chalk-muted">/month</div>
            <button
              onClick={() => {
                // TODO: Stripe checkout monthly
                alert('Stripe integration coming soon! For now, contact josh@dugoutiq.com for early access.');
              }}
              className="w-full mt-3 py-2 rounded-lg bg-border text-chalk font-bold text-xs
                         hover:bg-border-light active:scale-[0.97] transition-all">
              Choose Monthly
            </button>
          </div>

          <div className="bg-field border-2 border-lime rounded-xl p-4 relative">
            <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-lime text-field text-[9px] font-bold rounded-full uppercase tracking-wider">
              Best Value
            </div>
            <div className="text-xs text-chalk-muted uppercase tracking-wider mb-1">Annual</div>
            <div className="text-2xl font-bold text-lime">$19.99</div>
            <div className="text-[10px] text-chalk-muted">/year</div>
            <button
              onClick={() => {
                // TODO: Stripe checkout annual
                alert('Stripe integration coming soon! For now, contact josh@dugoutiq.com for early access.');
              }}
              className="w-full mt-3 py-2 rounded-lg bg-lime text-field font-bold text-xs
                         hover:bg-lime-bright active:scale-[0.97] transition-all">
              Choose Annual
            </button>
          </div>
        </div>

        <button onClick={onClose}
          className="text-xs text-chalk-muted hover:text-chalk transition-colors">
          Maybe later
        </button>
      </div>
    </div>
  );
}
