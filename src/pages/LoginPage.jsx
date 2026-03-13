import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(142,212,49,0.06) 0%, transparent 60%), var(--color-field)' }}>
      <div className="w-full max-w-sm text-center">
        {/* Logo */}
        <div className="mb-2">
          <span className="text-5xl">⚾</span>
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-lime mb-1"
            style={{ fontFamily: 'var(--font-display)' }}>
          Dugout IQ
        </h1>
        <p className="text-chalk-muted text-sm tracking-widest uppercase mb-12">
          Smart Lineup Manager
        </p>

        {/* Auth buttons */}
        <div className="space-y-3">
          <button
            onClick={loginWithGoogle}
            className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl
                       bg-white text-gray-800 font-semibold text-sm
                       hover:bg-gray-50 active:scale-[0.98] transition-all duration-150
                       shadow-lg shadow-black/20"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>
        </div>

        {/* Footer */}
        <p className="mt-12 text-xs text-chalk-muted">
          By signing in, you agree to the Dugout IQ Terms of Service.
        </p>
        <p className="mt-2 text-xs text-chalk-muted opacity-60">
          Your data stays private. We never share coach or player information.
        </p>
      </div>
    </div>
  );
}
