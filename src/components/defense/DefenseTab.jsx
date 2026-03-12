import { useState, useCallback, useMemo } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import { buildFullRotation, POSITIONS, INFIELD_POSITIONS, OUTFIELD_POSITIONS } from '../../utils/rotationEngine';

export default function DefenseTab() {
  const {
    players, team, attendance,
    getActivePlayers, setAllAttendance, toggleAttendance,
  } = useTeam();

  const settings = team?.settings || {};
  const [innings, setInnings] = useState({});
  const [lfg, setLfg] = useState(null);
  const [oor, setOor] = useState(null);
  const [gameNum, setGameNum] = useState('');
  const [gameDate, setGameDate] = useState(new Date().toISOString().split('T')[0]);
  const [totalInnings, setTotalInnings] = useState(settings.defaultInnings || 3);
  const [generated, setGenerated] = useState(false);

  const activePlayers = getActivePlayers();
  const activeCount = players.filter(p => attendance.has(p.id)).length;
  const standardInnings = totalInnings - 1; // Last inning is pocket card
  const benchCount = Math.max(0, activePlayers.length - 9);

  const handleGenerate = useCallback(() => {
    const result = buildFullRotation({
      players: activePlayers,
      standardInnings,
      settings,
      positionHistory: {}, // TODO: pull from saved games
    });
    setInnings(result.innings);
    setLfg(result.lfg);
    setOor(result.oor);
    setGenerated(true);
  }, [activePlayers, standardInnings, settings]);

  const handleSwap = useCallback((inning, position, newPlayerId) => {
    setInnings(prev => {
      const updated = { ...prev };
      updated[inning] = { ...updated[inning], [position]: newPlayerId || undefined };
      return updated;
    });
  }, []);

  const handleRegenerateLFG = () => {
    const result = buildFullRotation({ players: activePlayers, standardInnings: 0, settings, positionHistory: {} });
    setLfg(result.lfg);
  };

  const handleRegenerateOOR = () => {
    const result = buildFullRotation({ players: activePlayers, standardInnings: 0, settings, positionHistory: {} });
    setOor(result.oor);
  };

  const handleReshuffleInning = (ing) => {
    const result = buildFullRotation({ players: activePlayers, standardInnings, settings, positionHistory: {} });
    setInnings(prev => ({ ...prev, [ing]: result.innings[ing] || prev[ing] }));
  };

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-lime">Defensive Lineup</h2>
          <p className="text-xs text-chalk-muted mt-0.5">
            Auto-generates a {standardInnings}-inning rotation + final inning pocket card
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={handleGenerate}
            className="px-4 py-2 rounded-lg bg-border text-chalk font-bold text-sm
                       hover:bg-border-light active:scale-[0.97] transition-all">
            🔀 {generated ? 'Regenerate' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Rules info */}
      <div className="text-xs text-chalk-muted bg-lime/5 border-l-2 border-lime/30 px-3 py-2 rounded-r-lg mb-4">
        {settings.noBackToBackBench && '✓ No back-to-back bench'}
        {settings.infieldCapEnabled && ` · ✓ Max ${settings.infieldCapValue} infield innings`}
        {settings.devInningsEnabled && ` · ✓ Dev every ${settings.devInningCycle}${getOrdinalSuffix(settings.devInningCycle)} inning`}
        {Object.entries(settings.positionMinRatings || {}).map(([pos, min]) =>
          ` · ${pos} ${min}★+`
        ).join('')}
      </div>

      {/* Attendance */}
      <div className="bg-panel border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-lime uppercase tracking-wider">✅ Who's playing today?</span>
          <div className="flex gap-2">
            <button onClick={() => setAllAttendance(true)}
              className="px-2.5 py-1 text-xs font-semibold bg-border/50 text-chalk-dim rounded-md hover:bg-border">
              All In
            </button>
            <button onClick={() => setAllAttendance(false)}
              className="px-2.5 py-1 text-xs font-semibold bg-border/50 text-chalk-dim rounded-md hover:bg-border">
              Clear
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {players.map(p => {
            const checked = attendance.has(p.id);
            return (
              <label key={p.id}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all text-sm
                  ${checked ? 'border-lime/30 bg-lime/5 text-chalk' : 'border-border text-chalk-muted'}`}>
                <input type="checkbox" checked={checked}
                  onChange={() => toggleAttendance(p.id)}
                  className="w-3.5 h-3.5 accent-lime rounded" />
                {p.name}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-chalk-muted mt-2">
          {activeCount} of {players.length} players · {benchCount > 0 ? `${benchCount} bench per inning` : 'no bench needed'}
        </p>
      </div>

      {/* Game setup row */}
      <div className="flex gap-3 items-end flex-wrap mb-5">
        <div>
          <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Game #</label>
          <input type="text" value={gameNum} onChange={e => setGameNum(e.target.value)}
            placeholder="e.g. 1"
            className="w-20 px-3 py-2 rounded-lg bg-panel border border-border text-chalk text-sm focus:border-lime focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Date</label>
          <input type="date" value={gameDate} onChange={e => setGameDate(e.target.value)}
            className="px-3 py-2 rounded-lg bg-panel border border-border text-chalk text-sm focus:border-lime focus:outline-none" />
        </div>
        <div>
          <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Innings</label>
          <div className="flex gap-1">
            {[3, 4, 5, 6, 7, 8, 9].map(n => (
              <button key={n} onClick={() => { setTotalInnings(n); setGenerated(false); }}
                className={`w-8 h-8 rounded-md text-xs font-bold transition-all
                  ${totalInnings === n
                    ? 'bg-lime/20 border-lime text-lime border'
                    : 'border border-border text-chalk-muted hover:border-border-light'
                  }`}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inning Cards */}
      {!generated ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🛡️</div>
          <p className="text-chalk-muted">Set attendance and innings, then click <strong className="text-chalk">Generate</strong></p>
        </div>
      ) : (
        <div className="space-y-5">
          {/* Standard innings */}
          {Array.from({ length: standardInnings }, (_, i) => i + 1).map(ing => {
            const isDevInning = settings.devInningsEnabled && ing % (settings.devInningCycle || 3) === 0;
            const asgn = innings[ing] || {};

            return (
              <InningCard
                key={ing}
                inning={ing}
                assignment={asgn}
                isDevInning={isDevInning}
                players={activePlayers}
                benchCount={benchCount}
                onSwap={(pos, pid) => handleSwap(ing, pos, pid)}
                onReshuffle={() => handleReshuffleInning(ing)}
                allInnings={innings}
                noBackToBack={settings.noBackToBackBench}
              />
            );
          })}

          {/* Final Inning Pocket Cards */}
          <div className="border-t border-border pt-5 mt-6">
            <div className="text-xs font-bold text-chalk-muted uppercase tracking-widest mb-4">
              INNING {totalInnings} — POCKET CARD
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PocketCard
                label="LFG"
                sublabel="WIN MODE"
                assignment={lfg}
                players={activePlayers}
                benchCount={benchCount}
                accentClass="text-lime border-lime/30 bg-lime/5"
                onRegenerate={handleRegenerateLFG}
              />
              <PocketCard
                label="OOR"
                sublabel="SHUFFLE"
                assignment={oor}
                players={activePlayers}
                benchCount={benchCount}
                accentClass="text-chalk-muted border-border bg-panel-hover"
                onRegenerate={handleRegenerateOOR}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inning Card Component ──

function InningCard({ inning, assignment, isDevInning, players, benchCount, onSwap, onReshuffle, allInnings, noBackToBack }) {
  const benchPositions = POSITIONS.bench.slice(0, benchCount);

  // Check for back-to-back bench warnings
  const benchWarnings = [];
  if (noBackToBack && inning > 1) {
    for (const bp of benchPositions) {
      const pid = assignment[bp];
      if (!pid) continue;
      const prevAsgn = allInnings[inning - 1] || {};
      const wasBenched = Object.entries(prevAsgn).some(([pos, id]) => id === pid && pos.startsWith('Bench'));
      if (wasBenched) {
        const p = players.find(x => x.id === pid);
        if (p) benchWarnings.push(p.name);
      }
    }
  }

  return (
    <div className="bg-panel border border-border rounded-xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-field-light border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-lime tracking-wider">INNING {inning}</span>
          {isDevInning && (
            <span className="px-2 py-0.5 text-[9px] font-bold uppercase bg-gold/15 text-gold border border-gold/25 rounded tracking-wider">
              DEV
            </span>
          )}
        </div>
        <button onClick={onReshuffle}
          className="px-2.5 py-1 text-xs font-semibold bg-border/50 text-chalk-dim rounded-md hover:bg-border transition-colors">
          🔀 Reshuffle
        </button>
      </div>

      {/* Positions grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
        {/* Infield */}
        <div className="p-3">
          <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mb-2">Infield</div>
          {POSITIONS.infield.map(pos => (
            <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="infield" />
          ))}
        </div>

        {/* Outfield + Bench */}
        <div className="p-3">
          <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mb-2">Outfield</div>
          {POSITIONS.outfield.map(pos => (
            <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="outfield" />
          ))}

          {benchPositions.length > 0 && (
            <>
              <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mt-3 mb-2">Bench</div>
              {benchPositions.map(pos => (
                <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="bench" />
              ))}
            </>
          )}

          {benchWarnings.length > 0 && (
            <div className="mt-2 px-2 py-1.5 text-[11px] text-red bg-red/10 border border-red/20 rounded-lg">
              ⚠ {benchWarnings.join(', ')} benched back-to-back!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Position Row (with swap dropdown) ──

function PositionRow({ pos, playerId, players, onSwap, type }) {
  const player = players.find(p => p.id === playerId);
  const isCatcher = pos === 'Catcher';

  const typeColors = {
    infield: 'bg-sky/15 text-sky border-sky/25',
    outfield: 'bg-gold/15 text-gold border-gold/25',
    bench: 'bg-chalk-muted/10 text-chalk-muted border-border',
  };

  return (
    <div className="flex items-center gap-2 mb-1.5">
      <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded border tracking-wide w-20 text-center ${typeColors[type]}`}>
        {pos.startsWith('Bench') ? 'Bench' : pos}
      </span>
      <select
        value={playerId || ''}
        onChange={e => onSwap(pos, e.target.value)}
        className="flex-1 px-2 py-1.5 rounded-md bg-field border border-border text-chalk text-xs
                   focus:border-lime focus:outline-none"
      >
        <option value="">— —</option>
        {players.map(p => (
          <option key={p.id} value={p.id}>
            {p.name}{isCatcher ? (p.canCatch ? ' 🎯' : ' ⚠') : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

// ── Pocket Card (LFG / OOR) ──

function PocketCard({ label, sublabel, assignment, players, benchCount, accentClass, onRegenerate }) {
  if (!assignment) return null;

  const benchPositions = POSITIONS.bench.slice(0, benchCount);
  const allPositions = [...POSITIONS.infield, ...POSITIONS.outfield, ...benchPositions];

  return (
    <div className={`border rounded-xl overflow-hidden ${accentClass}`}>
      <div className="flex items-center justify-between px-4 py-2.5 bg-field-light border-b border-border">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold tracking-wider">
            {label === 'LFG' ? '⚡' : '🔄'} {label}
          </span>
          <span className="px-2 py-0.5 text-[9px] font-bold uppercase border rounded tracking-wider opacity-70">
            {sublabel}
          </span>
        </div>
        <button onClick={onRegenerate}
          className="px-2.5 py-1 text-xs font-semibold bg-border/50 text-chalk-dim rounded-md hover:bg-border transition-colors">
          🔀
        </button>
      </div>
      <div className="p-3">
        {allPositions.map(pos => {
          const pid = assignment[pos];
          const player = players.find(p => p.id === pid);
          const isBench = pos.startsWith('Bench');
          if (!pid) return null;
          return (
            <div key={pos} className={`flex items-center gap-2 py-1 text-xs ${isBench ? 'opacity-50' : ''}`}>
              <span className="w-20 text-chalk-muted font-semibold">{isBench ? 'Bench' : pos}</span>
              <span className="text-chalk">{player?.name || '—'}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Utility ──

function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
