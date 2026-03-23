import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import { buildFullRotation, POSITIONS, INFIELD_POSITIONS, OUTFIELD_POSITIONS } from '../../utils/rotationEngine';
import { usePlan } from '../../hooks/usePlan';
import UpgradeModal from '../shared/UpgradeModal';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  DragOverlay,
} from '@dnd-kit/core';

export default function DefenseTab({ onNavigate }) {
  const {
    players, team, attendance,
    getActivePlayers, setAllAttendance, toggleAttendance,
    commitGame, getPositionHistory, generateBattingOrder,
  } = useTeam();

  const settings = team?.settings || {};
  const [innings, setInnings] = useState({});
  const [lfg, setLfg] = useState(null);
  const [oor, setOor] = useState(null);
  const [gameNum, setGameNum] = useState('');
  const [gameDate, setGameDate] = useState(new Date().toISOString().split('T')[0]);
  const [opponent, setOpponent] = useState('');
  const [totalInnings, setTotalInnings] = useState(settings.defaultInnings || 3);
  const [generated, setGenerated] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [committed, setCommitted] = useState(false);
  const [inningModes, setInningModes] = useState(() => settings.defaultInningModes || {});
  const [showUpgrade, setShowUpgrade] = useState(false);
  const plan = usePlan(); // { 1: 'competitive', 2: 'development', ... }

  const activePlayers = getActivePlayers();
  const activeCount = players.filter(p => attendance.has(p.id)).length;
  const standardInnings = totalInnings - 1;
  const benchCount = Math.max(0, activePlayers.length - 9);
  const positionHistory = getPositionHistory();

  // Auto-generate on first load when players exist
  useEffect(() => {
    if (activePlayers.length >= 9 && !generated) {
      const result = buildFullRotation({
        players: activePlayers,
        standardInnings,
        settings,
        positionHistory,
        inningModes,
      });
      setInnings(result.innings);
      setLfg(result.lfg);
      setOor(result.oor);
      setGenerated(true);
    }
  }, [activePlayers.length]);

  // Sync lineup to localStorage so Print tab can read it
  useEffect(() => {
    if (generated) {
      localStorage.setItem('dugoutiq_currentLineup', JSON.stringify({
        innings, lfg, oor, gameNum, gameDate, opponent, totalInnings,
      }));
    }
  }, [innings, lfg, oor, gameNum, gameDate, opponent, totalInnings, generated]);

  const toggleInningMode = (ing) => {
    setInningModes(prev => ({
      ...prev,
      [ing]: prev[ing] === 'development' ? 'competitive' : 'development'
    }));
  };

  const handleRepeatPrevious = (ing) => {
    if (ing <= 1) return;
    // Only repeat premium positions — never repeat bench assignments
    const LOCK_POSITIONS = ['Pitcher', '1st Base', '2nd Base', 'Shortstop'];

    setInnings(prev => {
      const prevInning = prev[ing - 1];
      if (!prevInning) return prev;
      const current = { ...prev[ing] };

      for (const pos of LOCK_POSITIONS) {
        const playerId = prevInning[pos];
        if (!playerId) continue;

        // Find where this player sits in the current inning
        const currentPos = Object.keys(current).find(k => current[k] === playerId);
        // Find who the engine placed at the target position
        const displaced = current[pos];

        // Swap them
        current[pos] = playerId;
        if (currentPos && displaced) {
          current[currentPos] = displaced;
        }
      }

      return { ...prev, [ing]: current };
    });
  };

  const handleGenerate = useCallback(() => {
    const result = buildFullRotation({
      players: activePlayers,
      standardInnings,
      settings,
      positionHistory,
      inningModes,
    });
    setInnings(result.innings);
    setLfg(result.lfg);
    setOor(result.oor);
    setGenerated(true);
  }, [activePlayers, standardInnings, settings, inningModes]);

  const handleSwap = useCallback((inning, position, newPlayerId) => {
    setInnings(prev => {
      const updated = { ...prev };
      const inningAssignment = { ...updated[inning] };
      
      if (newPlayerId) {
        const oldPosition = Object.keys(inningAssignment).find(
          pos => inningAssignment[pos] === newPlayerId && pos !== position
        );
        const displacedPlayerId = inningAssignment[position];
        
        inningAssignment[position] = newPlayerId;
        
        if (oldPosition) {
          inningAssignment[oldPosition] = displacedPlayerId || undefined;
        }
      } else {
        inningAssignment[position] = undefined;
      }
      
      updated[inning] = inningAssignment;

      // Cascade: regenerate all innings after the changed one
      if (inning < standardInnings) {
        const result = buildFullRotation({
          players: activePlayers,
          standardInnings,
          settings,
          positionHistory,
          inningModes,
        });
        // Keep innings 1 through current inning locked, replace the rest
        for (let i = inning + 1; i <= standardInnings; i++) {
          if (result.innings[i]) {
            updated[i] = result.innings[i];
          }
        }
      }

      return updated;
    });
  }, [activePlayers, standardInnings, settings, positionHistory, inningModes]);

  const handleRegenerateLFG = () => {
    const result = buildFullRotation({ players: activePlayers, standardInnings: 0, settings, positionHistory });
    setLfg(result.lfg);
  };

  const handleRegenerateOOR = () => {
    const result = buildFullRotation({ players: activePlayers, standardInnings: 0, settings, positionHistory });
    setOor(result.oor);
  };

  const handleLfgSwap = (position, newPlayerId) => {
    setLfg(prev => {
      const updated = { ...prev };
      if (newPlayerId) {
        const oldPosition = Object.keys(updated).find(pos => updated[pos] === newPlayerId && pos !== position);
        const displacedPlayerId = updated[position];
        updated[position] = newPlayerId;
        if (oldPosition) updated[oldPosition] = displacedPlayerId || undefined;
      } else { updated[position] = undefined; }
      return updated;
    });
  };

  const handleOorSwap = (position, newPlayerId) => {
    setOor(prev => {
      const updated = { ...prev };
      if (newPlayerId) {
        const oldPosition = Object.keys(updated).find(pos => updated[pos] === newPlayerId && pos !== position);
        const displacedPlayerId = updated[position];
        updated[position] = newPlayerId;
        if (oldPosition) updated[oldPosition] = displacedPlayerId || undefined;
      } else { updated[position] = undefined; }
      return updated;
    });
  };

  const handleReshuffleInning = (ing) => {
    const result = buildFullRotation({ players: activePlayers, standardInnings, settings, positionHistory, inningModes });
    setInnings(prev => ({ ...prev, [ing]: result.innings[ing] || prev[ing] }));
  };


  const handleCommitGame = useCallback(async () => {
    if (!generated) return;
    if (!plan.canCommitGame) { setShowUpgrade(true); return; }
    setCommitting(true);
    try {
      const order = generateBattingOrder();
      await commitGame({
        gameNumber: gameNum ? parseInt(gameNum) : undefined,
        date: gameDate,
        innings: totalInnings,
        opponent,
        lineups: innings,
        battingOrder: order.map(p => p.id),
        score: { ours: [], theirs: [] },
      });
      setCommitted(true);
      setTimeout(() => setCommitted(false), 3000);
    } catch (err) {
      console.error('Failed to commit game:', err);
    }
    setCommitting(false);
  }, [generated, gameNum, gameDate, totalInnings, opponent, innings, commitGame, generateBattingOrder]);

  return (
    <div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} lockReason={plan.lockReason} />}
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-lime">Fielding Lineup</h2>
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
          {generated && (
            <button onClick={handleCommitGame} disabled={committing || committed}
              className={`px-4 py-2 rounded-lg font-bold text-sm active:scale-[0.97] transition-all
                ${committed
                  ? 'bg-lime/20 text-lime border border-lime/30'
                  : 'bg-lime text-field hover:bg-lime-bright'
                } disabled:opacity-60`}>
              {committed ? '✓ Committed!' : committing ? 'Saving...' : '✅ Commit Game'}
            </button>
          )}
        </div>
      </div>

      {/* Rules info */}
      <div className="flex items-start justify-between text-xs text-chalk-muted bg-lime/5 border-l-2 border-lime/30 px-3 py-2 rounded-r-lg mb-4">
        <span>
          {settings.noBackToBackBench && '✓ No back-to-back bench'}
          {settings.infieldCapEnabled && ` · ✓ Max ${settings.infieldCapValue} infield innings`}
          {` · Toggle ⚔️ Competitive / 🔄 Development per inning`}
          {Object.entries(settings.positionMinRatings || {}).map(([pos, min]) =>
            ` · ${pos} ${min}★+`
          ).join('')}
        </span>
        <button onClick={() => onNavigate('settings')}
          className="text-sky text-[11px] font-semibold shrink-0 ml-3 hover:underline">
          Edit
        </button>
      </div>

      {/* Attendance */}
      <div className="bg-panel border border-border rounded-xl shadow-sm p-4 mb-4">
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
          <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Opponent</label>
          <input type="text" value={opponent} onChange={e => setOpponent(e.target.value)}
            placeholder="vs..."
            className="w-32 px-3 py-2 rounded-lg bg-panel border border-border text-chalk text-sm focus:border-lime focus:outline-none" />
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
        <div className="space-y-3">
          {/* Standard innings */}
          {Array.from({ length: standardInnings }, (_, i) => i + 1).map(ing => {
            const mode = inningModes[ing] || 'competitive';
            const isDevInning = mode === 'development';
            const asgn = innings[ing] || {};

            return (
              <InningCard
                key={ing}
                inning={ing}
                assignment={asgn}
                isDevInning={isDevInning}
                mode={mode}
                players={activePlayers}
                benchCount={benchCount}
                onSwap={(pos, pid) => handleSwap(ing, pos, pid)}
                onReshuffle={() => handleReshuffleInning(ing)}
                onRepeatPrevious={() => handleRepeatPrevious(ing)}
                onToggleMode={() => toggleInningMode(ing)}
                allInnings={innings}
                noBackToBack={settings.noBackToBackBench}
              />
            );
          })}

          {/* Final Inning Pocket Cards */}
          <div className="border-t border-border pt-5 mt-6">
            <div className="text-xs font-bold text-chalk-muted uppercase tracking-widest mb-4">
              INNING {totalInnings} — POCKET CARD (Last Inning)
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PocketCard
                label="LFG"
                sublabel="WIN MODE"
                assignment={lfg}
                players={activePlayers}
                benchCount={benchCount}
                accentClass="text-lime border-lime bg-white"
                onRegenerate={handleRegenerateLFG}
                onSwap={handleLfgSwap}
              />
              <PocketCard
                label="OOR"
                sublabel="SHUFFLE"
                assignment={oor}
                players={activePlayers}
                benchCount={benchCount}
                accentClass="text-chalk-dim border-lime bg-white"
                onRegenerate={handleRegenerateOOR}
                onSwap={handleOorSwap}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Inning Card Component ──

function InningCard({ inning, assignment, isDevInning, mode, players, benchCount, onSwap, onReshuffle, onRepeatPrevious, onToggleMode, allInnings, noBackToBack }) {
  const benchPositions = POSITIONS.bench.slice(0, benchCount);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  // Find which position is being dragged so we can show an overlay
  const activePos = activeId;
  const activePlayerId = activePos ? assignment[activePos] : null;
  const activePlayer = activePlayerId ? players.find(p => p.id === activePlayerId) : null;

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const fromPos = active.id;
    const toPos = over.id;
    const draggedPlayerId = assignment[fromPos];
    if (draggedPlayerId) {
      onSwap(toPos, draggedPlayerId);
    }
  };

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
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}>
      <div className="bg-panel border border-border rounded-xl shadow-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-border rounded-t-xl">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-lime tracking-wider">INNING {inning}</span>
            {/* Mode toggle */}
            <button onClick={onToggleMode}
              className={`px-2 py-0.5 text-[9px] font-bold uppercase rounded border tracking-wider transition-all
                ${isDevInning
                  ? 'bg-gold/15 text-gold border-gold/25 hover:bg-gold/25'
                  : 'bg-lime/10 text-lime border-lime/25 hover:bg-lime/20'
                }`}>
              {isDevInning ? '🔄 Development' : '⚔️ Competitive'}
            </button>
          </div>
          <div className="flex gap-1.5">
            {inning > 1 && (
              <button onClick={onRepeatPrevious}
                className="px-2.5 py-1 text-xs font-semibold bg-border/50 text-chalk-dim rounded-md hover:bg-border transition-colors"
                title="Repeat P, SS, 2B, 1B from previous inning">
                🔒 Repeat
              </button>
            )}
            <button onClick={onReshuffle}
              className="px-2.5 py-1 text-xs font-semibold bg-border/50 text-chalk-dim rounded-md hover:bg-border transition-colors">
              🔀 Reshuffle
            </button>
          </div>
        </div>

        {/* Positions grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          {/* Infield */}
          <div className="px-3 py-2">
            <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mb-1">Infield</div>
            {POSITIONS.infield.map(pos => (
              <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="infield" isBeingDragged={activeId === pos} />
            ))}
          </div>

          {/* Outfield + Bench */}
          <div className="px-3 py-2">
            <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mb-1">Outfield</div>
            {POSITIONS.outfield.map(pos => (
              <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="outfield" isBeingDragged={activeId === pos} />
            ))}

            {benchPositions.length > 0 && (
              <>
                <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mt-2 mb-1">Bench</div>
                {benchPositions.map(pos => (
                  <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="bench" isBeingDragged={activeId === pos} />
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

      <DragOverlay dropAnimation={null}>
        {activePlayer ? (
          <div className="px-6 py-2.5 rounded-lg bg-lime text-white text-sm font-bold shadow-xl whitespace-nowrap min-w-[140px] text-center">
            {activePlayer.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Position Row (with drag handle + swap dropdown) ──

const SHORT_POS = {
  'Left Field': 'Left Fld',
  'Center Field': 'Center Fld',
  'Right Field': 'Right Fld',
};

function PositionRow({ pos, playerId, players, onSwap, type, isBeingDragged }) {
  const player = players.find(p => p.id === playerId);
  const isCatcher = pos === 'Catcher';
  const displayPos = pos.startsWith('Bench') ? 'Bench' : (SHORT_POS[pos] || pos);

  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: pos,
    disabled: !playerId,
  });

  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: pos });

  const isBattery = pos === 'Pitcher' || pos === 'Catcher';
  const typeColors = {
    infield: isBattery ? 'bg-sky text-white border-sky' : 'bg-sky/15 text-sky border-sky/25',
    outfield: 'bg-gold/15 text-gold border-gold/25',
    bench: 'bg-chalk-muted/10 text-chalk-muted border-border',
  };

  return (
    <div ref={setDropRef} className="flex items-center gap-1.5 mb-0.5">
      {/* Position label — never affected by drag */}
      <span className={`inline-block px-2 py-0.5 text-[9px] font-bold uppercase rounded border tracking-wide w-20 text-center shrink-0 ${typeColors[type]}`}>
        {displayPos}
      </span>

      {/* Player area — this is what greys out and highlights */}
      <div className={`flex items-center flex-1 min-w-0 rounded-md transition-all
        ${isOver ? 'ring-2 ring-lime/40 bg-lime/10' : ''}
        ${isBeingDragged ? 'opacity-25' : ''}`}>
        {/* Drag handle */}
        <div
          ref={setDragRef}
          {...listeners}
          {...attributes}
          className={`flex items-center justify-center w-5 h-6 shrink-0 select-none text-[10px]
            ${playerId ? 'text-chalk-muted/30 cursor-grab hover:text-chalk-muted active:cursor-grabbing' : 'text-transparent'}`}
          aria-label="Drag to swap"
        >
          ⠿
        </div>

        <select
          value={playerId || ''}
          onChange={e => onSwap(pos, e.target.value)}
          className="flex-1 px-2 py-1 rounded-md bg-field border border-border text-chalk text-xs
                     focus:border-lime focus:outline-none min-w-0 !min-h-7"
        >
          <option value="">— —</option>
          {players.map(p => (
            <option key={p.id} value={p.id}>
              {p.name}{isCatcher ? (p.canCatch ? ' 🎯' : ' ⚠') : ''}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// ── Pocket Card (LFG / OOR) ──

function PocketCard({ label, sublabel, assignment, players, benchCount, accentClass, onRegenerate, onSwap }) {
  if (!assignment) return null;

  const benchPositions = POSITIONS.bench.slice(0, benchCount);
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  );

  const activePlayerId = activeId ? assignment[activeId] : null;
  const activePlayer = activePlayerId ? players.find(p => p.id === activePlayerId) : null;

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const draggedPlayerId = assignment[active.id];
    if (draggedPlayerId) {
      onSwap(over.id, draggedPlayerId);
    }
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(e.active.id)}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}>
      <div className={`border rounded-xl ${accentClass}`}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-white border-b border-border rounded-t-xl">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-border">
          <div className="px-3 py-2">
            <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mb-1">Infield</div>
            {POSITIONS.infield.map(pos => (
              <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="infield" isBeingDragged={activeId === pos} />
            ))}
          </div>
          <div className="px-3 py-2">
            <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mb-1">Outfield</div>
            {POSITIONS.outfield.map(pos => (
              <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="outfield" isBeingDragged={activeId === pos} />
            ))}
            {benchPositions.length > 0 && (
              <>
                <div className="text-[10px] font-bold text-chalk-muted uppercase tracking-widest mt-2 mb-1">Bench</div>
                {benchPositions.map(pos => (
                  <PositionRow key={pos} pos={pos} playerId={assignment[pos]} players={players} onSwap={onSwap} type="bench" isBeingDragged={activeId === pos} />
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      <DragOverlay dropAnimation={null}>
        {activePlayer ? (
          <div className="px-6 py-2.5 rounded-lg bg-lime text-white text-sm font-bold shadow-xl whitespace-nowrap min-w-[140px] text-center">
            {activePlayer.name}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// ── Utility ──

function getOrdinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}
