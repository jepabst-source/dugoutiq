import { useState, useEffect } from 'react';
import { doc, getDoc, collection, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const PTS = { K: 0, out: 1, walk: 1, hit: 2 };

export default function ScorerPage({ scorerCode }) {
  const [scorerData, setScorerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [recentLog, setRecentLog] = useState([]);
  const [recording, setRecording] = useState(false);

  // Load scorer link data
  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'scorerLinks', scorerCode));
        if (!snap.exists()) {
          setError('Invalid scorer link.');
          setLoading(false);
          return;
        }
        const data = snap.data();
        if (data.expiresAt && Date.now() > data.expiresAt) {
          setError('This scorer link has expired.');
          setLoading(false);
          return;
        }
        setScorerData(data);
      } catch (err) {
        setError('Could not load scorer link.');
      }
      setLoading(false);
    }
    load();
  }, [scorerCode]);

  const handleRecord = async (outcome) => {
    if (!selectedPlayer || !scorerData || recording) return;
    setRecording(true);
    try {
      const ref = doc(collection(db, 'teams', scorerData.teamId, 'atBats'));
      await setDoc(ref, {
        playerId: selectedPlayer.id,
        game: scorerData.gameId || `gd-${new Date().toISOString().split('T')[0]}`,
        inning: 1,
        outcome,
        timestamp: Date.now(),
        scoredBy: 'scorer',
      });
      setRecentLog(prev => [{
        name: selectedPlayer.name,
        number: selectedPlayer.number,
        outcome,
        time: Date.now(),
      }, ...prev].slice(0, 20));
      setSelectedPlayer(null);
    } catch (err) {
      console.error('Failed to log at-bat:', err);
    }
    setRecording(false);
  };

  const handleUndo = () => {
    if (recentLog.length === 0) return;
    setRecentLog(prev => prev.slice(1));
    // Note: doesn't delete from Firebase — coach can clean up later
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1a0d]">
        <div className="text-center">
          <div className="text-4xl mb-3 animate-pulse">⚾</div>
          <p className="text-[#6a7d62] text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a1a0d] px-4">
        <div className="text-center">
          <div className="text-4xl mb-3">⚾</div>
          <p className="text-[#d64045] text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const players = scorerData?.playerSnapshot || [];

  return (
    <div className="min-h-screen bg-[#0a1a0d] text-[#eaf0e6]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#132215] border-b-2 border-[#8ed431]/30 px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-[#8ed431]">{scorerData.teamName || 'Dugout IQ'}</div>
            <div className="text-[10px] text-[#6a7d62] uppercase tracking-widest">Live Scorer</div>
          </div>
          <div className="text-[10px] text-[#6a7d62]">
            {recentLog.length} ABs logged
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-3 py-4">
        {/* Selected player — outcome buttons */}
        {selectedPlayer && (
          <div className="bg-[#151f17] border-2 border-[#8ed431] rounded-2xl p-5 text-center mb-4"
               style={{ boxShadow: '0 0 30px rgba(142,212,49,0.1)' }}>
            <div className="text-[10px] font-bold text-[#6a7d62] uppercase tracking-[0.2em] mb-1">NOW BATTING</div>
            {selectedPlayer.number && (
              <div className="text-5xl font-bold text-[#8ed431]/15 mb-1">#{selectedPlayer.number}</div>
            )}
            <div className="text-3xl font-bold text-[#eaf0e6] mb-5 tracking-tight">{selectedPlayer.name}</div>

            <div className="grid grid-cols-2 gap-3 mb-3">
              <button onClick={() => handleRecord('K')} disabled={recording}
                className="py-5 rounded-xl bg-[#d64045]/10 border-2 border-[#d64045]/25 text-[#d64045] font-bold text-xl
                           active:scale-95 transition-all flex flex-col items-center gap-1 disabled:opacity-50">
                K
                <span className="text-[10px] font-normal opacity-70">strikeout</span>
              </button>
              <button onClick={() => handleRecord('hit')} disabled={recording}
                className="py-5 rounded-xl bg-[#8ed431]/10 border-2 border-[#8ed431]/25 text-[#8ed431] font-bold text-xl
                           active:scale-95 transition-all flex flex-col items-center gap-1 disabled:opacity-50">
                HIT
                <span className="text-[10px] font-normal opacity-70">base hit</span>
              </button>
              <button onClick={() => handleRecord('walk')} disabled={recording}
                className="py-5 rounded-xl bg-[#4a9eda]/10 border-2 border-[#4a9eda]/25 text-[#4a9eda] font-bold text-xl
                           active:scale-95 transition-all flex flex-col items-center gap-1 disabled:opacity-50">
                WALK
                <span className="text-[10px] font-normal opacity-70">walked</span>
              </button>
              <button onClick={() => handleRecord('out')} disabled={recording}
                className="py-5 rounded-xl bg-[#c4874a]/10 border-2 border-[#c4874a]/25 text-[#c4874a] font-bold text-xl
                           active:scale-95 transition-all flex flex-col items-center gap-1 disabled:opacity-50">
                OUT
                <span className="text-[10px] font-normal opacity-70">hit into out</span>
              </button>
            </div>

            <button onClick={() => setSelectedPlayer(null)}
              className="w-full py-2.5 text-sm text-[#6a7d62] bg-[#2a3d2c]/50 rounded-lg active:bg-[#2a3d2c] transition-colors">
              ✕ Cancel
            </button>
          </div>
        )}

        {/* Player list */}
        {!selectedPlayer && (
          <>
            <p className="text-xs text-[#6a7d62] mb-3 text-center">Tap the player who's batting:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {players.map(p => (
                <button key={p.id} onClick={() => setSelectedPlayer(p)}
                  className="text-left px-3 py-3.5 rounded-xl border border-[#2a3d2c] bg-[#151f17]
                             active:scale-[0.97] active:border-[#8ed431]/40 transition-all flex items-center gap-3">
                  {p.number && (
                    <span className="text-lg font-bold text-[#8ed431]/50 min-w-[32px]">#{p.number}</span>
                  )}
                  <span className="text-sm font-semibold text-[#eaf0e6] truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Recent log */}
        {recentLog.length > 0 && (
          <div className="bg-[#151f17] border border-[#2a3d2c] rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-[#132215] border-b border-[#2a3d2c]">
              <span className="text-[10px] font-bold text-[#6a7d62] uppercase tracking-wider">Recent</span>
              <button onClick={handleUndo}
                className="px-2 py-1 text-[10px] font-bold text-[#d64045] bg-[#d64045]/10 rounded active:bg-[#d64045]/20 transition-colors">
                ↩ Undo
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {recentLog.map((entry, i) => {
                const colors = {
                  K: 'text-[#d64045]',
                  hit: 'text-[#8ed431]',
                  walk: 'text-[#4a9eda]',
                  out: 'text-[#c4874a]',
                };
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-[#2a3d2c]/50 last:border-0 text-sm">
                    <span className="text-[#a8b8a0]">
                      {entry.number ? `#${entry.number} ` : ''}{entry.name}
                    </span>
                    <span className={`font-bold text-xs uppercase ${colors[entry.outcome]}`}>
                      {entry.outcome === 'K' ? 'K' : entry.outcome === 'hit' ? 'HIT' : entry.outcome === 'walk' ? 'WALK' : 'OUT'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
