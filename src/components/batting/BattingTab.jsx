import { useState, useMemo, useEffect } from 'react';
import { useTeam, PTS } from '../../contexts/TeamContext';
import { usePlan } from '../../hooks/usePlan';
import UpgradeModal from '../shared/UpgradeModal';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const OUTCOME_LABELS = { K: 'Strikeout', out: 'Hit into Out', walk: 'Walk', hit: 'Hit' };

export default function BattingTab() {
  const {
    players, atBats, attendance,
    generateBattingOrder, getActivePlayers,
    setAllAttendance, toggleAttendance,
    logAtBat, deleteAtBat, getRollingAvg, getPlayerStats,
  } = useTeam();

  const [order, setOrder] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [gameNum, setGameNum] = useState('1');
  const [selectedInning, setSelectedInning] = useState(1);
  const [showLog, setShowLog] = useState(false);
  const [sortMode, setSortMode] = useState('points');
  const [manuallyReordered, setManuallyReordered] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const plan = usePlan(); // 'points' | 'obp'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const activePlayers = getActivePlayers();
  const activeCount = players.filter(p => attendance.has(p.id)).length;

  // Auto-generate on first render and when players/attendance change
  const autoOrder = useMemo(() => {
    if (!players.length) return [];
    const active = activePlayers;
    return [...active].map(p => {
      const stats = getPlayerStats(p.id);
      const rolling = getRollingAvg(p.id);
      return { ...p, ...stats, avg: rolling.avg, avgAbs: rolling.absCount };
    }).sort((a, b) => {
      if (sortMode === 'obp') {
        const aObp = a.obp ?? -1;
        const bObp = b.obp ?? -1;
        if (bObp !== aObp) return bObp - aObp;
        return b.defRating - a.defRating;
      }
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.pts !== a.pts) return b.pts - a.pts;
      return b.defRating - a.defRating;
    });
  }, [players, activePlayers, atBats, sortMode]);

  // Set order from auto-generated if not manually reordered
  useState(() => {
    if (autoOrder.length && !generated) {
      setOrder(autoOrder);
      setGenerated(true);
    }
  });

  // Update order when autoOrder changes (new at-bats logged, attendance changed)
  useEffect(() => {
    if (!manuallyReordered && autoOrder.length) {
      setOrder(autoOrder);
      setGenerated(true);
    }
  }, [autoOrder]);

  const handleGenerate = () => {
    setOrder(autoOrder);
    setGenerated(true);
    setManuallyReordered(false);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over?.id) {
      setOrder(prev => {
        const oldIndex = prev.findIndex(p => p.id === active.id);
        const newIndex = prev.findIndex(p => p.id === over.id);
        return arrayMove(prev, oldIndex, newIndex);
      });
      setManuallyReordered(true);
    }
  };

  const handleLogAtBat = async (outcome) => {
    const playerId = document.getElementById('ab-player-select')?.value;
    if (!playerId) return;
    if (!plan.canLogAtBat) { setShowUpgrade(true); return; }
    await logAtBat({ playerId, game: gameNum, inning: selectedInning, outcome });
  };

  // Recent at-bats for the log panel
  const recentAtBats = useMemo(() => {
    return atBats.slice(0, 40);
  }, [atBats]);

  return (
    <div>
      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} lockReason={plan.lockReason} />}
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-xl font-bold text-lime">Batting Order</h2>
          <p className="text-xs text-chalk-muted mt-0.5">
            {sortMode === 'points' ? 'Ranked by rolling average (last 5 ABs)' : 'Ranked by on-base percentage'} · Drag to reorder
          </p>
        </div>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 rounded-lg bg-gold text-field font-bold text-sm
                     hover:bg-gold-bright active:scale-[0.97] transition-all"
        >
          ⚡ Refresh Order
        </button>
      </div>

      {/* Sort mode toggle */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-xs text-chalk-muted">Sort by:</span>
        <div className="flex gap-1 bg-panel border border-border rounded-lg p-0.5">
          <button onClick={() => setSortMode('points')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
              ${sortMode === 'points' ? 'bg-field-light text-lime' : 'text-chalk-muted hover:text-chalk'}`}>
            Points System
          </button>
          <button onClick={() => setSortMode('obp')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
              ${sortMode === 'obp' ? 'bg-field-light text-sky' : 'text-chalk-muted hover:text-chalk'}`}>
            OBP
          </button>
        </div>
      </div>

      {/* Scoring legend */}
      {sortMode === 'points' ? (
        <div className="flex gap-2 flex-wrap mb-4 text-xs">
          <span className="px-2 py-1 rounded bg-red/15 text-red border border-red/25">K = 0 pts</span>
          <span className="px-2 py-1 rounded bg-chalk-muted/10 text-chalk-muted border border-border">Walk / Hit-Out = 1 pt</span>
          <span className="px-2 py-1 rounded bg-lime/15 text-lime border border-lime/25">Hit = 2 pts</span>
        </div>
      ) : (
        <div className="flex gap-2 flex-wrap mb-4 text-xs">
          <span className="px-2 py-1 rounded bg-sky/15 text-sky border border-sky/25">OBP = (Hits + Walks) ÷ At-Bats</span>
        </div>
      )}

      {/* Attendance */}
      <div className="bg-panel border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold text-lime uppercase tracking-wider">✅ Who's playing today?</span>
          <div className="flex gap-2">
            <button onClick={() => setAllAttendance(true)}
              className="px-2.5 py-1 text-xs font-semibold bg-border/50 text-chalk-dim rounded-md hover:bg-border transition-colors">
              All In
            </button>
            <button onClick={() => setAllAttendance(false)}
              className="px-2.5 py-1 text-xs font-semibold bg-border/50 text-chalk-dim rounded-md hover:bg-border transition-colors">
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
                  ${checked
                    ? 'border-lime/30 bg-lime/5 text-chalk'
                    : 'border-border bg-transparent text-chalk-muted'
                  }`}>
                <input type="checkbox" checked={checked}
                  onChange={() => toggleAttendance(p.id)}
                  className="w-3.5 h-3.5 accent-lime rounded" />
                {p.name}
              </label>
            );
          })}
        </div>
        <p className="text-xs text-chalk-muted mt-2">
          {activeCount} of {players.length} players in today's lineup
        </p>
      </div>

      {/* Batting Order List */}
      {order.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📊</div>
          <p className="text-chalk-muted">Add players to the roster to see the batting order</p>
        </div>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={order.map(p => p.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {order.map((player, index) => (
                <SortableBattingSlot key={player.id} player={player} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      {/* Log At-Bats Section */}
      <div className="mt-8 border-t border-border pt-6">
        <button onClick={() => setShowLog(!showLog)}
          className="flex items-center gap-2 text-sm font-bold text-lime mb-4 hover:text-lime-bright transition-colors">
          {showLog ? '▼' : '▶'} Log At-Bats
        </button>

        {showLog && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Log Form */}
            <div className="bg-panel border border-border rounded-xl p-4">
              <h3 className="text-xs font-bold text-lime uppercase tracking-wider mb-3">Record At-Bat</h3>

              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Game #</label>
                  <input type="text" value={gameNum} onChange={e => setGameNum(e.target.value)}
                    className="w-24 px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                               focus:border-lime focus:outline-none" />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Player</label>
                  <select id="ab-player-select"
                    className="w-full px-3 py-2 rounded-lg bg-field border border-border text-chalk text-sm
                               focus:border-lime focus:outline-none">
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Inning</label>
                  <div className="flex gap-1">
                    {[1,2,3,4,5,6,7,8,9].map(i => (
                      <button key={i} onClick={() => setSelectedInning(i)}
                        className={`w-8 h-8 rounded-md text-xs font-bold transition-all
                          ${selectedInning === i
                            ? 'bg-lime/20 border-lime text-lime border'
                            : 'border border-border text-chalk-muted hover:border-border-light'
                          }`}>
                        {i}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-chalk-muted uppercase tracking-wider mb-1">Outcome</label>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => handleLogAtBat('K')}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-red/15 text-red border border-red/25
                                 hover:bg-red/25 active:scale-95 transition-all">
                      K (0 pts)
                    </button>
                    <button onClick={() => handleLogAtBat('out')}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-dirt/15 text-dirt border border-dirt/25
                                 hover:bg-dirt/25 active:scale-95 transition-all">
                      Out (1 pt)
                    </button>
                    <button onClick={() => handleLogAtBat('walk')}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-sky/15 text-sky border border-sky/25
                                 hover:bg-sky/25 active:scale-95 transition-all">
                      Walk (1 pt)
                    </button>
                    <button onClick={() => handleLogAtBat('hit')}
                      className="px-3 py-2 text-xs font-bold rounded-lg bg-lime/15 text-lime border border-lime/25
                                 hover:bg-lime/25 active:scale-95 transition-all">
                      Hit (2 pts)
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent At-Bats Log */}
            <div className="bg-panel border border-border rounded-xl p-4">
              <h3 className="text-xs font-bold text-chalk-muted uppercase tracking-wider mb-3">At-Bat Log</h3>
              {recentAtBats.length === 0 ? (
                <p className="text-sm text-chalk-muted">No at-bats logged yet</p>
              ) : (
                <div className="space-y-1 max-h-80 overflow-y-auto">
                  {recentAtBats.map(ab => {
                    const p = players.find(x => x.id === ab.playerId);
                    const outcomeClass = {
                      K: 'bg-red/15 text-red border-red/25',
                      out: 'bg-dirt/15 text-dirt border-dirt/25',
                      walk: 'bg-sky/15 text-sky border-sky/25',
                      hit: 'bg-lime/15 text-lime border-lime/25',
                    }[ab.outcome] || '';
                    return (
                      <div key={ab.id} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-panel-hover text-sm">
                        <span className="text-chalk-dim">
                          {p?.name || '?'} · G{ab.game} I{ab.inning}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-[10px] font-bold uppercase rounded border ${outcomeClass}`}>
                            {OUTCOME_LABELS[ab.outcome]} +{PTS[ab.outcome]}
                          </span>
                          <button onClick={() => deleteAtBat(ab.id)}
                            className="text-chalk-muted hover:text-red text-xs transition-colors">
                            ✕
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sortable batting slot with drag handle ──

function SortableBattingSlot({ player, index }) {
  const { getRollingAvg, getPlayerStats } = useTeam();
  const rolling = getRollingAvg(player.id);
  const stats = getPlayerStats(player.id);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.85 : 1,
  };

  const avgDisplay = player.avgAbs > 0 ? player.avg.toFixed(2) : '—';
  const absNote = player.avgAbs > 0 ? `last ${player.avgAbs} AB${player.avgAbs !== 1 ? 's' : ''}` : 'no ABs yet';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-3 px-4 py-3 bg-panel border rounded-xl transition-colors
        ${isDragging ? 'border-lime shadow-lg shadow-lime/10' : 'border-border hover:border-lime/30'}`}
    >
      {/* Drag handle */}
      <div {...attributes} {...listeners}
        className="cursor-grab active:cursor-grabbing text-chalk-muted hover:text-chalk-dim touch-none select-none">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="1.5"/><circle cx="10" cy="3" r="1.5"/>
          <circle cx="4" cy="7" r="1.5"/><circle cx="10" cy="7" r="1.5"/>
          <circle cx="4" cy="11" r="1.5"/><circle cx="10" cy="11" r="1.5"/>
        </svg>
      </div>

      {/* Order number */}
      <div className={`text-2xl font-bold w-8 text-right select-none
        ${index < 3 ? 'text-lime/40' : 'text-lime/15'}`}>
        {index + 1}
      </div>

      {/* Player info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-chalk truncate">
          {player.name}
        </div>
        <div className="text-xs text-chalk-muted">
          {stats.totalAbs} career ABs · def {player.defRating}★
        </div>
      </div>

      {/* Stats */}
      <div className="text-right">
        <div className="text-lg font-bold text-lime">{avgDisplay}</div>
        <div className="text-[10px] text-chalk-muted">{absNote}</div>
        {stats.obp !== null && (
          <div className="text-[10px] text-sky">{stats.obp.toFixed(3).replace(/^0/, '')} OBP</div>
        )}
      </div>
    </div>
  );
}
