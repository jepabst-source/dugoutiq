import { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TeamProvider, useTeam } from './contexts/TeamContext';
import LoginPage from './pages/LoginPage';
import CreateTeamPage from './pages/CreateTeamPage';
import JoinTeamPage from './pages/JoinTeamPage';
import ScorerPage from './pages/ScorerPage';
import PortalPage from './pages/PortalPage';
import AppShell from './pages/AppShell';
import HomePlateLoader from './components/shared/HomePlateLoader';
import { ToastProvider } from './components/shared/Toast';

function getInviteCode() {
  const path = window.location.pathname;
  const route = new URLSearchParams(window.location.search).get('route') || '';
  const combined = path + route;
  const match = combined.match(/\/join\/([a-zA-Z0-9]+)/);
  if (match) {
    try { window.history.replaceState(null, '', '/join/' + match[1]); } catch {}
  }
  return match ? match[1] : null;
}

function getScorerCode() {
  const path = window.location.pathname;
  const route = new URLSearchParams(window.location.search).get('route') || '';
  const combined = path + route;
  const match = combined.match(/\/score\/([a-zA-Z0-9]+)/);
  if (match) {
    try { window.history.replaceState(null, '', '/score/' + match[1]); } catch {}
  }
  return match ? match[1] : null;
}

function getPortalTeamId() {
  const path = window.location.pathname;
  const route = new URLSearchParams(window.location.search).get('route') || '';
  const combined = path + route;
  const match = combined.match(/\/portal\/([a-zA-Z0-9]+)/);
  if (match) {
    try { window.history.replaceState(null, '', '/portal/' + match[1]); } catch {}
  }
  return match ? match[1] : null;
}

function AppContent() {
  const { user, userDoc, loading, creatingDemo, activeTeamId } = useAuth();
  const [inviteCode] = useState(() => getInviteCode());
  const [scorerCode] = useState(() => getScorerCode());
  const [portalTeamId] = useState(() => getPortalTeamId());
  const [showUpgradeSuccess] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('upgraded') === 'true') {
      window.history.replaceState(null, '', window.location.pathname);
      return true;
    }
    return false;
  });

  // Portal page — no auth required
  if (portalTeamId) {
    return <PortalPage teamId={portalTeamId} />;
  }

  // Scorer page — no auth required
  if (scorerCode) {
    return <ScorerPage scorerCode={scorerCode} />;
  }

  if (loading) {
    return <HomePlateLoader />;
  }

  // Demo team being created: on login/signup, AuthContext sets creatingDemo
  // before the context `user` state, so this MUST come before the !user branch
  // below — otherwise the LoginPage stays on screen for the whole reset and
  // looks frozen (Apple Guideline 2.1 rejection risk).
  if (creatingDemo) {
    return <HomePlateLoader message="Setting up your demo team..." />;
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
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
}
