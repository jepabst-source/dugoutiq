import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { loginWithGoogle, loginWithApple, signUpWithEmail, loginWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleApple = async () => {
    setError('');
    try { await loginWithApple(); }
    catch (err) {
      const msg = err?.message || '';
      if (/cancel/i.test(msg) || err?.code === 'auth/popup-closed-by-user') return;
      setError(msg || 'Apple Sign In failed.');
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);
    try {
      if (mode === 'signup') {
        await signUpWithEmail(email, password, name.trim());
        setMessage('Account created! Check your email for a verification link.');
      } else if (mode === 'login') {
        await loginWithEmail(email, password);
      } else if (mode === 'reset') {
        await resetPassword(email);
        setMessage('Password reset email sent. Check your inbox.');
      }
    } catch (err) {
      const code = err.code || '';
      if (code === 'auth/email-already-in-use') setError('An account with this email already exists.');
      else if (code === 'auth/invalid-email') setError('Invalid email address.');
      else if (code === 'auth/weak-password') setError('Password must be at least 6 characters.');
      else if (code === 'auth/user-not-found') setError('No account found with this email.');
      else if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') setError('Incorrect email or password.');
      else setError(err.message || 'Something went wrong.');
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: '#ffffff' }}>
      <div className="w-full max-w-md text-center">
        {/* Logo */}
        <div className="mb-6">
          <img src="/logo-square.jpg" alt="Dugout IQ" className="w-40 mx-auto rounded-2xl" />
        </div>
        <p className="text-gray-500 text-sm tracking-widest uppercase mb-8">
          Smart Lineup Manager
        </p>

        {/* Apple button */}
        <button
          onClick={handleApple}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl
                     bg-black text-white font-semibold text-sm border border-black
                     hover:bg-gray-900 active:scale-[0.98] transition-all duration-150 shadow-sm mb-3"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M16.365 1.43c0 1.14-.466 2.272-1.225 3.082-.81.866-2.13 1.534-3.22 1.45-.135-1.097.41-2.247 1.158-3.044.84-.9 2.27-1.567 3.287-1.488zM20.5 17.13c-.555 1.282-.82 1.86-1.535 2.99-1 1.575-2.41 3.537-4.158 3.55-1.555.013-1.954-.99-4.062-.978-2.108.012-2.546 1-4.1.987-1.748-.013-3.085-1.79-4.085-3.365C-.297 16.045-.42 10.6 1.4 7.713c1.295-2.043 3.34-3.236 5.26-3.236 1.96 0 3.19.99 4.81.99 1.575 0 2.535-.991 4.802-.991 1.71 0 3.523.93 4.815 2.535-4.232 2.318-3.547 8.36.413 10.12z"/>
          </svg>
          Continue with Apple
        </button>

        {/* Google button */}
        <button
          onClick={loginWithGoogle}
          className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl
                     bg-white text-gray-800 font-semibold text-sm border border-gray-200
                     hover:bg-gray-50 active:scale-[0.98] transition-all duration-150 shadow-sm"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div className="flex items-center gap-3 my-5">
          <div className="flex-1 h-px bg-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 h-px bg-gray-200" />
        </div>

        {/* Email form */}
        <form onSubmit={handleEmailSubmit} className="text-left">
          {mode === 'signup' && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)}
                placeholder="Coach name"
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm
                           placeholder:text-gray-400 focus:border-blue-400 focus:outline-none" />
            </div>
          )}

          {(mode === 'login' || mode === 'signup' || mode === 'reset') && (
            <div className="mb-3">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="coach@email.com" required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm
                           placeholder:text-gray-400 focus:border-blue-400 focus:outline-none" />
            </div>
          )}

          {(mode === 'login' || mode === 'signup') && (
            <div className="mb-4">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={mode === 'signup' ? 'At least 6 characters' : 'Password'} required
                  className="w-full pl-4 pr-11 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm
                             placeholder:text-gray-400 focus:border-blue-400 focus:outline-none" />
                <button type="button" onClick={() => setShowPassword(s => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600 transition-colors">
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.243 4.243L6.228 6.228" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-600">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-3 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              {message}
            </div>
          )}

          <button type="submit" disabled={submitting}
            className="w-full py-3.5 rounded-xl bg-[#1a3a5c] text-white font-semibold text-sm
                       hover:bg-[#152e4a] active:scale-[0.98] transition-all disabled:opacity-50">
            {submitting ? '...' : mode === 'signup' ? 'Create Account' : mode === 'reset' ? 'Send Reset Link' : 'Sign In'}
          </button>
        </form>

        {/* Mode switchers */}
        <div className="mt-4 space-y-2 text-xs">
          {mode === 'login' && (
            <>
              <p className="text-gray-400">
                Don't have an account?{' '}
                <button onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
                  className="text-blue-500 font-semibold hover:underline">Create one</button>
              </p>
              <p>
                <button onClick={() => { setMode('reset'); setError(''); setMessage(''); }}
                  className="text-gray-400 hover:text-gray-600 hover:underline">Forgot password?</button>
              </p>
              <p className="pt-1">
                <a href="/about.html"
                  className="text-gray-400 hover:text-gray-600 hover:underline">Learn more about Dugout IQ →</a>
              </p>
            </>
          )}
          {mode === 'signup' && (
            <p className="text-gray-400">
              Already have an account?{' '}
              <button onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="text-blue-500 font-semibold hover:underline">Sign in</button>
            </p>
          )}
          {mode === 'reset' && (
            <p className="text-gray-400">
              <button onClick={() => { setMode('login'); setError(''); setMessage(''); }}
                className="text-blue-500 font-semibold hover:underline">Back to sign in</button>
            </p>
          )}
        </div>

        {/* Footer */}
        <p className="mt-8 text-xs text-gray-400">
          By signing in, you agree to the Dugout IQ Terms of Service.
        </p>
        <p className="mt-2 text-xs text-gray-400">
          Your data stays private. We never share coach or player information.
        </p>
      </div>
    </div>
  );
}
