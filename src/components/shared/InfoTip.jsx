import { useState } from 'react';

export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="w-4 h-4 rounded-full border border-chalk-muted/40 text-chalk-muted hover:text-chalk hover:border-chalk/50
                   inline-flex items-center justify-center text-[10px] font-bold leading-none transition-colors"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 rounded-lg
                        bg-panel border border-border shadow-lg text-xs text-chalk-dim leading-relaxed z-50
                        pointer-events-none">
          {text}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px w-2 h-2 rotate-45
                          bg-panel border-r border-b border-border" />
        </div>
      )}
    </span>
  );
}
