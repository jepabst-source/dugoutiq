import { useState, useMemo, useCallback } from 'react';
import { useTeam, PTS } from '../../contexts/TeamContext';

const OUTCOME_LABELS = { K: 'Strikeout', out: 'Hit into Out', walk: 'Walk', hit: 'Hit' };

export default function GameDayTab() {
  const {
    players, atBats, attendance,
    getActivePlayers, generateBattingOrder,
    logAtBat, deleteAtBat, getRollingAvg,
  } = useTeam();

  const [selectedPlayerId, setSelectedPlayerId] = useState(null);
  const [currentInning, setCurrentInning] = useState(1);
  const [gameNum, setGameNum] = useState(() => `gd-${new Date().toISOString().split('T')[0]}`);
  const [ourScore, setOurScore] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [theirScore, setTheirScore] = useState([0, 0, 0, 0, 0, 0, 0, 0, 0]);

  const activePlayers = getActivePlayers();
  const battingOrder = useMemo(() => generateBattingOrder(), [generateBattingOrder]);

  // At-bats for this game only
  const gameAtBats = useMemo(() =>
    atBats.filter(ab => ab.game === gameNum),
    [atBats, gameNum]
  );

  const inningAtBats = useMemo(() =>
    gameAtBats.filter(ab => ab.inning === currentInning),
    [gameAtBats, currentInning]
  );

  // Count ABs per player this game
  const playerAbCounts = useMemo(() => {
    const counts = {};
    gameAtBats.forEach(ab => { counts[ab.playerId] = (counts[ab.playerId] || 0) + 1; });
    return counts;
  }, [gameAtBats]);

  const ourTotal = ourScore.reduce((a, b) => a + b, 0);
  const theirTotal = theirScore.reduce((a, b) => a + b, 0);

  const handleRecord = useCallback(async (outcome) => {
    if (!selectedPlayerId) return;
    await logAtBat({
      playerId: selectedPlayerId,
      game: gameNum,
      inning: currentInning,
      outcome,
    });
    setSelectedPlayerId(null);
  }, [selectedPlayerId, gameNum, currentInning, logAtBat]);

  const handleUndo = useCallback(async () => {
    if (inningAtBats.length === 0) return;
    const last = inningAtBats[0]; // already sorted newest first
    await deleteAtBat(last.id);
  }, [inningAtBats, deleteAtBat]);

  const selectedPlayer = selectedPlayerId ? battingOrder.find(p => p.id === selectedPlayerId) : null;
  const selectedIndex = selectedPlayer ? battingOrder.indexOf(selectedPlayer) + 1 : 0;
  const selectedRolling = selectedPlayer ? getRollingAvg(selectedPlayer.id) : null;

  const adjustScore = (team, inning, delta) => {
    const setter = team === 'ours' ? setOurScore : setTheirScore;
    setter(prev => {
      const next = [...prev];
      next[inning] = Math.max(0, (next[inning] || 0) + delta);
      return next;
    });
  };

  return (
    <div className="max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-lime">⚾ Game Day</h2>
      </div>

      {/* Score Bar */}
      <div className="bg-panel border border-border rounded-xl p-3 mb-4">
        <div className="flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest">Us</div>
            <div className="text-3xl font-bold text-chalk">{ourTotal}</div>
            <div className="flex gap-1 mt-1">
              <button onClick={() => adjustScore('ours', currentInning - 1, -1)}
                className="w-6 h-6 rounded-full border border-border text-chalk-muted text-sm flex items-center justify-center hover:border-lime hover:text-lime transition-colors">
                −
              </button>
              <button onClick={() => adjustScore('ours', currentInning - 1, 1)}
                className="w-6 h-6 rounded-full border border-border text-chalk-muted text-sm flex items-center justify-center hover:border-lime hover:text-lime transition-colors">
                +
              </button>
            </div>
          </div>

          <div className="text-xl font-bold text-border-light">:</div>

          <div className="text-center">
            <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest">Them</div>
            <div className="text-3xl font-bold text-chalk">{theirTotal}</div>
            <div className="flex gap-1 mt-1">
              <button onClick={() => adjustScore('theirs', currentInning - 1, -1)}
                className="w-6 h-6 rounded-full border border-border text-chalk-muted text-sm flex items-center justify-center hover:border-lime hover:text-lime transition-colors">
                −
              </button>
              <button onClick={() => adjustScore('theirs', currentInning - 1, 1)}
                className="w-6 h-6 rounded-full border border-border text-chalk-muted text-sm flex items-center justify-center hover:border-lime hover:text-lime transition-colors">
                +
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Inning Tracker */}
      <div className="flex gap-1.5 justify-center mb-4 flex-wrap">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(i => {
          const hasABs = gameAtBats.some(ab => ab.inning === i);
          return (
            <button key={i} onClick={() => setCurrentInning(i)}
              className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all
                ${currentInning === i
                  ? 'border-lime text-lime bg-lime/10'
                  : hasABs
                    ? 'border-border-light text-border-light bg-lime/5'
                    : 'border-border text-chalk-muted'
                }`}>
              {i}
            </button>
          );
        })}
      </div>

      {/* NOW BATTING Card (shown when a player is selected) */}
      {selectedPlayer && (
        <div className="bg-panel border-2 border-lime rounded-2xl p-6 text-center mb-4 relative"
             style={{ boxShadow: '0 0 30px rgba(142,212,49,0.1)' }}>
          <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-[0.2em] mb-1">NOW BATTING</div>
          <div className="absolute top-3 right-5 text-5xl font-bold text-lime/10 select-none">{selectedIndex}</div>
          <div className="text-3xl font-bold text-chalk mb-1 tracking-tight">{selectedPlayer.name}</div>
          <div className="text-sm text-chalk-muted mb-5">
            avg {selectedRolling?.absCount > 0 ? selectedRolling.avg.toFixed(2) : '—'}
            {' · '}
            {playerAbCounts[selectedPlayer.id] || 0} AB{(playerAbCounts[selectedPlayer.id] || 0) !== 1 ? 's' : ''} today
          </div>

          {/* Outcome buttons */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <button onClick={() => handleRecord('K')}
              className="py-4 rounded-xl bg-red/10 border-2 border-red/25 text-red font-bold text-lg
                         hover:bg-red/20 active:scale-95 transition-all flex flex-col items-center gap-1">
              K
              <span className="text-[10px] font-normal opacity-70">strikeout · 0 pts</span>
            </button>
            <button onClick={() => handleRecord('hit')}
              className="py-4 rounded-xl bg-lime/10 border-2 border-lime/25 text-lime font-bold text-lg
                         hover:bg-lime/20 active:scale-95 transition-all flex flex-col items-center gap-1">
              HIT
              <span className="text-[10px] font-normal opacity-70">2 pts</span>
            </button>
            <button onClick={() => handleRecord('walk')}
              className="py-4 rounded-xl bg-sky/10 border-2 border-sky/25 text-sky font-bold text-lg
                         hover:bg-sky/20 active:scale-95 transition-all flex flex-col items-center gap-1">
              WALK
              <span className="text-[10px] font-normal opacity-70">1 pt</span>
            </button>
            <button onClick={() => handleRecord('out')}
              className="py-4 rounded-xl bg-dirt/10 border-2 border-dirt/25 text-dirt font-bold text-lg
                         hover:bg-dirt/20 active:scale-95 transition-all flex flex-col items-center gap-1">
              HIT-OUT
              <span className="text-[10px] font-normal opacity-70">fielded · 1 pt</span>
            </button>
          </div>

          <button onClick={() => setSelectedPlayerId(null)}
            className="w-full py-2 text-sm text-chalk-muted bg-border/30 rounded-lg hover:bg-border transition-colors">
            ✕ Cancel
          </button>
        </div>
      )}

      {/* Player Roster Grid (tap to select who's up) */}
      {!selectedPlayer && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          {battingOrder.map((p, idx) => {
            const abCount = playerAbCounts[p.id] || 0;
            return (
              <button key={p.id} onClick={() => setSelectedPlayerId(p.id)}
                className="text-left px-3 py-2.5 rounded-lg border border-border bg-panel
                           hover:border-lime/40 active:scale-[0.97] transition-all flex items-center gap-2">
                <span className="text-xs text-chalk-muted font-bold w-5">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-chalk truncate">{p.name}</div>
                  {abCount > 0 && (
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-lime tracking-widest">{'●'.repeat(Math.min(abCount, 5))}</span>
                      <span className="text-[10px] text-chalk-muted">{abCount} AB</span>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* This Inning's At-Bats Log */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-field-light border-b border-border">
          <span className="text-xs font-bold text-chalk-muted uppercase tracking-wider">
            Inning {currentInning} At-Bats
          </span>
          <button onClick={handleUndo}
            className="px-2 py-1 text-[10px] font-bold text-red bg-red/10 rounded hover:bg-red/20 transition-colors">
            ↩ Undo last
          </button>
        </div>
        <div className="max-h-48 overflow-y-auto">
          {inningAtBats.length === 0 ? (
            <div className="px-3 py-4 text-sm text-chalk-muted text-center">
              No at-bats this inning — tap a player above
            </div>
          ) : (
            inningAtBats.map(ab => {
              const p = players.find(x => x.id === ab.playerId);
              const outcomeClass = {
                K: 'bg-red/15 text-red border-red/25',
                out: 'bg-dirt/15 text-dirt border-dirt/25',
                walk: 'bg-sky/15 text-sky border-sky/25',
                hit: 'bg-lime/15 text-lime border-lime/25',
              }[ab.outcome] || '';
              return (
                <div key={ab.id} className="flex items-center justify-between px-3 py-2 border-b border-border/50 last:border-0">
                  <span className="text-sm text-chalk">{p?.name || '?'}</span>
                  <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${outcomeClass}`}>
                    {OUTCOME_LABELS[ab.outcome]} +{PTS[ab.outcome]}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Game totals */}
      {gameAtBats.length > 0 && (
        <div className="mt-4 bg-panel border border-border rounded-xl p-3">
          <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-wider mb-2">Game Summary</div>
          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <div>
              <div className="text-lg font-bold text-chalk">{gameAtBats.length}</div>
              <div className="text-chalk-muted">Total ABs</div>
            </div>
            <div>
              <div className="text-lg font-bold text-lime">{gameAtBats.filter(ab => ab.outcome === 'hit').length}</div>
              <div className="text-chalk-muted">Hits</div>
            </div>
            <div>
              <div className="text-lg font-bold text-red">{gameAtBats.filter(ab => ab.outcome === 'K').length}</div>
              <div className="text-chalk-muted">Strikeouts</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
