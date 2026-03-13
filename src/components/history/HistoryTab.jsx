import { useMemo } from 'react';
import { useTeam, PTS } from '../../contexts/TeamContext';
import { POSITIONS } from '../../utils/rotationEngine';

const OUTCOME_LABELS = { K: 'Strikeout', out: 'Hit into Out', walk: 'Walk', hit: 'Hit' };
const POS_ORDER = [...POSITIONS.infield, ...POSITIONS.outfield, 'Bench'];

export default function HistoryTab() {
  const { players, atBats, savedGames, getPlayerStats, getRollingAvg, getPositionHistory, deleteGame } = useTeam();

  // Player stats summary
  const playerStats = useMemo(() => {
    return players.map(p => {
      const stats = getPlayerStats(p.id);
      const rolling = getRollingAvg(p.id);
      return { ...p, ...stats, avg: rolling.avg, avgAbs: rolling.absCount };
    }).sort((a, b) => b.avg - a.avg);
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
        <div className="bg-panel border border-border rounded-xl overflow-hidden mb-6">
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
                      {pos.replace('Left Field', 'LF').replace('Center Field', 'CF').replace('Right Field', 'RF')
                        .replace('1st Base', '1B').replace('2nd Base', '2B').replace('3rd Base', '3B')
                        .replace('Shortstop', 'SS').replace('Pitcher', 'P').replace('Catcher', 'C')
                        .replace('Bench', 'BN')}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {players.map(p => {
                  const hist = posHistory[p.id] || {};
                  return (
                    <tr key={p.id} className="border-b border-border/30 hover:bg-panel-hover">
                      <td className="px-2 py-1.5 font-semibold text-chalk whitespace-nowrap sticky left-0 bg-panel">{p.name}</td>
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
        <div className="bg-panel border border-border rounded-xl overflow-hidden mb-6">
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
                        const shortPos = pos.replace('Left Field', 'LF').replace('Center Field', 'CF').replace('Right Field', 'RF')
                          .replace('1st Base', '1B').replace('2nd Base', '2B').replace('3rd Base', '3B')
                          .replace('Shortstop', 'SS').replace('Pitcher', 'P').replace('Catcher', 'C');
                        return `${shortPos}:${p?.name?.slice(0, 6) || '?'}`;
                      }).join(' ')}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Season Batting Stats Table */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden mb-6">
        <div className="px-4 py-2.5 bg-field-light border-b border-border">
          <span className="text-xs font-bold text-lime uppercase tracking-wider">Season Batting Stats</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-3 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Player</th>
                <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Form</th>
                <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">ABs</th>
                <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Pts</th>
                <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">OBP</th>
                <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Games</th>
                <th className="text-center px-2 py-2 text-[10px] font-bold text-chalk-muted uppercase tracking-wider">Def</th>
              </tr>
            </thead>
            <tbody>
              {playerStats.map(p => (
                <tr key={p.id} className="border-b border-border/30 hover:bg-panel-hover transition-colors">
                  <td className="px-3 py-2 font-semibold text-chalk">
                    {p.name}
                    {p.role === 'P1' && <span className="ml-1 text-[9px] text-red font-bold">P1</span>}
                  </td>
                  <td className="text-center px-2 py-2 font-bold text-lime">
                    {p.avgAbs > 0 ? p.avg.toFixed(2) : '—'}
                  </td>
                  <td className="text-center px-2 py-2 text-chalk-dim">{p.totalAbs}</td>
                  <td className="text-center px-2 py-2 text-gold font-semibold">{p.pts}</td>
                  <td className="text-center px-2 py-2 text-sky">
                    {p.obp !== null ? p.obp.toFixed(3).replace(/^0/, '') : '—'}
                  </td>
                  <td className="text-center px-2 py-2 text-chalk-dim">{p.gamesPlayed}</td>
                  <td className="text-center px-2 py-2 text-gold">{p.defRating}★</td>
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

      {/* Game-by-Game At-Bat Log */}
      <div className="bg-panel border border-border rounded-xl overflow-hidden">
        <div className="px-4 py-2.5 bg-field-light border-b border-border">
          <span className="text-xs font-bold text-chalk-muted uppercase tracking-wider">At-Bat Log by Game</span>
        </div>

        {gameGroups.length === 0 ? (
          <div className="px-4 py-8 text-center text-chalk-muted text-sm">
            No at-bats recorded yet
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {gameGroups.map(([game, abs]) => (
              <GameLogGroup key={game} game={game} atBats={abs} players={players} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GameLogGroup({ game, atBats, players }) {
  const hits = atBats.filter(ab => ab.outcome === 'hit').length;
  const walks = atBats.filter(ab => ab.outcome === 'walk').length;
  const ks = atBats.filter(ab => ab.outcome === 'K').length;

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
            K: 'bg-red/15 text-red border-red/25',
            out: 'bg-dirt/15 text-dirt border-dirt/25',
            walk: 'bg-sky/15 text-sky border-sky/25',
            hit: 'bg-lime/15 text-lime border-lime/25',
          }[ab.outcome] || '';
          return (
            <div key={ab.id} className="flex items-center justify-between py-1 text-xs">
              <span className="text-chalk-dim">
                {p?.name || '?'} · I{ab.inning}
              </span>
              <span className={`px-1.5 py-0.5 text-[9px] font-bold uppercase rounded border ${outcomeClass}`}>
                {OUTCOME_LABELS[ab.outcome]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
