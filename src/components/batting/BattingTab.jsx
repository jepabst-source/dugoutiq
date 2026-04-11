import { useState, useMemo, useEffect } from 'react';
import { useTeam, PTS } from '../../contexts/TeamContext';
import { usePlan } from '../../hooks/usePlan';
import UpgradeModal from '../shared/UpgradeModal';
import InfoTip from '../shared/InfoTip';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
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


export default function BattingTab() {
  const {
    players, atBats, attendance, team,
    generateBattingOrder, getActivePlayers,
    setAllAttendance, toggleAttendance,
    logAtBat, deleteAtBat, getRollingAvg, getPlayerStats,
    updateSettings,
  } = useTeam();

  const rollingWindow = team?.settings?.rollingWindow || 5;

  // Rehydrate manual batting order from localStorage on mount
  const cachedOrderIds = (() => {
    try { return JSON.parse(localStorage.getItem('dugoutiq_battingOrder') || 'null'); }
    catch { return null; }
  })();

  const [order, setOrder] = useState([]);
  const [generated, setGenerated] = useState(false);
  const [gameNum, setGameNum] = useState('1');
  const [selectedInning, setSelectedInning] = useState(1);
  const [showLog, setShowLog] = useState(false);
  const [sortMode, setSortMode] = useState('obp');
  const [manuallyReordered, setManuallyReordered] = useState(!!cachedOrderIds?.length);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const plan = usePlan(); // 'points' | 'obp'

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
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
      return { ...p, ...stats, avg: rolling.avg, avgAbs: rolling.absCount, rollingObp: rolling.obp };
    }).sort((a, b) => {
      if (sortMode === 'obp') {
        const aObp = a.rollingObp ?? -1;
        const bObp = b.rollingObp ?? -1;
        if (bObp !== aObp) return bObp - aObp;
        return b.defRating - a.defRating;
      }
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.pts !== a.pts) return b.pts - a.pts;
      return b.defRating - a.defRating;
    });
  }, [players, activePlayers, atBats, sortMode, rollingWindow]);

  // Set order from auto-generated if not manually reordered
  useState(() => {
    if (autoOrder.length && !generated) {
      setOrder(autoOrder);
      setGenerated(true);
    }
  });

  // Update order when autoOrder changes (new at-bats logged, attendance changed)
  useEffect(() => {
    if (!autoOrder.length) return;
    if (manuallyReordered && cachedOrderIds?.length) {
      // Rehydrate saved manual order — keep cached sequence, refresh stats from autoOrder
      const byId = Object.fromEntries(autoOrder.map(p => [p.id, p]));
      const reordered = cachedOrderIds.map(id => byId[id]).filter(Boolean);
      // Append any active players not in the cached order (e.g. attendance added since)
      const seen = new Set(cachedOrderIds);
      for (const p of autoOrder) if (!seen.has(p.id)) reordered.push(p);
      setOrder(reordered);
      setGenerated(true);
    } else if (!manuallyReordered) {
      setOrder(autoOrder);
      setGenerated(true);
    }
  }, [autoOrder]);

  // Persist manual order to localStorage so Print/Defense tabs can pick it up
  useEffect(() => {
    if (manuallyReordered && order.length) {
      localStorage.setItem('dugoutiq_battingOrder', JSON.stringify(order.map(p => p.id)));
    }
  }, [order, manuallyReordered]);

  const handleGenerate = () => {
    setOrder(autoOrder);
    setGenerated(true);
    setManuallyReordered(false);
    localStorage.removeItem('dugoutiq_battingOrder');
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
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-xl font-bold text-lime">Batting Order</h2>
        <button
          onClick={handleGenerate}
          className="px-4 py-2 rounded-lg bg-lime text-white font-bold text-sm
                     hover:bg-lime-bright active:scale-[0.97] transition-all"
        >
          ⚡ Refresh
        </button>
      </div>

      {/* Sort mode + rolling window — two rows on mobile */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-chalk-muted">Sort:</span>
          <div className="flex gap-0.5 bg-panel border border-border rounded-lg p-0.5">
            <button onClick={() => setSortMode('points')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all
                ${sortMode === 'points' ? 'bg-field-light text-lime' : 'text-chalk-muted hover:text-chalk'}`}>
              Points
            </button>
            <button onClick={() => setSortMode('obp')}
              className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all
                ${sortMode === 'obp' ? 'bg-field-light text-sky' : 'text-chalk-muted hover:text-chalk'}`}>
              OBP
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-chalk-muted">Last:</span>
          <div className="flex gap-0.5 bg-panel border border-border rounded-lg p-0.5">
            {[3, 5, 10].map(n => (
              <button key={n}
                onClick={() => updateSettings({ rollingWindow: n })}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all
                  ${rollingWindow === n ? 'bg-field-light text-lime' : 'text-chalk-muted hover:text-chalk'}`}>
                {n}
              </button>
            ))}
          </div>
          <InfoTip text="Fewer at-bats means more lineup shuffling game to game. More at-bats gives a steadier, more predictable order." />
        </div>
      </div>


      {/* Attendance */}
      <div className="bg-panel border border-border rounded-xl shadow-sm p-4 mb-4">
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
        <svg width="18" height="18" viewBox="0 0 14 14" fill="currentColor">
          <circle cx="4" cy="3" r="2"/><circle cx="10" cy="3" r="2"/>
          <circle cx="4" cy="7" r="2"/><circle cx="10" cy="7" r="2"/>
          <circle cx="4" cy="11" r="2"/><circle cx="10" cy="11" r="2"/>
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
        <div className="text-lg font-bold text-sky">
          {rolling.obp !== null ? rolling.obp.toFixed(3).replace(/^0/, '') : '—'}
          <span className="text-[10px] font-semibold text-sky/60 ml-0.5">OBP</span>
        </div>
        <div className="text-[10px] text-chalk-muted">{absNote}</div>
        {player.avgAbs > 0 && (
          <div className="text-[10px] text-lime">{avgDisplay} avg</div>
        )}
      </div>
    </div>
  );
}
