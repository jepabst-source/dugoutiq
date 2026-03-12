import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTeam } from '../contexts/TeamContext';
import RosterTab from '../components/roster/RosterTab';
import BattingTab from '../components/batting/BattingTab';
import DefenseTab from '../components/defense/DefenseTab';
import GameDayTab from '../components/gameday/GameDayTab';
import HistoryTab from '../components/history/HistoryTab';
import SettingsTab from '../components/settings/SettingsTab';

const TABS = [
  { id: 'roster', label: 'Roster', shortLabel: 'Roster', icon: '👥' },
  { id: 'batting', label: 'Batting', shortLabel: 'Bat', icon: '📊' },
  { id: 'defense', label: 'Defense', shortLabel: 'Def', icon: '🛡️' },
  { id: 'gameday', label: 'Game Day', shortLabel: '⚾', icon: '⚾', highlight: true },
  { id: 'history', label: 'History', shortLabel: 'Hist', icon: '📋' },
  { id: 'settings', label: 'Settings', shortLabel: '⚙️', icon: '⚙️' },
];

export default function AppShell() {
  const { user, logout } = useAuth();
  const { team } = useTeam();
  const [activeTab, setActiveTab] = useState('roster');

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-field-light border-b-2 border-lime/30 shadow-lg shadow-black/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo + Team Name */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-lime tracking-tight hidden sm:block">
              ⚾ DugoutIQ
            </h1>
            {team && (
              <>
                <span className="text-chalk-muted hidden sm:inline">·</span>
                <span className="text-chalk font-semibold text-sm sm:text-base">{team.name}</span>
                <span className="text-chalk-muted text-xs hidden sm:inline">
                  {team.seasonLabel} {team.seasonYear}
                </span>
              </>
            )}
          </div>

          {/* User menu */}
          <div className="flex items-center gap-3">
            {user?.photoURL && (
              <img src={user.photoURL} alt="" className="w-7 h-7 rounded-full border border-border" />
            )}
            <button
              onClick={logout}
              className="text-xs text-chalk-muted hover:text-chalk transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div className="max-w-6xl mx-auto px-2 pb-1">
          <div className="flex gap-0.5 bg-panel rounded-lg p-0.5 border border-border overflow-x-auto">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 min-w-0 px-2 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-semibold
                           transition-all duration-150 whitespace-nowrap
                  ${activeTab === tab.id
                    ? 'bg-field-light text-lime shadow-md'
                    : tab.highlight
                      ? 'text-gold hover:text-gold-bright hover:bg-panel-hover'
                      : 'text-chalk-muted hover:text-chalk hover:bg-panel-hover'
                  }`}
              >
                <span className="sm:hidden">{tab.shortLabel}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-6xl mx-auto w-full px-4 py-6">
        {activeTab === 'roster' && <RosterTab />}
        {activeTab === 'batting' && <BattingTab />}
        {activeTab === 'defense' && <DefenseTab />}
        {activeTab === 'gameday' && <GameDayTab />}
        {activeTab === 'history' && <HistoryTab />}
        {activeTab === 'settings' && <SettingsTab />}
      </main>
    </div>
  );
}

function ComingSoon({ label }) {
  return (
    <div className="text-center py-20">
      <div className="text-4xl mb-3">🚧</div>
      <h2 className="text-xl font-bold text-chalk-muted">{label}</h2>
      <p className="text-chalk-muted text-sm mt-1">Coming in Phase 2</p>
    </div>
  );
}
