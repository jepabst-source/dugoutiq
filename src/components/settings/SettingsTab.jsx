import { useState, useEffect, useCallback } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import { useAuth } from '../../contexts/AuthContext';
import StarRating from '../shared/StarRating';
import { useToast } from '../shared/Toast';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../lib/firebase';

const ALL_POSITIONS = ['Pitcher', 'Catcher', '1st Base', '2nd Base', 'Shortstop', '3rd Base', 'Left Field', 'Center Field', 'Right Field'];

export default function SettingsTab() {
  const { team, updateTeam, updateSettings, generateInviteCode, removeAssistant, deleteTeam, getActivePlayers, battingOrder: savedOrder } = useTeam();
  const { user } = useAuth();
  const toast = useToast();
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
  const [exporting, setExporting] = useState(false);

  const exportLineup = useCallback(async () => {
    setExporting(true);
    try {
      const html2canvas = (await import('html2canvas')).default;
      
      // Find the print content — it's rendered in the PrintTab
      // We need to temporarily render it offscreen
      const printEl = document.getElementById('print-export-target');
      if (!printEl) {
        toast('Generate a lineup on the Fielding tab first, then try again.', 'warning');
        setExporting(false);
        return;
      }

      const canvas = await html2canvas(printEl, {
        scale: 2,
        backgroundColor: '#ffffff',
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          // Override oklch colors that html2canvas can't parse
          const el = clonedDoc.getElementById('print-export-target');
          if (el) {
            // Force all text to use hex colors
            el.querySelectorAll('*').forEach(node => {
              const computed = window.getComputedStyle(node);
              const color = computed.color;
              const bgColor = computed.backgroundColor;
              const borderColor = computed.borderColor;
              if (color && color.includes('oklch')) node.style.color = '#1f2937';
              if (bgColor && bgColor.includes('oklch')) node.style.backgroundColor = 'transparent';
              if (borderColor && borderColor.includes('oklch')) node.style.borderColor = '#e5e7eb';
            });
          }
        },
      });

      canvas.toBlob(async (blob) => {
        if (!blob) { setExporting(false); return; }
        
        // Try native share with image
        const file = new File([blob], 'lineup.jpg', { type: 'image/jpeg' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              files: [file],
              title: `${team?.name || 'Team'} Lineup`,
              text: 'Dugout card from Dugout IQ',
            });
            setExporting(false);
            return;
          } catch (e) { /* cancelled or failed */ }
        }

        // Fallback: open image in new tab (long-press to save on mobile)
        const url = URL.createObjectURL(blob);
        const img = new Image();
        img.src = url;
        const w = window.open('');
        if (w) {
          w.document.write(`
            <html><head><title>Lineup</title><meta name="viewport" content="width=device-width,initial-scale=1">
            <style>body{margin:0;background:#f0f0f0;padding:16px;overflow-x:auto}
            img{max-height:100vh;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.1)}</style></head>
            <body><img src="${url}"></body></html>
          `);
        } else {
          // If popup blocked, download directly
          const a = document.createElement('a');
          a.href = url;
          a.download = `lineup-${team?.name || 'team'}.jpg`;
          a.click();
          URL.revokeObjectURL(url);
        }
        setExporting(false);
      }, 'image/jpeg', 0.92);
    } catch (err) {
      console.error('Export error:', err);
      toast('Export failed: ' + (err.message || err), 'error');
      setExporting(false);
    }
  }, [team]);

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

  const [coachName, setCoachName] = useState(team?.coachName || user?.displayName || '');

  const handleSaveTeamInfo = async () => {
    await updateTeam({ name: teamName.trim(), portalCode, sport, seasonLabel, seasonYear: Number(seasonYear), coachName: coachName.trim() });
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
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-lime">Settings</h2>
        {saved && <span className="text-xs text-lime animate-pulse">✓ {saved}</span>}
      </div>

      {/* Export Lineup — mobile only */}
      <div className="sm:hidden bg-panel border border-border rounded-xl shadow-sm p-4 mb-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-chalk">📲 Export Lineup</div>
            <div className="text-[10px] text-chalk-muted">Save batting order + defensive lineup as an image</div>
          </div>
          <button onClick={exportLineup} disabled={exporting}
            className="px-4 py-2 rounded-lg bg-lime text-white font-bold text-sm
                       hover:bg-lime-bright active:scale-[0.97] transition-all disabled:opacity-50">
            {exporting ? 'Saving...' : 'Save Image'}
          </button>
        </div>
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
            <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Head Coach</label>
            <input type="text" value={coachName} onChange={e => setCoachName(e.target.value)}
              placeholder="Coach name"
              className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                         focus:border-lime focus:outline-none" />
          </div>
        </div>
        <button onClick={handleSaveTeamInfo}
          className="mt-3 px-4 py-2 rounded-lg bg-lime text-field font-bold text-sm
                     hover:bg-lime-bright active:scale-[0.97] transition-all">
          Save Team Info
        </button>
      </Section>

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

      {/* Parent Portal */}
      <Section title="🔒 Parent Portal">
        <p className="text-xs text-chalk-muted mb-3">Share this link and access code with parents. They can view player stats — no account needed.</p>
        
        {/* Portal URL */}
        {team?.id && (
          <div className="bg-field border border-lime/20 rounded-lg p-3 mb-3">
            <p className="text-[10px] text-chalk-muted uppercase tracking-wider mb-1">Portal Link</p>
            <div className="flex items-center gap-2">
              <input type="text" readOnly
                value={`${window.location.origin}/portal/${team.id}`}
                className="flex-1 px-3 py-2 rounded-lg bg-panel border border-border text-chalk text-xs focus:outline-none"
                onClick={e => e.target.select()} />
              <button
                onClick={() => {
                  navigator.clipboard.writeText(`${window.location.origin}/portal/${team.id}`);
                  showSaved('Link copied!');
                }}
                className="px-3 py-2 rounded-lg bg-lime text-field font-bold text-xs hover:bg-lime-bright transition-all whitespace-nowrap">
                📋 Copy
              </button>
            </div>
          </div>
        )}

        {/* PIN */}
        <div className="flex items-center gap-3 mb-4">
          <div>
            <p className="text-[10px] text-chalk-muted uppercase tracking-wider mb-1">Access Code</p>
            <input type="tel" inputMode="numeric" maxLength={4} value={portalCode}
              onChange={e => setPortalCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="1234"
              className="w-24 px-3 py-2 rounded-lg bg-field border border-border text-chalk text-lg font-bold text-center tracking-widest
                         focus:border-lime focus:outline-none" />
          </div>
          <button onClick={handleSaveTeamInfo}
            className="px-3 py-2 rounded-lg bg-lime text-field font-bold text-sm hover:bg-lime-bright transition-all mt-4">
            Save
          </button>
        </div>

        {/* Portal Display Settings */}
        <div className="border-t border-border pt-4">
          <p className="text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-3">What Parents See</p>
          <div className="space-y-3">
            <RuleToggle
              label="Show Points"
              description="Display total batting points for each player"
              enabled={settings.portalShowPoints !== false}
              onChange={() => setRuleValue('portalShowPoints', settings.portalShowPoints === false)}
            />
            <RuleToggle
              label="Show Form"
              description="Display rolling batting average (pts per AB)"
              enabled={settings.portalShowForm !== false}
              onChange={() => setRuleValue('portalShowForm', settings.portalShowForm === false)}
            />
            {settings.portalShowForm !== false && (
              <div className="ml-6 flex items-center gap-2">
                <span className="text-xs text-chalk-muted">Form based on last</span>
                <div className="flex gap-1">
                  {[3, 5, 10].map(n => (
                    <button key={n}
                      onClick={() => setRuleValue('portalFormWindow', n)}
                      className={`w-8 h-8 rounded-md text-xs font-bold transition-all
                        ${(settings.portalFormWindow || 5) === n
                          ? 'bg-lime/20 border-lime text-lime border'
                          : 'border border-border text-chalk-muted hover:border-border-light'
                        }`}>
                      {n}
                    </button>
                  ))}
                </div>
                <span className="text-xs text-chalk-muted">at-bats</span>
              </div>
            )}
            <RuleToggle
              label="Show Total At-Bats"
              description="Display total AB count for each player"
              enabled={settings.portalShowTotalABs !== false}
              onChange={() => setRuleValue('portalShowTotalABs', settings.portalShowTotalABs === false)}
            />
            <RuleToggle
              label="Show Games Played"
              description="Display number of games for each player"
              enabled={settings.portalShowGames !== false}
              onChange={() => setRuleValue('portalShowGames', settings.portalShowGames === false)}
            />

            {/* OBP Scope */}
            <div className="bg-field/50 border border-border rounded-lg p-3">
              <div className="text-sm text-chalk font-semibold mb-1">OBP Scope</div>
              <p className="text-[10px] text-chalk-muted mb-3">
                Calculate on-base percentage from all at-bats or just the most recent.
              </p>
              <div className="flex gap-1">
                {[
                  { value: 'total', label: 'Total' },
                  { value: '3', label: 'Last 3 ABs' },
                  { value: '5', label: 'Last 5 ABs' },
                  { value: '10', label: 'Last 10 ABs' },
                ].map(opt => (
                  <button key={opt.value}
                    onClick={() => setRuleValue('portalOBPScope', opt.value)}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all
                      ${(settings.portalOBPScope || 'total') === opt.value
                        ? 'bg-lime/20 border-lime text-lime border'
                        : 'border border-border text-chalk-muted hover:border-border-light'
                      }`}>
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-chalk-muted mt-2">
                {(settings.portalOBPScope || 'total') === 'total'
                  ? 'OBP uses all at-bats from the entire season.'
                  : `OBP uses the last ${settings.portalOBPScope} at-bats only.`}
              </p>
            </div>
          </div>
        </div>
      </Section>

      {/* Fielding Toolbox */}
      <Section title="🛠️ Fielding Toolbox">
        <p className="text-xs text-chalk-muted mb-4">
          Fine-tune how the rotation engine handles bench fairness and player placement.
        </p>

        <div className="space-y-3">
          <RuleToggle
            label="No back-to-back bench sits"
            description="A player who sat on the bench last inning won't be benched again"
            enabled={settings.noBackToBackBench}
            onChange={() => toggleRule('noBackToBackBench')}
          />

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

          <RuleToggle
            label="Sticky key positions"
            description="Players in 3-4★ mandated positions (e.g. 1st Base, Shortstop) stay at least two innings in a row"
            enabled={settings.stickyPositions}
            onChange={() => toggleRule('stickyPositions')}
          />

          {/* All-Star Bench Ratio */}
          <div className="bg-field/50 border border-border rounded-lg p-3">
            <div className="text-sm text-chalk font-semibold mb-1">All-Star Bench Ratio</div>
            <p className="text-[10px] text-chalk-muted mb-3">
              How much less often 4-5★ players bench compared to 1-3★ players. Higher = studs bench less.
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="1"
                max="3"
                step="0.5"
                value={settings.benchRatioTier2 ?? 1.5}
                onChange={e => setRuleValue('benchRatioTier2', Number(e.target.value))}
                className="flex-1 accent-lime"
              />
              <span className="text-sm font-bold text-lime w-12 text-right">
                {settings.benchRatioTier2 ?? 1.5}x
              </span>
            </div>
            <div className="flex justify-between text-[10px] text-chalk-muted mt-1">
              <span>1x (equal)</span>
              <span>1.5x</span>
              <span>2x</span>
              <span>2.5x</span>
              <span>3x (rarely)</span>
            </div>
          </div>

          {/* Default Game Length */}
          <div className="bg-field/50 border border-border rounded-lg p-3">
            <div className="text-sm text-chalk font-semibold mb-2">Default Game Length</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-chalk-muted">Innings per game:</span>
              <div className="flex gap-1">
                {[3, 4, 5, 6, 7, 8, 9].map(n => (
                  <button key={n}
                    onClick={async () => {
                      const modes = { ...(settings.defaultInningModes || {}) };
                      Object.keys(modes).forEach(k => { if (parseInt(k) >= n) delete modes[k]; });
                      await updateSettings({ defaultInnings: n, defaultInningModes: modes });
                      showSaved(`Default: ${n} innings`);
                    }}
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

            <div className="text-xs font-semibold text-chalk-muted uppercase tracking-wider mb-2">Default Inning Modes</div>
            <p className="text-[10px] text-chalk-muted mb-3">
              Set each inning's default mode. The last inning is always the Competitive/Developmental pocket card.
              You can override per game on the Defense tab.
            </p>
            <div className="flex gap-2 flex-wrap">
              {Array.from({ length: (settings.defaultInnings || 3) - 1 }, (_, i) => i + 1).map(ing => {
                const modes = settings.defaultInningModes || {};
                const mode = modes[ing] || 'competitive';
                const isDev = mode === 'development';
                return (
                  <button key={ing}
                    onClick={async () => {
                      const updated = { ...(settings.defaultInningModes || {}) };
                      updated[ing] = isDev ? 'competitive' : 'development';
                      await updateSettings({ defaultInningModes: updated });
                      showSaved(`Inning ${ing} → ${isDev ? 'Competitive' : 'Development'}`);
                    }}
                    className={`flex flex-col items-center px-3 py-2 rounded-lg border text-xs font-semibold transition-all
                      ${isDev
                        ? 'bg-gold/10 border-gold/25 text-gold'
                        : 'bg-lime/10 border-lime/25 text-lime'
                      }`}>
                    <span className="text-[10px] text-chalk-muted mb-0.5">Inn {ing}</span>
                    <span>{isDev ? '🔄 Dev' : '⚔️ Comp'}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </Section>

      {/* Position Minimum Ratings */}
      <Section title="⭐ Position Minimum Ratings">
        <p className="text-xs text-chalk-muted mb-4">
          Set a preferred minimum rating for each position. The rotation engine uses these as guidelines when auto-generating lineups. You can always manually override any assignment.
        </p>
        <div className="space-y-0.5">
          {ALL_POSITIONS.filter(p => p !== 'Pitcher').map(pos => {
            const currentMin = (settings.positionMinRatings || {})[pos] || 0;
            return (
              <div key={pos} className="flex items-center gap-3 py-0.5">
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

      {/* Suggestion Box */}
      <Section title="💡 Suggestion Box">
        <p className="text-xs text-chalk-muted mb-3">
          Have an idea or feature request? We'd love to hear from you.
        </p>
        <textarea
          id="feedback-text"
          rows={3}
          placeholder="What would make this app better for you?"
          className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                     placeholder:text-chalk-muted/40 focus:border-lime focus:outline-none resize-none mb-3"
        />
        <button
          onClick={async () => {
            const text = document.getElementById('feedback-text')?.value?.trim();
            if (!text) return;
            try {
              const { collection, addDoc, serverTimestamp } = await import('firebase/firestore');
              const { db } = await import('../../lib/firebase');
              await addDoc(collection(db, 'feedback'), {
                message: text,
                email: user?.email || '',
                displayName: user?.displayName || '',
                teamName: team?.name || '',
                createdAt: serverTimestamp(),
              });
              document.getElementById('feedback-text').value = '';
              showSaved('Thanks! Message sent.');
            } catch (err) {
              console.error('Feedback error:', err);
            }
          }}
          className="px-4 py-2 rounded-lg bg-lime text-field font-bold text-sm
                     hover:bg-lime-bright active:scale-[0.97] transition-all">
          📨 Send Feedback
        </button>
      </Section>

      {/* Danger Zone */}
      <Section title="⚠️ Danger Zone">
        <p className="text-xs text-chalk-muted mb-3">
          Permanently delete this team and all its data — players, games, at-bats, everything. This cannot be undone.
        </p>
        <button
          onClick={async () => {
            if (!confirm(`Delete "${team?.name}"? This will permanently remove all players, games, and at-bat data.`)) return;
            if (!confirm('This CANNOT be undone. Are you absolutely sure?')) return;
            await deleteTeam();
            window.location.reload();
          }}
          className="px-4 py-2 rounded-lg bg-red/15 text-red font-bold text-sm border border-red/30
                     hover:bg-red/25 active:scale-[0.97] transition-all">
          🗑 Delete Team
        </button>
      </Section>
    </div>
  );
}

// ── Reusable Components ──

function Section({ title, children }) {
  return (
    <div className="bg-panel border border-border rounded-xl shadow-sm p-4 mb-4">
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
