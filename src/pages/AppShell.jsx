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
  const { user, logout, allTeams, setActiveTeamId, activeTeamId } = useAuth();
  const { team } = useTeam();
  const [activeTab, setActiveTab] = useState('roster');
  const [showTeamMenu, setShowTeamMenu] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Create Team Modal */}
      {showCreateTeam && (
        <CreateTeamModal onClose={() => setShowCreateTeam(false)} />
      )}

      {/* Header */}
      <header className="sticky top-0 z-50 bg-field-light border-b-2 border-lime/30 shadow-lg shadow-black/30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          {/* Logo + Team Switcher */}
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-lime tracking-tight hidden sm:block">
              ⚾ DugoutIQ
            </h1>
            {team && (
              <div className="relative">
                <button onClick={() => setShowTeamMenu(!showTeamMenu)}
                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-panel transition-colors">
                  <span className="text-chalk font-semibold text-sm sm:text-base">{team.name}</span>
                  <span className="text-chalk-muted text-xs hidden sm:inline">
                    {team.seasonLabel} {team.seasonYear}
                  </span>
                  <span className="text-chalk-muted text-xs">▼</span>
                </button>

                {showTeamMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowTeamMenu(false)} />
                    <div className="absolute top-full left-0 mt-1 w-64 bg-panel border border-border rounded-xl shadow-xl z-50 overflow-hidden">
                      {allTeams.map(t => (
                        <button key={t.id}
                          onClick={() => { setActiveTeamId(t.id); setShowTeamMenu(false); }}
                          className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-panel-hover transition-colors
                            ${t.id === activeTeamId ? 'bg-lime/5 border-l-2 border-lime' : ''}`}>
                          <span className="text-base">{t.sport === 'softball' ? '🥎' : '⚾'}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-chalk truncate">{t.name}</div>
                            <div className="text-[10px] text-chalk-muted">{t.seasonLabel} {t.seasonYear}</div>
                          </div>
                          {t.id === activeTeamId && <span className="text-lime text-xs">✓</span>}
                        </button>
                      ))}
                      <button
                        onClick={() => { setShowTeamMenu(false); setShowCreateTeam(true); }}
                        className="w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-panel-hover transition-colors border-t border-border">
                        <span className="text-base">➕</span>
                        <span className="text-sm font-semibold text-lime">Create New Team</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
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

function CreateTeamModal({ onClose }) {
  const { createTeam } = useTeam();
  const { refreshTeams } = useAuth();
  const [name, setName] = useState('');
  const [sport, setSport] = useState('softball');
  const [seasonLabel, setSeasonLabel] = useState('Spring');
  const [seasonYear, setSeasonYear] = useState(new Date().getFullYear());
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    try {
      await createTeam({ name: name.trim(), sport, seasonYear, seasonLabel });
      await refreshTeams();
      onClose();
    } catch (err) {
      console.error('Failed to create team:', err);
    }
    setCreating(false);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60" onClick={onClose}>
      <div className="bg-panel border border-lime rounded-2xl p-6 w-full max-w-md mx-4 shadow-2xl"
           onClick={e => e.stopPropagation()}>
        <h2 className="text-xl font-bold text-lime mb-4">Create New Team</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-1">Team Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Thunder" autoFocus
              className="w-full px-4 py-3 rounded-xl bg-field border border-border text-chalk
                         placeholder:text-chalk-muted/40 focus:border-lime focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-1">Sport</label>
            <div className="grid grid-cols-2 gap-3">
              {['softball', 'baseball'].map(s => (
                <button key={s} type="button" onClick={() => setSport(s)}
                  className={`px-4 py-2 rounded-xl border text-sm font-semibold capitalize transition-all
                    ${sport === s ? 'border-lime bg-lime/10 text-lime' : 'border-border bg-field text-chalk-muted'}`}>
                  {s === 'softball' ? '🥎' : '⚾'} {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-1">Season</label>
              <select value={seasonLabel} onChange={e => setSeasonLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-field border border-border text-chalk text-sm focus:border-lime focus:outline-none">
                {['Spring', 'Summer', 'Fall', 'Winter'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-1">Year</label>
              <input type="number" value={seasonYear} onChange={e => setSeasonYear(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-xl bg-field border border-border text-chalk text-sm focus:border-lime focus:outline-none" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="submit" disabled={!name.trim() || creating}
              className="flex-1 py-3 rounded-xl bg-lime text-field font-bold text-sm uppercase tracking-wider
                         hover:bg-lime-bright active:scale-[0.98] transition-all disabled:opacity-40">
              {creating ? 'Creating...' : 'Create Team'}
            </button>
            <button type="button" onClick={onClose}
              className="px-5 py-3 rounded-xl bg-border text-chalk font-semibold text-sm hover:bg-border-light transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
