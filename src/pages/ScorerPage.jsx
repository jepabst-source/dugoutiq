import { useState, useEffect } from 'react';
import { doc, getDoc, collection, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export default function ScorerPage({ scorerCode }) {
  const [scorerData, setScorerData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [recentLog, setRecentLog] = useState([]);
  const [recording, setRecording] = useState(false);
  const [advancedMode, setAdvancedMode] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const snap = await getDoc(doc(db, 'scorerLinks', scorerCode));
        if (!snap.exists()) { setError('Invalid scorer link.'); setLoading(false); return; }
        const data = snap.data();
        if (data.expiresAt && Date.now() > data.expiresAt) { setError('This scorer link has expired.'); setLoading(false); return; }
        setScorerData(data);
        // Use the coach's preferred tracking mode
        if (data.trackingMode === 'advanced') setAdvancedMode(true);
      } catch (err) { console.error('Scorer load error:', err); setError('Could not load scorer link.'); }
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
        inning: 1, outcome, timestamp: Date.now(), scoredBy: 'scorer',
      });
      setRecentLog(prev => [{ name: selectedPlayer.name, number: selectedPlayer.number, outcome, time: Date.now() }, ...prev].slice(0, 20));
      setSelectedPlayer(null);
    } catch (err) { console.error('Failed to log at-bat:', err); }
    setRecording(false);
  };

  const handleUndo = () => { if (recentLog.length) setRecentLog(prev => prev.slice(1)); };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-white">
      <div className="text-center"><div className="text-4xl mb-3 animate-pulse">⚾</div><p className="text-gray-400 text-sm">Loading...</p></div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center bg-white px-4">
      <div className="text-center"><div className="text-4xl mb-3">⚾</div><p className="text-red-500 text-sm">{error}</p></div>
    </div>
  );

  const players = scorerData?.playerSnapshot || [];

  return (
    <div className="min-h-screen bg-[#f0f0f0]" style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm px-4 py-3">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/logo-square.jpg" alt="Dugout IQ" className="w-9 h-9 rounded-lg" />
            <div>
              <div className="text-base font-bold text-gray-800">{scorerData.teamName || 'Dugout IQ'}</div>
              <div className="text-[10px] text-gray-400 uppercase tracking-widest">Live Scorer</div>
            </div>
          </div>
          <div className="text-[10px] text-gray-400">{recentLog.length} ABs logged</div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-3 py-4">
        {selectedPlayer && (
          <div className="bg-white border-2 border-[#1e3a5f] rounded-2xl p-5 text-center mb-4 shadow-sm">
            <div className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-1">NOW BATTING</div>
            {selectedPlayer.number && <div className="text-5xl font-bold text-[#1e3a5f]/10 mb-1">#{selectedPlayer.number}</div>}
            <div className="text-3xl font-bold text-gray-800 mb-4 tracking-tight">{selectedPlayer.name}</div>

            <div className="flex justify-center mb-3">
              <div className="flex gap-0.5 bg-gray-100 rounded-lg p-0.5 border border-gray-200">
                <button onClick={() => setAdvancedMode(false)}
                  className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${!advancedMode ? 'bg-white text-[#1e3a5f] shadow-sm' : 'text-gray-400'}`}>Simple</button>
                <button onClick={() => setAdvancedMode(true)}
                  className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${advancedMode ? 'bg-white text-[#1e3a5f] shadow-sm' : 'text-gray-400'}`}>Advanced</button>
              </div>
            </div>

            {!advancedMode ? (
              <div className="grid grid-cols-2 gap-3 mb-3">
                <button onClick={() => handleRecord('K')} disabled={recording}
                  className="py-5 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 font-bold text-xl active:scale-95 transition-all flex flex-col items-center gap-1 disabled:opacity-50">
                  K<span className="text-[10px] font-normal opacity-70">strikeout</span></button>
                <button onClick={() => handleRecord('hit')} disabled={recording}
                  className="py-5 rounded-xl bg-green-50 border-2 border-green-200 text-green-600 font-bold text-xl active:scale-95 transition-all flex flex-col items-center gap-1 disabled:opacity-50">
                  HIT<span className="text-[10px] font-normal opacity-70">base hit</span></button>
                <button onClick={() => handleRecord('walk')} disabled={recording}
                  className="py-5 rounded-xl bg-blue-50 border-2 border-blue-200 text-blue-600 font-bold text-xl active:scale-95 transition-all flex flex-col items-center gap-1 disabled:opacity-50">
                  WALK<span className="text-[10px] font-normal opacity-70">walked</span></button>
                <button onClick={() => handleRecord('out')} disabled={recording}
                  className="py-5 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-600 font-bold text-xl active:scale-95 transition-all flex flex-col items-center gap-1 disabled:opacity-50">
                  OUT<span className="text-[10px] font-normal opacity-70">fielded out</span></button>
              </div>
            ) : (
              <div className="space-y-2 mb-3">
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => handleRecord('K')} disabled={recording}
                    className="py-3 rounded-xl bg-red-50 border-2 border-red-200 text-red-600 font-bold text-base active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">K</button>
                  <button onClick={() => handleRecord('out')} disabled={recording}
                    className="py-3 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-600 font-bold text-base active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">OUT</button>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button onClick={() => handleRecord('single')} disabled={recording}
                    className="py-3 rounded-xl bg-green-50 border-2 border-green-200 text-green-600 font-bold text-sm active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">1B</button>
                  <button onClick={() => handleRecord('double')} disabled={recording}
                    className="py-3 rounded-xl bg-green-50 border-2 border-green-200 text-green-600 font-bold text-sm active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">2B</button>
                  <button onClick={() => handleRecord('triple')} disabled={recording}
                    className="py-3 rounded-xl bg-green-50 border-2 border-green-200 text-green-700 font-bold text-sm active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">3B</button>
                  <button onClick={() => handleRecord('hr')} disabled={recording}
                    className="py-3 rounded-xl bg-amber-50 border-2 border-amber-300 text-amber-700 font-bold text-sm active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">HR</button>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <button onClick={() => handleRecord('walk')} disabled={recording}
                    className="py-3 rounded-xl bg-blue-50 border-2 border-blue-200 text-blue-600 font-bold text-sm active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">BB</button>
                  <button onClick={() => handleRecord('hbp')} disabled={recording}
                    className="py-3 rounded-xl bg-blue-50 border-2 border-blue-200 text-blue-600 font-bold text-sm active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">HBP</button>
                  <button onClick={() => handleRecord('sac')} disabled={recording}
                    className="py-3 rounded-xl bg-amber-50 border-2 border-amber-200 text-amber-600 font-bold text-sm active:scale-95 transition-all flex flex-col items-center disabled:opacity-50">SAC</button>
                </div>
              </div>
            )}

            <button onClick={() => setSelectedPlayer(null)}
              className="w-full py-2.5 text-sm text-gray-400 bg-gray-100 rounded-lg active:bg-gray-200 transition-colors">✕ Cancel</button>
          </div>
        )}

        {!selectedPlayer && (
          <>
            <p className="text-xs text-gray-400 mb-3 text-center">Tap the player who's batting:</p>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {players.map(p => (
                <button key={p.id} onClick={() => setSelectedPlayer(p)}
                  className="text-left px-3 py-3.5 rounded-xl border border-gray-200 bg-white shadow-sm
                             active:scale-[0.97] active:border-[#1e3a5f]/40 transition-all flex items-center gap-3">
                  {p.number && <span className="text-lg font-bold text-[#1e3a5f]/30 min-w-[32px]">#{p.number}</span>}
                  <span className="text-sm font-semibold text-gray-800 truncate">{p.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {recentLog.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Recent</span>
              <button onClick={handleUndo}
                className="px-2 py-1 text-[10px] font-bold text-red-500 bg-red-50 rounded active:bg-red-100 transition-colors">↩ Undo</button>
            </div>
            <div className="max-h-48 overflow-y-auto">
              {recentLog.map((entry, i) => {
                const colors = { K:'text-red-500', hit:'text-green-600', single:'text-green-600', double:'text-green-600', triple:'text-green-700', hr:'text-amber-600', walk:'text-blue-500', hbp:'text-blue-500', out:'text-amber-600', sac:'text-amber-600' };
                const labels = { K:'K', out:'OUT', hit:'HIT', single:'1B', double:'2B', triple:'3B', hr:'HR', walk:'BB', hbp:'HBP', sac:'SAC' };
                return (
                  <div key={i} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-0 text-sm">
                    <span className="text-gray-500">{entry.number ? `#${entry.number} ` : ''}{entry.name}</span>
                    <span className={`font-bold text-xs uppercase ${colors[entry.outcome] || 'text-gray-400'}`}>{labels[entry.outcome] || entry.outcome}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="text-center py-4 text-[10px] text-gray-300">
        Powered by <strong>Dugout IQ</strong> · lineupman.com
      </div>
    </div>
  );
}
