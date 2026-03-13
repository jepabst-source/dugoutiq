import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function JoinTeamPage({ inviteCode, onJoined }) {
  const { user, loginWithGoogle, loginWithApple } = useAuth();
  const [invite, setInvite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Load invite details
  useEffect(() => {
    async function loadInvite() {
      try {
        const snap = await getDoc(doc(db, 'invites', inviteCode));
        if (snap.exists()) {
          setInvite(snap.data());
          if (snap.data().used) setError('This invite has already been used.');
        } else {
          setError('Invalid invite link.');
        }
      } catch (err) {
        console.error('Invite load error:', err);
        setError('Could not load invite. Make sure Firestore rules allow public reads on invites collection.');
      }
      setLoading(false);
    }
    loadInvite();
  }, [inviteCode]);

  const handleJoin = async () => {
    if (!user || !onJoined) return;
    setJoining(true);
    setError('');
    try {
      const result = await onJoined(inviteCode);
      if (result.success) {
        setSuccess(`You've joined ${result.teamName || 'the team'}!`);
      } else {
        setError(result.error || 'Failed to join team.');
      }
    } catch (err) {
      setError('Something went wrong.');
    }
    setJoining(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'radial-gradient(ellipse at 30% 20%, rgba(142,212,49,0.06) 0%, transparent 60%), var(--color-field)' }}>
      <div className="w-full max-w-sm text-center">
        <div className="mb-2">
          <span className="text-5xl">⚾</span>
        </div>
        <h1 className="text-3xl font-bold text-lime mb-1">Dugout IQ</h1>
        <p className="text-chalk-muted text-sm uppercase tracking-widest mb-8">Team Invite</p>

        {loading ? (
          <p className="text-chalk-muted animate-pulse">Loading invite...</p>
        ) : error && !success ? (
          <div className="bg-red/10 border border-red/25 rounded-xl p-4 mb-4">
            <p className="text-red text-sm">{error}</p>
          </div>
        ) : success ? (
          <div className="bg-lime/10 border border-lime/25 rounded-xl p-4 mb-4">
            <p className="text-lime text-sm font-semibold">{success}</p>
            <p className="text-chalk-muted text-xs mt-2">Redirecting to the app...</p>
          </div>
        ) : (
          <>
            {/* Invite info */}
            <div className="bg-panel border border-border rounded-xl p-5 mb-6">
              <p className="text-chalk-muted text-xs uppercase tracking-wider mb-2">You've been invited to join</p>
              <p className="text-2xl font-bold text-chalk">{invite?.teamName || 'a team'}</p>
              <p className="text-xs text-chalk-muted mt-1">as an assistant coach</p>
            </div>

            {/* Not logged in — show auth buttons */}
            {!user ? (
              <div className="space-y-3">
                <p className="text-chalk-muted text-sm mb-4">Sign in to accept the invite:</p>
                <button onClick={loginWithGoogle}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl
                             bg-white text-gray-800 font-semibold text-sm
                             hover:bg-gray-50 active:scale-[0.98] transition-all shadow-lg shadow-black/20">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  Continue with Google
                </button>
                <button onClick={loginWithApple}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3.5 rounded-xl
                             bg-black text-white font-semibold text-sm border border-gray-700
                             hover:bg-gray-900 active:scale-[0.98] transition-all shadow-lg shadow-black/20">
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                  </svg>
                  Continue with Apple
                </button>
              </div>
            ) : (
              /* Logged in — show join button */
              <div>
                <p className="text-chalk-dim text-sm mb-4">
                  Signed in as <strong className="text-chalk">{user.displayName || user.email}</strong>
                </p>
                <button onClick={handleJoin} disabled={joining}
                  className="w-full py-3.5 rounded-xl bg-lime text-field font-bold text-sm uppercase tracking-wider
                             hover:bg-lime-bright active:scale-[0.98] transition-all
                             disabled:opacity-50 shadow-lg shadow-lime/20">
                  {joining ? 'Joining...' : 'Join Team'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
