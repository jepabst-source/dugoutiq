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
  const [savedGames, setSavedGames] = useState([]);
  const [attendance, setAttendance] = useState(new Set());
  const [loadingTeam, setLoadingTeam] = useState(false);

  // Subscribe to active team document
  useEffect(() => {
    if (!activeTeamId) { setTeam(null); setPlayers([]); setAtBats([]); setSavedGames([]); return; }
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

  // Subscribe to saved games
  useEffect(() => {
    if (!activeTeamId) { setSavedGames([]); return; }

    const unsub = onSnapshot(
      collection(db, 'teams', activeTeamId, 'games'),
      (snap) => {
        const list = snap.docs
          .map(d => ({ id: d.id, ...d.data() }))
          .sort((a, b) => (b.gameNumber || 0) - (a.gameNumber || 0));
        setSavedGames(list);
      }
    );

    return unsub;
  }, [activeTeamId]);

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

  // ── GAME COMMIT / HISTORY ──

  const commitGame = useCallback(async ({ gameNumber, date, innings, opponent, lineups, battingOrder, score }) => {
    if (!activeTeamId) return;
    const gameRef = doc(collection(db, 'teams', activeTeamId, 'games'));
    await setDoc(gameRef, {
      gameNumber: gameNumber || (savedGames.length + 1),
      date: date || new Date().toISOString().split('T')[0],
      innings: innings || 3,
      opponent: opponent || '',
      lineups: lineups || {},       // { 1: {pos: playerId}, 2: {...}, ... }
      battingOrder: battingOrder || [],
      score: score || { ours: [], theirs: [] },
      committedAt: serverTimestamp(),
    });
    return gameRef.id;
  }, [activeTeamId, savedGames.length]);

  const deleteGame = useCallback(async (gameId) => {
    if (!activeTeamId) return;
    await deleteDoc(doc(db, 'teams', activeTeamId, 'games', gameId));
  }, [activeTeamId]);

  // Build position history from all saved games
  const getPositionHistory = useCallback(() => {
    const hist = {};
    for (const game of savedGames) {
      const lineups = game.lineups || {};
      for (const [inning, assignment] of Object.entries(lineups)) {
        for (const [pos, playerId] of Object.entries(assignment)) {
          if (!playerId) continue;
          if (!hist[playerId]) hist[playerId] = {};
          hist[playerId][pos] = (hist[playerId][pos] || 0) + 1;
        }
      }
    }
    return hist;
  }, [savedGames]);

  // ── INVITE SYSTEM ──

  const generateInviteCode = useCallback(async () => {
    if (!activeTeamId || !user) return null;
    const code = Math.random().toString(36).substring(2, 10);
    const inviteRef = doc(db, 'invites', code);
    await setDoc(inviteRef, {
      teamId: activeTeamId,
      teamName: team?.name || '',
      createdBy: user.uid,
      createdAt: serverTimestamp(),
      used: false,
    });
    return code;
  }, [activeTeamId, user, team]);

  const joinTeamWithCode = useCallback(async (code) => {
    if (!user) return { success: false, error: 'Not logged in' };
    const inviteRef = doc(db, 'invites', code);
    const snap = await getDoc(inviteRef);
    if (!snap.exists()) return { success: false, error: 'Invalid invite code' };

    const invite = snap.data();
    if (invite.used) return { success: false, error: 'This invite has already been used' };

    const teamId = invite.teamId;

    // Add user as assistant on the team
    const teamRef = doc(db, 'teams', teamId);
    await updateDoc(teamRef, { assistantIds: arrayUnion(user.uid) });

    // Add team to user's teamIds
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { teamIds: arrayUnion(teamId) });

    // Mark invite as used
    await updateDoc(inviteRef, { used: true, usedBy: user.uid, usedAt: serverTimestamp() });

    setActiveTeamId(teamId);
    return { success: true, teamName: invite.teamName };
  }, [user, setActiveTeamId]);

  const removeAssistant = useCallback(async (assistantUid) => {
    if (!activeTeamId) return;
    await updateDoc(doc(db, 'teams', activeTeamId), { assistantIds: arrayRemove(assistantUid) });
  }, [activeTeamId]);

  return (
    <TeamContext.Provider value={{
      team,
      players,
      atBats,
      savedGames,
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
      commitGame,
      deleteGame,
      getPositionHistory,
      generateInviteCode,
      joinTeamWithCode,
      removeAssistant,
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
