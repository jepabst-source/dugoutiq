import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, serverTimestamp, arrayUnion, arrayRemove, query, orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from './AuthContext';

const TeamContext = createContext(null);

// Default settings for new teams (proven Pabst Softball defaults)
const DEFAULT_SETTINGS = {
  defaultInnings: 3,
  devInningsEnabled: true,
  devInningCycle: 3,
  noBackToBackBench: true,
  infieldCapEnabled: true,
  infieldCapValue: 2,
  positionMinRatings: {
    '1st Base': 4,
    'Shortstop': 3,
  },
  assistantFullAccess: false,
};

// Scoring system
const PTS = { K: 0, out: 1, walk: 1, hit: 2 };

export function TeamProvider({ children }) {
  const { user, activeTeamId, setActiveTeamId, userDoc } = useAuth();
  const [team, setTeam] = useState(null);
  const [players, setPlayers] = useState([]);
  const [atBats, setAtBats] = useState([]);
  const [games, setGames] = useState([]);
  const [attendance, setAttendance] = useState(new Set());
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Subscribe to active team document
  useEffect(() => {
    if (!activeTeamId) { setTeam(null); setPlayers([]); setAtBats([]); return; }
    setLoadingTeam(true);

    const unsub = onSnapshot(doc(db, 'teams', activeTeamId), (snap) => {
      if (snap.exists()) {
        setTeam({ id: snap.id, ...snap.data() });
      } else {
        setTeam(null);
      }
      setLoadingTeam(false);
    });

    return unsub;
  }, [activeTeamId]);

  // Subscribe to players subcollection
  useEffect(() => {
    if (!activeTeamId) { setPlayers([]); return; }

    const unsub = onSnapshot(
      collection(db, 'teams', activeTeamId, 'players'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .filter(p => p.active !== false)
          .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setPlayers(list);
      }
    );

    return unsub;
  }, [activeTeamId]);

  // Subscribe to at-bats (stored as flat collection on team for simplicity)
  useEffect(() => {
    if (!activeTeamId) { setAtBats([]); return; }

    const unsub = onSnapshot(
      collection(db, 'teams', activeTeamId, 'atBats'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        setAtBats(list);
      }
    );

    return unsub;
  }, [activeTeamId]);

  // Load attendance from localStorage (game-day state, not persisted to Firebase)
  useEffect(() => {
    if (!activeTeamId) return;
    try {
      const saved = JSON.parse(localStorage.getItem(`dugoutiq_attendance_${activeTeamId}`) || 'null');
      if (Array.isArray(saved)) setAttendance(new Set(saved));
      else setAttendance(new Set(players.map(p => p.id)));
    } catch {
      setAttendance(new Set(players.map(p => p.id)));
    }
  }, [activeTeamId, players.length]);

  // ── ATTENDANCE ──

  const setAllAttendance = useCallback((val) => {
    const next = val ? new Set(players.map(p => p.id)) : new Set();
    setAttendance(next);
    localStorage.setItem(`dugoutiq_attendance_${activeTeamId}`, JSON.stringify([...next]));
  }, [players, activeTeamId]);

  const toggleAttendance = useCallback((playerId) => {
    setAttendance(prev => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      localStorage.setItem(`dugoutiq_attendance_${activeTeamId}`, JSON.stringify([...next]));
      return next;
    });
  }, [activeTeamId]);

  const getActivePlayers = useCallback(() => {
    const active = players.filter(p => attendance.has(p.id));
    return active.length ? active : players;
  }, [players, attendance]);

  // ── TEAM CRUD ──

  const createTeam = useCallback(async ({ name, sport, seasonYear, seasonLabel }) => {
    if (!user) return null;
    const teamRef = doc(collection(db, 'teams'));
    const teamData = {
      name,
      coachId: user.uid,
      sport: sport || 'softball',
      seasonYear: seasonYear || new Date().getFullYear(),
      seasonLabel: seasonLabel || '',
      portalCode: String(Math.floor(1000 + Math.random() * 9000)),
      settings: { ...DEFAULT_SETTINGS },
      createdAt: serverTimestamp(),
    };
    await setDoc(teamRef, teamData);

    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { teamIds: arrayUnion(teamRef.id) });

    setActiveTeamId(teamRef.id);
    return teamRef.id;
  }, [user, setActiveTeamId]);

  const updateTeam = useCallback(async (updates) => {
    if (!activeTeamId) return;
    await updateDoc(doc(db, 'teams', activeTeamId), updates);
  }, [activeTeamId]);

  const updateSettings = useCallback(async (settingsUpdates) => {
    if (!activeTeamId || !team) return;
    const merged = { ...team.settings, ...settingsUpdates };
    await updateDoc(doc(db, 'teams', activeTeamId), { settings: merged });
  }, [activeTeamId, team]);

  // ── PLAYER CRUD ──

  const addPlayer = useCallback(async (playerData) => {
    if (!activeTeamId) return null;
    const playerRef = doc(collection(db, 'teams', activeTeamId, 'players'));
    await setDoc(playerRef, {
      ...playerData,
      active: true,
      createdAt: serverTimestamp(),
    });
    return playerRef.id;
  }, [activeTeamId]);

  const updatePlayer = useCallback(async (playerId, updates) => {
    if (!activeTeamId) return;
    await updateDoc(doc(db, 'teams', activeTeamId, 'players', playerId), updates);
  }, [activeTeamId]);

  const removePlayer = useCallback(async (playerId) => {
    if (!activeTeamId) return;
    await updateDoc(doc(db, 'teams', activeTeamId, 'players', playerId), { active: false });
  }, [activeTeamId]);

  // ── AT-BAT CRUD ──

  const logAtBat = useCallback(async ({ playerId, game, inning, outcome }) => {
    if (!activeTeamId) return;
    const ref = doc(collection(db, 'teams', activeTeamId, 'atBats'));
    await setDoc(ref, {
      playerId,
      game: game || '1',
      inning: inning || 1,
      outcome,
      timestamp: Date.now(),
    });
  }, [activeTeamId]);

  const deleteAtBat = useCallback(async (atBatId) => {
    if (!activeTeamId) return;
    await deleteDoc(doc(db, 'teams', activeTeamId, 'atBats', atBatId));
  }, [activeTeamId]);

  // ── STATS HELPERS ──

  const getRollingAvg = useCallback((playerId) => {
    const playerAbs = atBats
      .filter(a => a.playerId === playerId)
      .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
      .slice(0, 5);
    if (!playerAbs.length) return { avg: 0, absCount: 0, pts: 0 };
    const pts = playerAbs.reduce((s, a) => s + (PTS[a.outcome] ?? 0), 0);
    return { avg: pts / playerAbs.length, absCount: playerAbs.length, pts };
  }, [atBats]);

  const getPlayerStats = useCallback((playerId) => {
    const playerAbs = atBats.filter(a => a.playerId === playerId);
    const pts = playerAbs.reduce((s, a) => s + (PTS[a.outcome] ?? 0), 0);
    const gamesPlayed = [...new Set(playerAbs.map(a => a.game))].length;
    const onBase = playerAbs.filter(a => a.outcome === 'hit' || a.outcome === 'walk').length;
    const obp = playerAbs.length ? onBase / playerAbs.length : null;
    return { totalAbs: playerAbs.length, pts, gamesPlayed, obp };
  }, [atBats]);

  const generateBattingOrder = useCallback(() => {
    const active = getActivePlayers();
    return [...active].map(p => {
      const stats = getPlayerStats(p.id);
      const rolling = getRollingAvg(p.id);
      return { ...p, ...stats, avg: rolling.avg, avgAbs: rolling.absCount };
    }).sort((a, b) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.pts !== a.pts) return b.pts - a.pts;
      return b.defRating - a.defRating;
    });
  }, [getActivePlayers, getPlayerStats, getRollingAvg]);

  return (
    <TeamContext.Provider value={{
      team,
      players,
      atBats,
      attendance,
      loadingTeam,
      createTeam,
      updateTeam,
      updateSettings,
      addPlayer,
      updatePlayer,
      removePlayer,
      logAtBat,
      deleteAtBat,
      getRollingAvg,
      getPlayerStats,
      generateBattingOrder,
      getActivePlayers,
      setAllAttendance,
      toggleAttendance,
    }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error('useTeam must be used within TeamProvider');
  return ctx;
}

export { DEFAULT_SETTINGS, PTS };
