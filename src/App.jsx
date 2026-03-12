import { AuthProvider, useAuth } from './contexts/AuthContext';
import { TeamProvider } from './contexts/TeamContext';
import LoginPage from './pages/LoginPage';
import CreateTeamPage from './pages/CreateTeamPage';
import AppShell from './pages/AppShell';

function AppContent() {
  const { user, userDoc, loading, activeTeamId } = useAuth();

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

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
