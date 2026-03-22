import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc, collection, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PTS = { K: 0, out: 1, walk: 1, hit: 2, single: 2, double: 2, triple: 2, hr: 2, hbp: 1, sac: 1 };
const IS_ON_BASE = { hit: true, single: true, double: true, triple: true, hr: true, walk: true, hbp: true };

export default function PortalPage({ teamId }) {
  const [pin, setPin] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [atBats, setAtBats] = useState([]);
  const [games, setGames] = useState([]);
  const [loading, setLoading] = useState(true);

  // Validate PIN
  const handlePinSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const snap = await getDoc(doc(db, 'teams', teamId));
      if (!snap.exists()) { setError('Team not found.'); return; }
      const data = snap.data();
      if (data.portalCode === pin) {
        setTeam({ id: snap.id, ...data });
        setAuthed(true);
        sessionStorage.setItem(`portal_${teamId}`, 'ok');
      } else {
        setError('Incorrect access code.');
      }
    } catch (err) {
      setError('Could not verify code.');
    }
  };

  // Check session
  useEffect(() => {
    if (sessionStorage.getItem(`portal_${teamId}`) === 'ok') {
      // Auto-auth from session
      getDoc(doc(db, 'teams', teamId)).then(snap => {
        if (snap.exists()) {
          setTeam({ id: snap.id, ...snap.data() });
          setAuthed(true);
        }
      });
    } else {
      setLoading(false);
    }
  }, [teamId]);

  // Load live data once authed
  useEffect(() => {
    if (!authed || !teamId) return;
    const unsubs = [];

    // Players
    unsubs.push(onSnapshot(collection(db, 'teams', teamId, 'players'), snap => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(p => p.active !== false));
    }));

    // At-bats
    unsubs.push(onSnapshot(collection(db, 'teams', teamId, 'atBats'), snap => {
      setAtBats(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }));

    // Games
    unsubs.push(onSnapshot(collection(db, 'teams', teamId, 'games'), snap => {
      const g = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      console.log('Portal games loaded:', g.length, g.length > 0 ? Object.keys(g[0].lineups || {}) : 'no lineups');
      setGames(g);
    }));

    setLoading(false);
    return () => unsubs.forEach(u => u());
  }, [authed, teamId]);

  // Portal display settings
  const portalSettings = team?.settings || {};
  const showPoints = portalSettings.portalShowPoints !== false;
  const showForm = portalSettings.portalShowForm !== false;
  const showTotalABs = portalSettings.portalShowTotalABs !== false;
  const showGames = portalSettings.portalShowGames !== false;
  const formWindow = portalSettings.portalFormWindow || 5;
  const obpScope = portalSettings.portalOBPScope || 'total';

  // Stats helpers
  const getPlayerStats = (playerId) => {
    const pAbs = atBats.filter(a => a.playerId === playerId);
    const pts = pAbs.reduce((s, a) => s + (PTS[a.outcome] ?? 0), 0);
    const gamesPlayed = [...new Set(pAbs.map(a => a.game))].length;

    // OBP — scoped by at-bat count if configured
    let obpPool = pAbs;
    if (obpScope !== 'total') {
      const scopeABs = Number(obpScope);
      obpPool = [...pAbs]
        .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
        .slice(0, scopeABs);
    }
    const onBase = obpPool.filter(a => IS_ON_BASE[a.outcome]).length;
    const obpAbs = obpPool.filter(a => a.outcome !== 'sac').length;
    const obp = obpAbs ? onBase / obpAbs : null;

    return { totalAbs: pAbs.length, pts, gamesPlayed, obp };
  };

  const getRollingAvg = (playerId) => {
    const pAbs = [...atBats]
      .filter(a => a.playerId === playerId)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, formWindow);
    if (!pAbs.length) return { avg: null, count: 0 };
    const pts = pAbs.reduce((s, a) => s + (PTS[a.outcome] ?? 0), 0);
    return { avg: pts / pAbs.length, count: pAbs.length };
  };

  const getTrends = (playerId) => {
    const abs = [...atBats]
      .filter(a => a.playerId === playerId)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    if (abs.length < 3) return [];
    const recent = abs.slice(0, 5);
    const previous = abs.slice(5, 10);
    const trends = [];

    // Hot streak — 3+ hits in last 5
    const recentHits = recent.filter(a => IS_ON_BASE[a.outcome]).length;
    if (recentHits >= 3) trends.push('🔥 Hot Streak');

    if (!previous.length) return trends;

    // Batting avg trend
    const avgR = recent.reduce((s, a) => s + (PTS[a.outcome] ?? 0), 0) / recent.length;
    const avgP = previous.reduce((s, a) => s + (PTS[a.outcome] ?? 0), 0) / previous.length;
    if (avgR - avgP > 0.15) trends.push('↑ Batting');

    // OBP trend
    const obpR = recent.filter(a => IS_ON_BASE[a.outcome]).length / recent.length;
    const obpP = previous.filter(a => IS_ON_BASE[a.outcome]).length / previous.length;
    if (obpR - obpP > 0.15) trends.push('↑ OBP');

    return trends;
  };

  const getRecentPositions = (playerId) => {
    if (!games.length) return [];
    const sorted = [...games].sort((a, b) => {
      const aTime = a.committedAt?.seconds || a.committedAt?.toMillis?.() || 0;
      const bTime = b.committedAt?.seconds || b.committedAt?.toMillis?.() || 0;
      return bTime - aTime;
    });
    // Collect all positions across all innings of recent games, newest first
    const positions = [];
    for (const game of sorted) {
      const lineups = game.lineups || {};
      const inningKeys = Object.keys(lineups).sort((a, b) => Number(b) - Number(a)); // newest inning first
      for (const ing of inningKeys) {
        const asgn = lineups[ing] || {};
        for (const [pos, id] of Object.entries(asgn)) {
          if (id === playerId && !pos.startsWith('Bench')) {
            positions.push(pos);
          }
        }
      }
      if (positions.length >= 5) break;
    }
    return positions.slice(0, 5);
  };

  const sortedPlayers = useMemo(() =>
    [...players].sort((a, b) => a.name.localeCompare(b.name)),
    [players]
  );

  // PIN Gate
  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#ffffff' }}>
        <div className="w-full max-w-sm text-center">
          <div className="mb-6">
            <img src="/logo-square.jpg" alt="Dugout IQ" className="w-60 mx-auto rounded-xl" />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-1">Parent Portal</h2>
          <p className="text-sm text-gray-500 mb-6">Enter the access code your coach shared with you.</p>

          <form onSubmit={handlePinSubmit}>
            <input
              type="tel" inputMode="numeric" maxLength={4}
              value={pin} onChange={e => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="0000"
              autoFocus
              className="w-32 mx-auto block px-4 py-3 rounded-xl border-2 border-gray-200 text-center text-2xl font-bold
                         text-gray-800 tracking-[0.3em] focus:border-blue-400 focus:outline-none mb-4"
            />
            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
            <button type="submit" disabled={pin.length < 4}
              className="w-full py-3 rounded-xl bg-[#1a3a5c] text-white font-bold text-sm
                         hover:bg-[#152e4a] active:scale-[0.98] transition-all disabled:opacity-40">
              View Stats
            </button>
          </form>

          <p className="mt-6 text-[10px] text-gray-400">
            Powered by <strong>Dugout IQ</strong> · lineupman.com
          </p>
        </div>
      </div>
    );
  }

  // Portal Content
  return (
    <div className="min-h-screen" style={{ background: '#f8f9fa', fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-square.jpg" alt="Dugout IQ" className="w-[72px] h-[72px] rounded-lg" />
            <div>
              <div className="text-lg font-bold text-gray-800">{team?.name || 'Team'}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                {team?.seasonLabel} {team?.seasonYear} · Parent Portal
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
            <span className="text-[10px] text-gray-400">Live</span>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-2">
        <div className="flex gap-3 flex-wrap text-[10px] text-gray-400">
          {showForm && <span><strong className="text-gray-600">Form</strong> = last {formWindow} at-bats</span>}
          {showPoints && <span><strong className="text-gray-600">Pts</strong> = total batting points</span>}
          <span><strong className="text-gray-600">OBP</strong> = on-base %{obpScope !== 'total' ? ` (last ${obpScope} ABs)` : ''}</span>
        </div>
      </div>

      {/* Player Cards */}
      <div className="max-w-2xl mx-auto px-4 pb-8">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading...</div>
        ) : sortedPlayers.length === 0 ? (
          <div className="text-center py-12 text-gray-400">No players yet — check back soon!</div>
        ) : (
          <div className="space-y-3">
            {sortedPlayers.map(p => {
              const stats = getPlayerStats(p.id);
              const rolling = getRollingAvg(p.id);
              const trends = getTrends(p.id);
              const positions = getRecentPositions(p.id);

              return (
                <div key={p.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                  {/* Top row — name + stats */}
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-800">{p.name}</span>
                        {p.number && <span className="text-xs text-gray-400">#{p.number}</span>}
                      </div>
                      {/* Trends */}
                      {trends.length > 0 && (
                        <div className="flex gap-2 mt-1">
                          {trends.map(t => (
                            <span key={t} className="text-[10px] text-green-600 font-semibold">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Stat blocks */}
                    <div className="flex items-end gap-3 text-center">
                      {showPoints && (
                        <div>
                          <div className="text-sm font-semibold text-gray-400">{stats.pts ?? '—'}</div>
                          <div className="text-[8px] text-gray-300 uppercase">Pts</div>
                        </div>
                      )}
                      {showForm && (
                        <div>
                          <div className="text-sm font-semibold text-gray-400">
                            {rolling.avg !== null ? rolling.avg.toFixed(2) : '—'}
                          </div>
                          <div className="text-[8px] text-gray-300 uppercase">Form</div>
                        </div>
                      )}
                      <div>
                        <div className="text-2xl font-bold text-blue-500">
                          {stats.obp !== null ? (stats.obp >= 1 ? '1.00' : stats.obp.toFixed(3).replace(/^0/, '')) : '—'}
                        </div>
                        <div className="text-[9px] text-blue-400 uppercase font-semibold">OBP</div>
                      </div>
                    </div>
                  </div>

                  {/* Recent positions */}
                  <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                    <span className="text-[10px] text-gray-400">Recent:</span>
                    {positions.length > 0 ? (
                      positions.map((pos, i) => (
                        <span key={i} className="px-2 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-600 rounded">
                          {pos.replace('Center Field', 'CF').replace('Left Field', 'LF').replace('Right Field', 'RF')
                              .replace('1st Base', '1B').replace('2nd Base', '2B').replace('3rd Base', '3B')
                              .replace('Shortstop', 'SS').replace('Pitcher', 'P').replace('Catcher', 'C')}
                        </span>
                      ))
                    ) : (
                      <span className="text-[10px] text-gray-300">No games recorded yet</span>
                    )}
                    <span className="flex-1" />
                    <span className="text-[10px] text-gray-300">
                      {showTotalABs && `${stats.totalAbs} ABs`}
                      {showTotalABs && showGames && ' · '}
                      {showGames && `${stats.gamesPlayed} games`}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="text-center py-6 text-[10px] text-gray-300">
        Read-only · Stats update live · Powered by <strong>Dugout IQ</strong> · lineupman.com
      </div>
    </div>
  );
}
