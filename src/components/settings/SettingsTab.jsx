import { useState, useEffect } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import { useAuth } from '../../contexts/AuthContext';
import StarRating from '../shared/StarRating';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const ALL_POSITIONS = ['Pitcher', 'Catcher', '1st Base', '2nd Base', 'Shortstop', '3rd Base', 'Left Field', 'Center Field', 'Right Field'];

export default function SettingsTab() {
  const { team, updateTeam, updateSettings, generateInviteCode, removeAssistant } = useTeam();
  const { user } = useAuth();
  const settings = team?.settings || {};

  const [teamName, setTeamName] = useState(team?.name || '');
  const [portalCode, setPortalCode] = useState(team?.portalCode || '');
  const [sport, setSport] = useState(team?.sport || 'softball');
  const [seasonLabel, setSeasonLabel] = useState(team?.seasonLabel || 'Spring');
  const [seasonYear, setSeasonYear] = useState(team?.seasonYear || new Date().getFullYear());
  const [saved, setSaved] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [generatingInvite, setGeneratingInvite] = useState(false);
  const [assistants, setAssistants] = useState([]);

  // Load assistant coach details
  useEffect(() => {
    async function loadAssistants() {
      const ids = team?.assistantIds || [];
      const details = [];
      for (const uid of ids) {
        try {
          const snap = await getDoc(doc(db, 'users', uid));
          if (snap.exists()) {
            details.push({ uid, ...snap.data() });
          } else {
            details.push({ uid, displayName: 'Unknown', email: '' });
          }
        } catch {
          details.push({ uid, displayName: 'Unknown', email: '' });
        }
      }
      setAssistants(details);
    }
    loadAssistants();
  }, [team?.assistantIds]);

  const showSaved = (msg) => {
    setSaved(msg);
    setTimeout(() => setSaved(''), 2000);
  };

  const handleSaveTeamInfo = async () => {
    await updateTeam({ name: teamName.trim(), portalCode, sport, seasonLabel, seasonYear: Number(seasonYear) });
    showSaved('Team info saved');
  };

  const toggleRule = async (key) => {
    await updateSettings({ [key]: !settings[key] });
    showSaved('Rule updated');
  };

  const setRuleValue = async (key, value) => {
    await updateSettings({ [key]: value });
    showSaved('Updated');
  };

  const setPositionMinRating = async (pos, rating) => {
    const current = { ...(settings.positionMinRatings || {}) };
    if (rating === 0) {
      delete current[pos];
    } else {
      current[pos] = rating;
    }
    await updateSettings({ positionMinRatings: current });
    showSaved(`${pos} → ${rating > 0 ? rating + '★ min' : 'no minimum'}`);
  };

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-lime">Settings</h2>
        {saved && <span className="text-xs text-lime animate-pulse">✓ {saved}</span>}
      </div>

      {/* Team Info */}
      <Section title="Team Info">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Team Name</label>
            <input type="text" value={teamName} onChange={e => setTeamName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                         focus:border-lime focus:outline-none" />
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Sport</label>
            <div className="flex gap-2">
              {['softball', 'baseball'].map(s => (
                <button key={s} type="button" onClick={() => setSport(s)}
                  className={`px-3 py-2 rounded-lg text-sm font-semibold capitalize transition-all flex-1
                    ${sport === s
                      ? 'border-lime bg-lime/10 text-lime border'
                      : 'border border-border bg-field text-chalk-muted hover:border-border-light'
                    }`}>
                  {s === 'softball' ? '🥎' : '⚾'} {s}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Season</label>
              <select value={seasonLabel} onChange={e => setSeasonLabel(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                           focus:border-lime focus:outline-none">
                {['Spring', 'Summer', 'Fall', 'Winter'].map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Year</label>
              <input type="number" value={seasonYear} onChange={e => setSeasonYear(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                           focus:border-lime focus:outline-none" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Coach</label>
            <div className="px-3 py-2 rounded-lg bg-field border border-border text-chalk-dim text-sm">
              {user?.displayName || user?.email}
            </div>
          </div>
        </div>
        <button onClick={handleSaveTeamInfo}
          className="mt-3 px-4 py-2 rounded-lg bg-lime text-field font-bold text-sm
                     hover:bg-lime-bright active:scale-[0.97] transition-all">
          Save Team Info
        </button>
      </Section>

      {/* Parent Portal */}
      <Section title="🔒 Parent Portal Access Code">

      {/* Assistant Coaches */}
      <Section title="👥 Assistant Coaches">
        <p className="text-xs text-chalk-muted mb-3">
          Generate an invite link to share with your assistant coaches. They sign in with Google and get added to your team.
        </p>

        {/* Generate invite */}
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={async () => {
              setGeneratingInvite(true);
              const code = await generateInviteCode();
              if (code) {
                const base = window.location.origin + window.location.pathname.replace(/\/$/, '');
                setInviteLink(`${base}/join/${code}`);
              }
              setGeneratingInvite(false);
            }}
            disabled={generatingInvite}
            className="px-4 py-2 rounded-lg bg-lime text-field font-bold text-sm
                       hover:bg-lime-bright active:scale-[0.97] transition-all disabled:opacity-50">
            {generatingInvite ? 'Generating...' : '🔗 Generate Invite Link'}
          </button>
        </div>

        {inviteLink && (
          <div className="bg-field border border-lime/30 rounded-xl p-3 mb-4">
            <p className="text-[10px] text-chalk-muted uppercase tracking-wider mb-1">Share this link with your assistant coach:</p>
            <div className="flex items-center gap-2">
              <input type="text" readOnly value={inviteLink}
                className="flex-1 px-3 py-2 rounded-lg bg-panel border border-border text-chalk text-xs
                           focus:outline-none select-all" 
                onClick={e => e.target.select()} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(inviteLink);
                  showSaved('Link copied!');
                }}
                className="px-3 py-2 rounded-lg bg-lime text-field font-bold text-xs
                           hover:bg-lime-bright transition-all whitespace-nowrap">
                📋 Copy
              </button>
            </div>
            <p className="text-[10px] text-chalk-muted mt-2">This link is single-use and will expire after it's been used.</p>
          </div>
        )}

        {/* Current assistants */}
        {assistants.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-2">Current Assistant Coaches</p>
            <div className="space-y-2">
              {assistants.map(a => (
                <div key={a.uid} className="flex items-center justify-between px-3 py-2 bg-field border border-border rounded-lg">
                  <div>
                    <span className="text-sm text-chalk font-semibold">{a.displayName || 'Unknown'}</span>
                    {a.email && <span className="text-xs text-chalk-muted ml-2">{a.email}</span>}
                  </div>
                  <button
                    onClick={() => {
                      if (confirm(`Remove ${a.displayName || 'this coach'} from the team?`)) {
                        removeAssistant(a.uid);
                      }
                    }}
                    className="px-2 py-1 text-[10px] font-bold text-red bg-red/10 border border-red/20 rounded
                               hover:bg-red/20 transition-colors">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-xs text-chalk-muted">No assistant coaches yet. Generate an invite link above.</p>
        )}
      </Section>
        <p className="text-xs text-chalk-muted mb-3">Share the portal URL + this 4-digit code with parents. They don't need an account.</p>
        <div className="flex items-center gap-3">
          <input type="tel" inputMode="numeric" maxLength={4} value={portalCode}
            onChange={e => setPortalCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
            placeholder="1234"
            className="w-24 px-3 py-2 rounded-lg bg-field border border-border text-chalk text-lg font-bold text-center tracking-widest
                       focus:border-lime focus:outline-none" />
          <button onClick={handleSaveTeamInfo}
            className="px-3 py-2 rounded-lg bg-lime text-field font-bold text-sm hover:bg-lime-bright transition-all">
            Save
          </button>
        </div>
      </Section>

      {/* Rotation Rules */}
      <Section title="⚙️ Rotation Rules">
        <p className="text-xs text-chalk-muted mb-4">These rules control how the defensive rotation engine assigns players to positions.</p>

        <div className="space-y-3">
          <RuleToggle
            label="No back-to-back bench sits"
            description="A player who sat on the bench last inning won't be benched again"
            enabled={settings.noBackToBackBench}
            onChange={() => toggleRule('noBackToBackBench')}
          />

          <div className="px-3 py-2 bg-field/50 border border-border rounded-lg">
            <div className="text-sm text-chalk font-semibold">Competitive vs. Development innings</div>
            <div className="text-xs text-chalk-muted mt-1">
              Toggle each inning between ⚔️ Competitive and 🔄 Development directly on the Defense tab when generating lineups.
              Development innings relax position rating floors to give developing players infield time.
            </div>
          </div>

          <RuleToggle
            label="Infield innings cap"
            description="Limits how many innings a player can play infield positions per game"
            enabled={settings.infieldCapEnabled}
            onChange={() => toggleRule('infieldCapEnabled')}
          />

          {settings.infieldCapEnabled && (
            <div className="ml-6 flex items-center gap-2">
              <span className="text-xs text-chalk-muted">Max</span>
              <select value={settings.infieldCapValue || 2}
                onChange={e => setRuleValue('infieldCapValue', Number(e.target.value))}
                className="px-2 py-1 rounded bg-field border border-border text-chalk text-sm focus:border-lime focus:outline-none">
                {[1, 2, 3, 4, 5, 6, 7].map(n => <option key={n} value={n}>{n}</option>)}
              </select>
              <span className="text-xs text-chalk-muted">infield innings per game</span>
            </div>
          )}

        </div>
      </Section>

      {/* Position Minimum Ratings */}
      <Section title="⭐ Position Minimum Ratings">
        <p className="text-xs text-chalk-muted mb-4">
          Set a preferred minimum rating for each position. The rotation engine uses these as guidelines when auto-generating lineups. You can always manually override any assignment.
        </p>
        <div className="space-y-2">
          {ALL_POSITIONS.filter(p => p !== 'Pitcher').map(pos => {
            const currentMin = (settings.positionMinRatings || {})[pos] || 0;
            return (
              <div key={pos} className="flex items-center gap-3 py-1.5">
                <span className="text-sm text-chalk w-24 font-semibold">{pos}</span>
                <div className="flex gap-0.5">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button key={star} type="button"
                      onClick={() => setPositionMinRating(pos, star === currentMin ? 0 : star)}
                      className={`text-xl transition-transform hover:scale-110
                        ${star <= currentMin ? 'text-gold' : 'text-border-light'}`}>
                      ★
                    </button>
                  ))}
                </div>
                <span className="text-xs text-chalk-muted">
                  {currentMin > 0 ? `${currentMin}★ minimum` : 'no minimum'}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* Default Innings */}
      <Section title="🏟️ Default Game Length">
        <div className="flex items-center gap-2">
          <span className="text-sm text-chalk-muted">Default innings per game:</span>
          <div className="flex gap-1">
            {[3, 4, 5, 6, 7, 8, 9].map(n => (
              <button key={n}
                onClick={() => setRuleValue('defaultInnings', n)}
                className={`w-8 h-8 rounded-md text-xs font-bold transition-all
                  ${(settings.defaultInnings || 3) === n
                    ? 'bg-lime/20 border-lime text-lime border'
                    : 'border border-border text-chalk-muted hover:border-border-light'
                  }`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </Section>
    </div>
  );
}

// ── Reusable Components ──

function Section({ title, children }) {
  return (
    <div className="bg-panel border border-border rounded-xl p-4 mb-4">
      <h3 className="text-sm font-bold text-lime uppercase tracking-wider mb-3">{title}</h3>
      {children}
    </div>
  );
}

function RuleToggle({ label, description, enabled, onChange }) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className={`relative w-10 h-5 rounded-full transition-colors mt-0.5 flex-shrink-0
        ${enabled ? 'bg-lime' : 'bg-border'}`}
        onClick={onChange}>
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform
          ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </div>
      <div>
        <div className="text-sm text-chalk font-semibold group-hover:text-lime transition-colors">{label}</div>
        <div className="text-xs text-chalk-muted">{description}</div>
      </div>
    </label>
  );
}
