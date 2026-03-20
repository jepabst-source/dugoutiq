// Demo team seed data for new users
// Creates a "Demo Dolphins" team with 12 players, at-bats, and a committed game
// so new coaches can explore every tab before entering their own roster.

import { collection, doc, setDoc, serverTimestamp, arrayUnion, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

const DEMO_PLAYERS = [
  { name: 'Ava M', number: '3', defRating: 5, canPitch: true, canCatch: false, prefPositions: ['Pitcher', 'Shortstop'], catchRating: 5, throwRating: 4, notes: 'Team captain. Great arm.' },
  { name: 'Bella R', number: '7', defRating: 4, canPitch: false, canCatch: true, prefPositions: ['Catcher', '1st Base'], catchRating: 5, throwRating: 3, notes: 'Strongest catcher on the team.' },
  { name: 'Chloe T', number: '12', defRating: 4, canPitch: true, canCatch: false, prefPositions: ['Pitcher', '3rd Base'], catchRating: 3, throwRating: 5, notes: 'Cannon arm. Developing as pitcher.' },
  { name: 'Daisy K', number: '9', defRating: 4, canPitch: false, canCatch: false, prefPositions: ['Shortstop', '2nd Base'], catchRating: 4, throwRating: 4, notes: '' },
  { name: 'Emma L', number: '22', defRating: 3, canPitch: false, canCatch: false, prefPositions: ['2nd Base'], catchRating: 3, throwRating: 3, notes: 'Reliable. Never misses practice.' },
  { name: 'Fiona J', number: '5', defRating: 3, canPitch: false, canCatch: true, prefPositions: ['1st Base', 'Left Field'], catchRating: 4, throwRating: 2, notes: 'Good hands, working on throws.' },
  { name: 'Grace P', number: '11', defRating: 3, canPitch: false, canCatch: false, prefPositions: ['Center Field'], catchRating: 3, throwRating: 3, notes: 'Fastest on the team.' },
  { name: 'Hannah W', number: '8', defRating: 3, canPitch: false, canCatch: false, prefPositions: ['Left Field', 'Right Field'], catchRating: 3, throwRating: 2, notes: '' },
  { name: 'Izzy B', number: '15', defRating: 2, canPitch: false, canCatch: false, prefPositions: ['Right Field'], catchRating: 2, throwRating: 2, notes: 'First year. Improving fast.' },
  { name: 'Jade S', number: '2', defRating: 2, canPitch: false, canCatch: false, prefPositions: ['Left Field', '2nd Base'], catchRating: 3, throwRating: 1, notes: 'Great attitude. Needs reps.' },
  { name: 'Katie N', number: '17', defRating: 2, canPitch: false, canCatch: false, prefPositions: ['Right Field'], catchRating: 2, throwRating: 2, notes: '' },
  { name: 'Lily D', number: '21', defRating: 1, canPitch: false, canCatch: false, prefPositions: [], catchRating: 1, throwRating: 1, notes: 'Brand new to the sport. Be patient.' },
];

// Outcomes weighted toward what a real youth game looks like
const DEMO_OUTCOMES = ['K', 'out', 'out', 'hit', 'hit', 'walk', 'single', 'out', 'K', 'hit', 'walk', 'out'];

/**
 * Create the Demo Dolphins team for a new user.
 * @param {string} userId - Firebase user UID
 * @returns {Promise<string>} the demo team ID
 */
export async function createDemoTeam(userId) {
  const teamRef = doc(collection(db, 'teams'));
  const teamId = teamRef.id;

  // Create team doc
  await setDoc(teamRef, {
    name: 'Demo Dolphins',
    coachId: userId,
    assistantIds: [],
    sport: 'softball',
    seasonYear: new Date().getFullYear(),
    seasonLabel: 'Spring',
    portalCode: '0000',
    isDemo: true,
    settings: {
      defaultInnings: 3,
      devInningsEnabled: true,
      devInningCycle: 3,
      noBackToBackBench: true,
      infieldCapEnabled: false,
      infieldCapValue: 2,
      positionMinRatings: { '1st Base': 4, 'Shortstop': 3 },
      assistantFullAccess: false,
      trackingMode: 'simple',
    },
    createdAt: serverTimestamp(),
  });

  // Create players
  const playerIds = [];
  for (const p of DEMO_PLAYERS) {
    const playerRef = doc(collection(db, 'teams', teamId, 'players'));
    await setDoc(playerRef, { ...p, active: true });
    playerIds.push(playerRef.id);
  }

  // Create some at-bats across a game
  const gameId = `demo-game-1`;
  const now = Date.now();
  for (let inning = 1; inning <= 3; inning++) {
    // Each inning, ~4-5 players bat
    const battersPerInning = Math.min(playerIds.length, 4 + Math.floor(Math.random() * 2));
    for (let b = 0; b < battersPerInning; b++) {
      const playerIdx = ((inning - 1) * 4 + b) % playerIds.length;
      const outcome = DEMO_OUTCOMES[Math.floor(Math.random() * DEMO_OUTCOMES.length)];
      const abRef = doc(collection(db, 'teams', teamId, 'atBats'));
      await setDoc(abRef, {
        playerId: playerIds[playerIdx],
        game: gameId,
        inning,
        outcome,
        timestamp: now - (3 - inning) * 600000 - b * 30000, // stagger timestamps
      });
    }
  }

  // Create a committed game
  const gameRef = doc(collection(db, 'teams', teamId, 'games'));
  const demoLineups = {};
  const positions = ['Pitcher', 'Catcher', '1st Base', '2nd Base', 'Shortstop', '3rd Base', 'Left Field', 'Center Field', 'Right Field'];
  for (let ing = 1; ing <= 3; ing++) {
    const asgn = {};
    // Shuffle player order slightly per inning
    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    positions.forEach((pos, i) => {
      if (shuffled[i]) asgn[pos] = shuffled[i];
    });
    // Remaining go to bench
    shuffled.slice(9).forEach((pid, i) => {
      asgn[`Bench ${i + 1}`] = pid;
    });
    demoLineups[ing] = asgn;
  }

  await setDoc(gameRef, {
    gameNumber: 1,
    date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    opponent: 'Sample Sharks',
    innings: 3,
    lineups: demoLineups,
    committedAt: serverTimestamp(),
  });

  // Add team to user's teamIds
  const userRef = doc(db, 'users', userId);
  await updateDoc(userRef, { teamIds: arrayUnion(teamId) });

  return teamId;
}
