import { useState } from 'react';
import { useTeam } from '../../contexts/TeamContext';
import { POSITIONS } from '../../utils/rotationEngine';

const ALL_POS = [...POSITIONS.infield, ...POSITIONS.outfield, 'Bench 1', 'Bench 2', 'Bench 3'];

export default function PrintTab() {
  const { team, players, generateBattingOrder, getActivePlayers } = useTeam();

  // We need to read lineups from a shared state. For now, store in localStorage
  // when defense tab generates/commits, and read here.
  const [refreshKey, setRefreshKey] = useState(0);

  const savedLineup = (() => {
    try { return JSON.parse(localStorage.getItem('dugoutiq_currentLineup') || 'null'); } catch { return null; }
  })();

  const innings = savedLineup?.innings || {};
  const lfg = savedLineup?.lfg || null;
  const oor = savedLineup?.oor || null;
  const gameNum = savedLineup?.gameNum || '—';
  const gameDate = savedLineup?.gameDate || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const opponent = savedLineup?.opponent || '';
  const totalInnings = savedLineup?.totalInnings || 3;
  const standardInnings = Object.keys(innings).length;

  const battingOrder = generateBattingOrder();
  const activePlayers = getActivePlayers();
  const benchCount = Math.max(0, activePlayers.length - 9);

  const getPlayerName = (pid) => {
    const p = players.find(x => x.id === pid);
    return p ? p.name : '—';
  };

  return (
    <div>
      {/* Controls — hidden in print */}
      <div className="flex gap-3 items-center mb-4 print:hidden">
        <h2 className="text-xl font-bold text-lime">Print Sheet</h2>
        <button onClick={() => window.print()}
          className="px-4 py-2 rounded-lg bg-lime text-field font-bold text-sm hover:bg-lime-bright active:scale-[0.97] transition-all">
          🖨 Print
        </button>
        <button onClick={() => setRefreshKey(k => k + 1)}
          className="px-3 py-2 rounded-lg bg-border text-chalk font-bold text-sm hover:bg-border-light transition-all">
          ↻ Refresh
        </button>
        <span className="text-xs text-chalk-muted hidden sm:inline">
          Page 1: dugout card · Page 2: pocket card (LFG / OOR)
        </span>
      </div>

      {!standardInnings ? (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">🖨</div>
          <p className="text-chalk-muted">Generate a defensive lineup on the Defense tab first, then come back here to print.</p>
        </div>
      ) : (
        /* Print Page */
        <div className="bg-white text-black rounded-lg p-6 max-w-[900px] mx-auto print:p-0 print:max-w-full print:rounded-none" style={{ fontFamily: "'DM Sans', Arial, sans-serif" }}>

          {/* PAGE 1 — DUGOUT CARD */}
          {/* Header */}
          <div className="flex items-center justify-between border-b-[3px] border-[#1a4332] pb-2 mb-4">
            <div className="text-2xl font-bold text-[#1a4332] tracking-tight">⚾ {team?.name || 'Dugout IQ'}</div>
            <div className="text-sm text-gray-500">
              Game {gameNum}{opponent ? ` vs ${opponent}` : ''} · {gameDate}
            </div>
          </div>

          {/* Grid: Batting (left) + Defense (right) */}
          <div className="grid grid-cols-[1fr_2fr] gap-5 print:gap-4">

            {/* Left column — Batting Order + Score */}
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#1a4332] border-b-[1.5px] border-[#1a4332] pb-1 mb-2">
                Batting Order
              </div>
              {battingOrder.map((p, i) => (
                <div key={p.id} className="flex items-baseline gap-2 py-[3px] border-b border-dotted border-gray-300 text-sm">
                  <span className="text-gray-400 font-bold w-5 text-right flex-shrink-0" style={{ fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                  <span className="font-semibold flex-1">{p.name}</span>
                  {p.number && <span className="text-xs text-gray-400">#{p.number}</span>}
                </div>
              ))}

              {/* Score blanks */}
              <div className="mt-5 pt-3 border-t border-gray-300">
                <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#1a4332] border-b-[1.5px] border-[#1a4332] pb-1 mb-2">
                  Score
                </div>
                <div className="grid grid-cols-2 gap-1 text-xs">
                  {Array.from({ length: totalInnings }, (_, i) => i + 1).map(i => (
                    <div key={i} className="flex items-center gap-1">
                      <span className="text-gray-500 w-10">Inn {i}:</span>
                      <span className="border-b border-gray-300 flex-1">&nbsp;</span>
                      <span className="border-b border-gray-300 flex-1">&nbsp;</span>
                    </div>
                  ))}
                </div>
                <div className="text-[9px] text-gray-400 mt-1">Us / Them per inning</div>
              </div>
            </div>

            {/* Right column — Defensive Lineup */}
            <div>
              <div className="text-xs font-bold uppercase tracking-[0.15em] text-[#1a4332] border-b-[1.5px] border-[#1a4332] pb-1 mb-2">
                Defensive Lineup — Innings 1–{standardInnings}
              </div>
              <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(standardInnings, 4)}, 1fr)` }}>
                {Array.from({ length: standardInnings }, (_, i) => i + 1).map(ing => {
                  const asgn = innings[ing] || {};
                  return (
                    <div key={ing}>
                      <div className="text-[10px] font-bold uppercase tracking-wider text-[#1a4332] mb-1">
                        Inning {ing}
                      </div>
                      {ALL_POS.filter(pos => !(pos.startsWith('Bench') && !asgn[pos])).map(pos => {
                        const pid = asgn[pos];
                        const isBench = pos.startsWith('Bench');
                        const isFirstBench = pos === 'Bench 1' && pid;
                        return (
                          <div key={pos} className={`flex gap-1 text-[11px] py-[2px] border-b border-dotted border-gray-200
                            ${isBench ? 'text-gray-400' : ''}
                            ${isFirstBench ? 'border-t-2 border-t-gray-400 mt-1 pt-1' : ''}`}>
                            <span className="text-gray-500 w-[70px] flex-shrink-0 text-[10px]">{isBench ? 'Bench' : pos}</span>
                            <span className="font-semibold">{pid ? getPlayerName(pid) : '—'}</span>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* PAGE 2 — POCKET CARD */}
          <div className="break-before-page border-t-[3px] border-dashed border-gray-300 mt-8 pt-6 print:mt-0 print:pt-6 print:border-0">
            <div className="flex items-center justify-between border-b-[3px] border-[#1a4332] pb-2 mb-4">
              <div className="text-lg font-bold text-[#1a4332]">⚾ {team?.name || 'Dugout IQ'} — Inning {totalInnings} Pocket Card</div>
              <div className="text-xs text-gray-500">Game {gameNum} · {gameDate}</div>
            </div>

            <div className="grid grid-cols-2 gap-6">
              {/* LFG */}
              <div>
                <div className="inline-block px-3 py-1 text-sm font-bold tracking-wider rounded bg-[#1a4332] text-white mb-3">
                  LFG
                </div>
                {lfg ? (
                  ALL_POS.filter(pos => lfg[pos]).map(pos => {
                    const isBench = pos.startsWith('Bench');
                    const isFirstBench = pos === 'Bench 1';
                    return (
                      <div key={pos} className={`flex gap-1 text-[12px] py-[3px] border-b border-dotted border-gray-200
                        ${isBench ? 'text-gray-400' : ''}
                        ${isFirstBench ? 'border-t-2 border-t-gray-400 mt-1 pt-1' : ''}`}>
                        <span className="text-gray-500 w-[80px] flex-shrink-0">{isBench ? 'Bench' : pos}</span>
                        <span className="font-semibold">{getPlayerName(lfg[pos])}</span>
                      </div>
                    );
                  })
                ) : <div className="text-xs text-gray-400">Generate lineup first</div>}
              </div>

              {/* OOR */}
              <div>
                <div className="inline-block px-3 py-1 text-sm font-bold tracking-wider rounded bg-gray-500 text-white mb-3">
                  OOR
                </div>
                {oor ? (
                  ALL_POS.filter(pos => oor[pos]).map(pos => {
                    const isBench = pos.startsWith('Bench');
                    const isFirstBench = pos === 'Bench 1';
                    return (
                      <div key={pos} className={`flex gap-1 text-[12px] py-[3px] border-b border-dotted border-gray-200
                        ${isBench ? 'text-gray-400' : ''}
                        ${isFirstBench ? 'border-t-2 border-t-gray-400 mt-1 pt-1' : ''}`}>
                        <span className="text-gray-500 w-[80px] flex-shrink-0">{isBench ? 'Bench' : pos}</span>
                        <span className="font-semibold">{getPlayerName(oor[pos])}</span>
                      </div>
                    );
                  })
                ) : <div className="text-xs text-gray-400">Generate lineup first</div>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
