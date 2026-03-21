import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext();

export function useToast() {
  return useContext(ToastContext);
}

let toastId = 0;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef({});

  const removeToast = useCallback((id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts(prev => prev.map(t => t.id === id ? { ...t, exiting: true } : t));
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 250);
  }, []);

  const toast = useCallback((message, type = 'success') => {
    const id = ++toastId;
    setToasts(prev => [...prev, { id, message, type, exiting: false }]);
    timers.current[id] = setTimeout(() => removeToast(id), 3500);
    return id;
  }, [removeToast]);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {/* Toast container — fixed at top center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[999] flex flex-col items-center gap-2 pointer-events-none"
           style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
        {toasts.map(t => (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            className={`toast-enter pointer-events-auto cursor-pointer
              px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium max-w-[90vw] text-center
              ${t.exiting ? 'toast-exit' : ''}
              ${t.type === 'success' ? 'bg-lime text-white' : ''}
              ${t.type === 'error' ? 'bg-red text-white' : ''}
              ${t.type === 'warning' ? 'bg-gold text-white' : ''}
            `}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
