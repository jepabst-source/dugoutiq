import { useState, useRef, useEffect } from 'react';

export default function InfoTip({ text }) {
  const [open, setOpen] = useState(false);
  const tipRef = useRef(null);

  // Clamp popup so it never overflows the viewport horizontally
  useEffect(() => {
    if (!open || !tipRef.current) return;
    const el = tipRef.current;
    const rect = el.getBoundingClientRect();
    const pad = 8;
    if (rect.right > window.innerWidth - pad) {
      el.style.transform = `translateX(${window.innerWidth - pad - rect.right}px)`;
    } else if (rect.left < pad) {
      el.style.transform = `translateX(${pad - rect.left}px)`;
    }
  }, [open]);

  return (
    <span className="relative inline-flex items-center ml-1.5">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-4 h-4 rounded-full border border-chalk-muted/40 text-chalk-muted hover:text-chalk hover:border-chalk/50
                   inline-flex items-center justify-center text-[10px] font-bold leading-none transition-colors"
        aria-label="More info"
      >
        i
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            ref={tipRef}
            className="absolute bottom-full right-0 mb-2 w-56 px-3 py-2 rounded-lg
                        bg-panel border border-border shadow-lg text-xs text-chalk-dim leading-relaxed z-50"
          >
            {text}
            <div className="absolute top-full right-2 -mt-px w-2 h-2 rotate-45
                            bg-panel border-r border-b border-border" />
          </div>
        </>
      )}
    </span>
  );
}
