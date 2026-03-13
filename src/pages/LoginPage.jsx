import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { loginWithGoogle, signUpWithEmail, loginWithEmail, resetPassword } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup' | 'reset'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

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
          <img src="/logo.png" alt="Dugout IQ" className="w-[28rem] max-w-full mx-auto" />
        </div>
        <p className="text-gray-500 text-sm tracking-widest uppercase mb-8">
          Smart Lineup Manager
        </p>

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
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder={mode === 'signup' ? 'At least 6 characters' : 'Password'} required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 text-gray-800 text-sm
                           placeholder:text-gray-400 focus:border-blue-400 focus:outline-none" />
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
