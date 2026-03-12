import { useMemo } from 'react';
import { useTeam, PTS } from '../../contexts/TeamContext';
import { POSITIONS } from '../../utils/rotationEngine';

const OUTCOME_LABELS = { K: 'Strikeout', out: 'Hit into Out', walk: 'Walk', hit: 'Hit' };
const POS_ORDER = [...POSITIONS.infield, ...POSITIONS.outfield, 'Bench 1', 'Bench 2'];

export default function HistoryTab() {
  const { players, atBats, getPlayerStats, getRollingAvg } = useTeam();

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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-lime">History & Stats</h2>
          <p className="text-xs text-chalk-muted mt-0.5">Season batting stats and at-bat log</p>
        </div>
      </div>

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
