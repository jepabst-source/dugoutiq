import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TeamProvider, useTeam } from './contexts/TeamContext';
import LoginPage from './pages/LoginPage';
import CreateTeamPage from './pages/CreateTeamPage';
import JoinTeamPage from './pages/JoinTeamPage';
import AppShell from './pages/AppShell';

function getInviteCode() {
  // Check URL for /join/CODE pattern
  const path = window.location.pathname;
  const match = path.match(/\/join\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

function AppContent() {
  const { user, userDoc, loading, activeTeamId } = useAuth();
  const [inviteCode] = useState(() => getInviteCode());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⚾</div>
          <p className="text-chalk-muted text-sm">Loading DugoutIQ...</p>
        </div>
      </div>
    );
  }

  // Invite link flow
  if (inviteCode) {
    return (
      <TeamProvider>
        <JoinTeamWrapper inviteCode={inviteCode} />
      </TeamProvider>
    );
  }

  // Not logged in
  if (!user) return <LoginPage />;

  // Logged in but no teams yet
  if (!userDoc?.teamIds?.length || !activeTeamId) {
    return (
      <TeamProvider>
        <CreateTeamPage />
      </TeamProvider>
    );
  }

  // Full app
  return (
    <TeamProvider>
      <AppShell />
    </TeamProvider>
  );
}

function JoinTeamWrapper({ inviteCode }) {
  const { joinTeamWithCode } = useTeam();

  const handleJoined = async (code) => {
    const result = await joinTeamWithCode(code);
    if (result.success) {
      // Clear the invite URL and reload into main app
      setTimeout(() => {
        window.location.href = window.location.origin + window.location.pathname.split('/join/')[0] + '/';
      }, 1500);
    }
    return result;
  };

  return <JoinTeamPage inviteCode={inviteCode} onJoined={handleJoined} />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
