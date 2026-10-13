import { useState, useMemo } from 'react';
import { useTeam, PTS, OUTCOME_SHORT, IS_K } from '../../contexts/TeamContext';
import { POSITIONS, getPositions } from '../../utils/rotationEngine';
import { isNative } from '../../services/platform';

// What counts as reaching base for OBP (mirrors TeamContext's IS_ON_BASE).
const IS_ON_BASE = { hit: true, single: true, double: true, triple: true, hr: true, walk: true, hbp: true };

// Prod over a slice of at-bats = OBP + points/AB, exactly as the season column
// computes it, just on a window. Null when the slice is empty.
function prodOf(abs) {
  if (!abs.length) return null;
  const pts = abs.reduce((s, a) => s + (PTS[a.outcome] ?? 0), 0);
  const onBase = abs.filter(a => IS_ON_BASE[a.outcome]).length;
  const obpAbs = abs.filter(a => a.outcome !== 'sac').length; // sac flies don't count
  const obp = obpAbs ? onBase / obpAbs : 0;
  return obp + pts / abs.length;
}

// Trailing rolling Prod at each at-bat, so the sparkline shows the shape of the
// season instead of a jagged per-AB spike.
function rollingProd(abs, w) {
  return abs.map((_, i) => prodOf(abs.slice(Math.max(0, i - w + 1), i + 1)));
}

// A player needs a full prior+recent window (20 ABs) for a trend read.
const TREND_MIN_ABS = 20;
// Prod moves smaller than this read as "steady" rather than a real trend.
const TREND_BAND = 0.12;
const trendClass = (d) => d == null ? 'text-sky' : d > TREND_BAND ? 'text-lime' : d < -TREND_BAND ? 'text-red' : 'text-chalk-muted';
const trendArrow = (d) => d == null ? '' : d > TREND_BAND ? '▲' : d < -TREND_BAND ? '▼' : '▬';

export default function HistoryTab() {
  const { team, players, atBats, savedGames, getPlayerStats, getRollingAvg, getPositionHistory, deleteGame, deleteAtBat, clearAllAtBats, setPocketCardUsed } = useTeam();
  const [clearing, setClearing] = useState(false);

  // Column visibility for the Season Batting Stats table — web-only coach
  // convenience, remembered per browser. Native always shows every column.
  const [hiddenCols, setHiddenCols] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('dugoutiq_history_hidden_cols') || '[]')); }
    catch { return new Set(); }
  });
  const toggleCol = (key) => setHiddenCols(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    try { localStorage.setItem('dugoutiq_history_hidden_cols', JSON.stringify([...next])); } catch {}
    return next;
  });
  const showCol = (key) => isNative() ? true : !hiddenCols.has(key);
  const positions = getPositions(team?.settings);
  const POS_ORDER = [...positions.infield, ...positions.outfield, 'Bench'];
  const rollWindow = team?.settings?.rollingWindow || 5;

  // Season trend — per player, the rolling-Prod shape across the season plus a
  // "last 10 ABs vs prior 10" delta so a hot streak or a slump stands out.
  const trendStats = useMemo(() => {
    return players.map(p => {
      const abs = atBats
        .filter(a => a.playerId === p.id)
        .sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0)); // oldest → newest
      const recent = abs.slice(-10);
      const prior = abs.slice(-20, -10);
      const trend = abs.length >= TREND_MIN_ABS ? prodOf(recent) - prodOf(prior) : null;
      return {
        id: p.id, name: p.name, abCount: abs.length,
        series: rollingProd(abs, rollWindow), trend, seasonProd: prodOf(abs),
      };
    })
    .filter(p => p.abCount > 0)
    .sort((a, b) => {
      // Climbers first; players without a full 20-AB read sink to the bottom.
      if ((a.trend == null) !== (b.trend == null)) return a.trend == null ? 1 : -1;
      if (a.trend != null) return b.trend - a.trend;
      return (b.seasonProd ?? 0) - (a.seasonProd ?? 0);
    });
  }, [players, atBats, rollWindow]);

  // Player stats summary
  const playerStats = useMemo(() => {
    return players.map(p => {
      const stats = getPlayerStats(p.id);
      const rolling = getRollingAvg(p.id);
      // Productivity = season OBP + season points-per-at-bat. Blends getting on
      // base with our point system so kids who swing & produce rank above
      // passive walkers. Uses existing points (all hits = 2), so it works the
      // same whether or not a team tracks doubles/triples/HRs.
      const productivity = stats.totalAbs > 0
        ? (stats.obp ?? 0) + stats.pts / stats.totalAbs
        : null;
      return { ...p, ...stats, avg: rolling.avg, avgAbs: rolling.absCount, productivity };
    }).sort((a, b) => b.defRating - a.defRating);
  }, [players, getPlayerStats, getRollingAvg]);

  // At-bat breakdown by game
  const gameGroups = useMemo(() => {
    const groups = {};
    atBats.forEach(ab => {
      if (!groups[ab.game]) groups[ab.game] = [];
      groups[ab.game].push(ab);
    });
    return Object.entries(groups)
      .sort(([, a], [, b]) => (b[0]?.timestamp || 0) - (a[0]?.timestamp || 0));
  }, [atBats]);

  const posHistory = getPositionHistory();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-lime">History & Stats</h2>
          <p className="text-xs text-chalk-muted mt-0.5">Position history, batting stats, and game log</p>
        </div>
      </div>

      {/* Position History Grid */}
      {Object.keys(posHistory).length > 0 && (
        <div className="bg-panel border border-border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-2.5 bg-field-light border-b border-border">
            <span className="text-xs font-bold text-lime uppercase tracking-wider">Position History (All Committed Games)</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider sticky left-0 bg-panel">Player</th>
                  {POS_ORDER.map(pos => (
                    <th key={pos} className="text-center px-1.5 py-2 text-[9px] font-bold text-chalk-muted uppercase tracking-wider whitespace-nowrap">
                      {pos.replace('Left Center', 'LC').replace('Right Center', 'RC')
                        .replace('Left Field', 'LF').replace('Center Field', 'CF').replace('Right Field', 'RF')
                        .replace('1st Base', '1B').replace('2nd Base', '2B').replace('3rd Base', '3B')
                        .replace('Shortstop', 'SS').replace('Pitcher', 'P').replace('Catcher', 'C')
                        .replace('Bench', 'BN')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...players].sort((a, b) => b.defRating - a.defRating).map(p => {
                  const hist = posHistory[p.id] || {};
                  const stats = getPlayerStats(p.id);
                  return (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-panel-hover">
                      <td className="px-2 py-1.5 font-semibold text-chalk whitespace-nowrap sticky left-0 bg-panel">
                        {p.name}
                        <span className="ml-1 text-gold text-[10px]">{p.defRating}★</span>
                        {stats.obp !== null && <span className="ml-1 text-sky text-[10px]">{stats.obp.toFixed(3).replace(/^0/, '')}</span>}
                      </td>
                      {POS_ORDER.map(pos => {
                        const count = pos === 'Bench'
                          ? (hist['Bench 1'] || 0) + (hist['Bench 2'] || 0) + (hist['Bench 3'] || 0)
                          : (hist[pos] || 0);
                        const isInfield = POSITIONS.infield.includes(pos);
                        const isOutfield = POSITIONS.outfield.includes(pos);
                        const isBench = pos === 'Bench';
                        const colorClass = count === 0 ? 'text-border'
                          : isInfield ? 'text-sky'
                          : isOutfield ? 'text-gold'
                          : isBench ? 'text-chalk-muted'
                          : 'text-chalk';
                        return (
                          <td key={pos} className={`text-center px-1.5 py-1.5 font-bold ${colorClass}`}>
                            {count || '·'}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Committed Games History */}
      {savedGames.length > 0 && (
        <div className="bg-panel border border-border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-2.5 bg-field-light border-b border-border">
            <span className="text-xs font-bold text-chalk-muted uppercase tracking-wider">Committed Games ({savedGames.length})</span>
          </div>
          <div className="divide-y divide-border/50">
            {savedGames.map(game => (
              <div key={game.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-bold text-lime">Game {game.gameNumber}</span>
                    <span className="text-xs text-chalk-muted ml-2">{game.date}</span>
                    {game.opponent && <span className="text-xs text-chalk-dim ml-2">vs {game.opponent}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-chalk-muted">{game.innings} innings</span>
                    <button onClick={() => { if (confirm(`Delete Game ${game.gameNumber}?`)) deleteGame(game.id); }}
                      className="px-2 py-0.5 text-[10px] font-bold text-red bg-red/10 border border-red/20 rounded hover:bg-red/20 transition-colors">
                      ✕
                    </button>
                  </div>
                </div>
                {/* Show lineup summary */}
                <div className="flex gap-2 flex-wrap">
                  {Object.entries(game.lineups || {}).map(([ing, asgn]) => (
                    <div key={ing} className="text-[9px] text-chalk-muted">
                      <span className="font-bold text-chalk-dim">I{ing}:</span>{' '}
                      {Object.entries(asgn).filter(([pos]) => !pos.startsWith('Bench')).map(([pos, pid]) => {
                        const p = players.find(x => x.id === pid);
                        const shortPos = pos.replace('Left Center', 'LC').replace('Right Center', 'RC')
                          .replace('Left Field', 'LF').replace('Center Field', 'CF').replace('Right Field', 'RF')
                          .replace('1st Base', '1B').replace('2nd Base', '2B').replace('3rd Base', '3B')
                          .replace('Shortstop', 'SS').replace('Pitcher', 'P').replace('Catcher', 'C');
                        return `${shortPos}:${p?.name?.slice(0, 6) || '?'}`;
                      }).join(' ')}
                    </div>
                  ))}
                </div>
                {/* Post-game: record which final-inning pocket card was played,
                    so its positions + bench sits feed the fairness engine. */}
                {(game.lfg || game.oor) && (
                  <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                    <span className="text-[9px] font-bold text-chalk-muted uppercase tracking-wider mr-0.5">Final inning played:</span>
                    {[
                      { key: 'lfg', label: 'Competitive' },
                      { key: 'oor', label: 'Developmental' },
                      { key: 'none', label: "Didn't play" },
                    ].map(opt => {
                      const active = game.pocketCardUsed === opt.key;
                      return (
                        <button key={opt.key}
                          onClick={() => setPocketCardUsed(game.id, opt.key)}
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                            active
                              ? 'bg-lime text-field border-lime'
                              : 'text-chalk-muted border-border hover:bg-field-light'
                          }`}>
                          {opt.label}
                        </button>
                      );
                    })}
                    {game.pocketCardUsed == null && (
                      <span className="text-[9px] font-bold text-gold-bright bg-gold/15 border border-gold/30 rounded px-1.5 py-0.5">
                        ⚠ not recorded
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season Batting Stats Table */}
      <div className="bg-panel border border-border rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-4 py-2.5 bg-field-light border-b border-border">
          <span className="text-xs font-bold text-lime uppercase tracking-wider">Season Batting Stats</span>
        </div>
        {/* Column toggles — web only (coach convenience, saved per browser). */}
        {!isNative() && (
          <div className="flex flex-wrap items-center gap-1.5 px-4 py-2 border-b border-border/60 bg-field/40">
            <span className="text-[10px] font-bold text-chalk-muted uppercase tracking-wider mr-1">Columns:</span>
            {[['form', 'Form'], ['abs', 'ABs'], ['pts', 'Pts'], ['obp', 'OBP'], ['prod', 'Prod'], ['games', 'Games']].map(([key, label]) => (
              <button key={key} onClick={() => toggleCol(key)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded border transition-colors ${
                  showCol(key) ? 'bg-lime/15 text-lime border-lime/40' : 'text-chalk-muted border-border hover:bg-field-light'
                }`}>
                {showCol(key) ? '✓ ' : ''}{label}
              </button>
            ))}
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Player</th>
                {showCol('form') && <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Form</th>}
                {showCol('abs') && <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">ABs</th>}
                {showCol('pts') && <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Pts</th>}
                {showCol('obp') && <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Season OBP</th>}
                {showCol('prod') && <th className="text-center px-2 py-2 text-[10px] font-bold text-lime uppercase tracking-wider" title="Productivity = Season OBP + points per at-bat. Rewards getting on base AND producing, so kids who swing rank above passive walkers.">Prod</th>}
                {showCol('games') && <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Games</th>}
              </tr>
            </thead>
            <tbody>
              {[...playerStats].sort((a, b) => (b.productivity ?? -1) - (a.productivity ?? -1)).map(p => (
                <tr key={p.id} className="border-b border-border/30 hover:bg-panel-hover transition-colors">
                  <td className="px-3 py-2 font-semibold text-chalk">
                    {p.name}
                  </td>
                  {showCol('form') && (
                    <td className="text-center px-2 py-2 font-bold text-lime">
                      {p.avgAbs > 0 ? p.avg.toFixed(2) : '—'}
                    </td>
                  )}
                  {showCol('abs') && <td className="text-center px-2 py-2 text-chalk-dim">{p.totalAbs}</td>}
                  {showCol('pts') && <td className="text-center px-2 py-2 text-gold font-semibold">{p.pts}</td>}
                  {showCol('obp') && (
                    <td className="text-center px-2 py-2 text-sky">
                      {p.obp !== null ? p.obp.toFixed(3).replace(/^0/, '') : '—'}
                    </td>
                  )}
                  {showCol('prod') && (
                    <td className="text-center px-2 py-2 font-bold text-lime-bright">
                      {p.productivity !== null ? p.productivity.toFixed(2) : '—'}
                    </td>
                  )}
                  {showCol('games') && <td className="text-center px-2 py-2 text-chalk-dim">{p.gamesPlayed}</td>}
                </tr>
              ))}
              {playerStats.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-chalk-muted">
                    No batting data yet — log at-bats in Game Day or the Batting tab
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Season Trend — who's heating up / cooling off */}
      {trendStats.length > 0 && (
        <div className="bg-panel border border-border rounded-xl shadow-sm overflow-hidden mb-6">
          <div className="px-4 py-2.5 bg-field-light border-b border-border flex items-center justify-between">
            <span className="text-xs font-bold text-lime uppercase tracking-wider">Season Trend</span>
            <span className="text-[10px] text-chalk-muted">last 10 ABs vs prior 10</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-3 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Player</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold text-lime uppercase tracking-wider"
                    title="Productivity = Season OBP + points per at-bat.">Prod</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider whitespace-nowrap">Season · rolling Prod</th>
                  <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Trend</th>
                </tr>
              </thead>
              <tbody>
                {trendStats.map(p => (
                  <tr key={p.id} className="border-b border-border/30 hover:bg-panel-hover transition-colors">
                    <td className="px-3 py-2 font-semibold text-chalk whitespace-nowrap">{p.name}</td>
                    <td className="text-center px-2 py-2 font-bold text-lime-bright">
                      {p.seasonProd != null ? p.seasonProd.toFixed(2) : '—'}
                    </td>
                    <td className={`px-2 py-2 ${trendClass(p.trend)}`}>
                      <div className="flex justify-center"><Sparkline series={p.series} /></div>
                    </td>
                    <td className={`text-center px-2 py-2 font-bold whitespace-nowrap ${trendClass(p.trend)}`}>
                      {p.trend == null
                        ? <span className="text-chalk-muted font-normal text-[10px]">needs 20 AB</span>
                        : <span>{trendArrow(p.trend)} {p.trend >= 0 ? '+' : ''}{p.trend.toFixed(2)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 border-t border-border/60 bg-field/40 text-[10px] text-chalk-muted leading-relaxed">
            Shaded band = last 10 ABs. Line is a {rollWindow}-AB rolling average of Prod.
            <span className="text-lime"> ▲ heating up</span> · <span className="text-red">▼ cooling off</span> · ▬ steady.
          </div>
        </div>
      )}

      {/* Game-by-Game At-Bat Log */}
      <div className="bg-panel border border-border rounded-xl shadow-sm overflow-hidden">
        <div className="px-4 py-2.5 bg-field-light border-b border-border flex items-center justify-between">
          <span className="text-xs font-bold text-chalk-muted uppercase tracking-wider">At-Bat Log by Game</span>
          {atBats.length > 0 && (
            <button
              onClick={async () => {
                if (!confirm('⚠️ This will permanently delete ALL at-bat data for this team. Batting averages, OBP, points — everything resets to zero.\n\nAre you sure?')) return;
                if (!confirm('Really sure? This cannot be undone.')) return;
                setClearing(true);
                await clearAllAtBats();
                setClearing(false);
              }}
              disabled={clearing}
              className="px-2.5 py-1 text-[10px] font-bold text-red bg-red/10 border border-red/20 rounded
                         hover:bg-red/20 transition-colors disabled:opacity-50">
              {clearing ? 'Clearing...' : '🗑 Reset All At-Bats'}
            </button>
          )}
        </div>

        {gameGroups.length === 0 ? (
          <div className="px-4 py-8 text-center text-chalk-muted text-sm">
            No at-bats recorded yet
          </div>
        ) : (
          <div className="divide-y divide-border/50 max-h-[28rem] overflow-y-auto">
            {gameGroups.map(([game, abs]) => (
              <GameLogGroup key={game} game={game} atBats={abs} players={players} onDeleteAtBat={deleteAtBat} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Small inline sparkline of a player's rolling Prod across the season. Colors
// come from the parent cell via currentColor, so it tracks the trend hue and
// both light/dark themes. The last 10 ABs are shaded to mark the trend window.
function Sparkline({ series, w = 116, h = 26 }) {
  if (!series || series.length < 2) {
    return <span className="text-chalk-muted text-[11px]">—</span>;
  }
  const pad = 3;
  const min = Math.min(...series);
  const max = Math.max(...series);
  const rng = (max - min) || 1;
  const x = i => pad + i * (w - pad * 2) / (series.length - 1);
  const y = v => h - pad - (v - min) / rng * (h - pad * 2);
  const pts = series.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const line = 'M' + pts.join(' L');
  const area = `M${x(0).toFixed(1)},${h - pad} L` + pts.join(' L') + ` L${x(series.length - 1).toFixed(1)},${h - pad} Z`;
  const lastX = x(series.length - 1).toFixed(1);
  const lastY = y(series[series.length - 1]).toFixed(1);
  const bandStart = series.length > 10 ? x(series.length - 10) : null;
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      {bandStart != null && (
        <rect x={bandStart.toFixed(1)} y="0" width={(w - pad - bandStart).toFixed(1)} height={h} fill="currentColor" opacity="0.08" />
      )}
      <path d={area} fill="currentColor" opacity="0.15" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="2.4" fill="currentColor" />
    </svg>
  );
}

function GameLogGroup({ game, atBats, players, onDeleteAtBat }) {
  const hits = atBats.filter(ab => ab.outcome === 'hit').length;
  const walks = atBats.filter(ab => ab.outcome === 'walk').length;
  const ks = atBats.filter(ab => IS_K[ab.outcome]).length;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-bold text-lime">Game {game}</span>
        <span className="text-[10px] text-chalk-muted">
          {atBats.length} ABs · {hits} H · {walks} W · {ks} K
        </span>
      </div>
      <div className="space-y-0.5">
        {atBats.map(ab => {
          const p = players.find(x => x.id === ab.playerId);
          const outcomeClass = {
            Kl: 'bg-red/20 text-red border-red/30',
            K: 'bg-red/15 text-red border-red/25',
            out: 'bg-dirt/15 text-dirt border-dirt/25',
            walk: 'bg-sky/15 text-sky border-sky/25',
            hit: 'bg-lime/15 text-lime border-lime/25',
            single: 'bg-lime/15 text-lime border-lime/25',
            double: 'bg-lime/15 text-lime border-lime/25',
            triple: 'bg-lime/20 text-lime-bright border-lime/30',
            hr: 'bg-gold/15 text-gold border-gold/25',
            hbp: 'bg-sky/15 text-sky border-sky/25',
            sac: 'bg-dirt/15 text-dirt border-dirt/25',
          }[ab.outcome] || '';
          return (
            <div key={ab.id} className="flex items-center justify-between py-1 text-xs group">
              <span className="text-chalk-dim">
                {p?.name || '?'} · I{ab.inning}
              </span>
              <div className="flex items-center gap-2">
                <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${outcomeClass}`}>
                  {OUTCOME_SHORT[ab.outcome]}
                </span>
                <button
                  onClick={() => {
                    if (confirm(`Delete this at-bat? (${p?.name || '?'} — ${ab.outcome})`)) {
                      onDeleteAtBat(ab.id);
                    }
                  }}
                  className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 text-[9px] font-bold text-red bg-red/10 rounded
                             hover:bg-red/20 transition-all">
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
