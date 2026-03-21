/**
 * DugoutIQ Defensive Rotation Engine
 * 
 * Ported from the proven Pabst Softball algorithm with enhancements:
 * - Configurable rules (position min ratings, bench constraints, infield caps)
 * - Variable innings (3–9) 
 * - Final inning LFG/OOR pocket card system
 * - Dev inning cycle (configurable)
 */

const POSITIONS = {
  infield: ['Pitcher', 'Catcher', '1st Base', '2nd Base', 'Shortstop', '3rd Base'],
  outfield: ['Left Field', 'Center Field', 'Right Field'],
  bench: ['Bench 1', 'Bench 2', 'Bench 3'],
};

const ALL_FIELD_POSITIONS = [...POSITIONS.infield, ...POSITIONS.outfield];
const INFIELD_POSITIONS = ['1st Base', '2nd Base', '3rd Base', 'Shortstop'];
const OUTFIELD_POSITIONS = ['Left Field', 'Center Field', 'Right Field'];

/**
 * Generate a full game rotation
 * @param {Object} params
 * @param {Array} params.players - Active players for today
 * @param {number} params.standardInnings - Number of standard innings (total - 1 for pocket card)
 * @param {Object} params.settings - Team settings with rules
 * @param {Object} params.positionHistory - Historical position counts from saved games
 * @returns {{ innings: Object, lfg: Object, oor: Object }}
 */
export function buildFullRotation({ players, standardInnings, settings, positionHistory = {}, inningModes = {} }) {
  if (!players.length) return { innings: {}, lfg: {}, oor: {} };

  const sorted = [...players].sort((a, b) => b.defRating - a.defRating);
  const pitchers = players.filter(p => p.canPitch).sort((a, b) => b.defRating - a.defRating);
  const bestPitcher = pitchers[0] || null;
  const catchers = players.filter(p => p.canCatch);
  const benchCount = Math.max(0, players.length - 9);

  const innings = {};
  let benchedLastInning = new Set();

  for (let ing = 1; ing <= standardInnings; ing++) {
    // inningModes: { 1: 'competitive', 2: 'development', 3: 'competitive', ... }
    // Default to competitive if not specified
    const mode = inningModes[ing] || 'competitive';
    const isDevInning = mode === 'development';

    const assignment = {};
    const used = new Set();

    // 1. Pitcher — highest rated pitcher for competitive, rotate for dev
    if (pitchers.length) {
      if (isDevInning) {
        // Dev: use a non-best pitcher if available, to give them experience
        const devPitcher = pitchers.find((p, i) => i > 0 && !used.has(p.id)) || bestPitcher;
        if (devPitcher) { assignment['Pitcher'] = devPitcher.id; used.add(devPitcher.id); }
      } else {
        // Competitive: best pitcher
        assignment['Pitcher'] = bestPitcher.id;
        used.add(bestPitcher.id);
      }
    } else {
      const best = sorted.find(p => !used.has(p.id));
      if (best) { assignment['Pitcher'] = best.id; used.add(best.id); }
    }

    // 2. Catcher
    if (catchers.length) {
      const avail = catchers.filter(p => !used.has(p.id));
      if (avail.length) {
        const scored = avail.map(p => ({
          p,
          score: p.defRating * 10
            - (positionHistory[p.id]?.['Catcher'] || 0) * 3
            - (countPosInGame(innings, ing, 'Catcher', p.id) >= 2 ? 999 : 0)
            - (countPosInGame(innings, ing, 'Catcher', p.id) === 1 ? 8 : 0)
        })).sort((a, b) => b.score - a.score);
        assignment['Catcher'] = scored[0].p.id;
        used.add(scored[0].p.id);
      }
    }

    // 3. Bench selection — tier-based fairness system
    const benched = new Set();
    if (benchCount > 0) {
      // Count bench from saved games AND current game being generated
      const benchHistory = (p) => {
        const savedBench = (positionHistory[p.id]?.['Bench 1'] || 0)
          + (positionHistory[p.id]?.['Bench 2'] || 0)
          + (positionHistory[p.id]?.['Bench 3'] || 0);
        const currentGameBench = countBenchedInGame(innings, ing - 1, p.id);
        return savedBench + currentGameBench;
      };

      // Min-rating immunity: if a position's min-rating pool is thin (≤1 eligible),
      // those players are immune from bench in competitive innings
      const immuneIds = new Set();
      if (!isDevInning) {
        const minRatings = settings.positionMinRatings || {};
        for (const [pos, minRating] of Object.entries(minRatings)) {
          if (!minRating || pos === 'Pitcher' || pos === 'Catcher') continue;
          const eligible = players.filter(p => !used.has(p.id) && p.defRating >= minRating);
          if (eligible.length <= 1) {
            eligible.forEach(p => immuneIds.add(p.id));
          }
        }
      }

      // Tier-based bench fairness
      const ratio = settings.benchRatioTier2 || 1.5;
      const available = players.filter(p => !used.has(p.id));
      const tier1Pool = available.filter(p => p.defRating <= 3);
      const tier2Pool = available.filter(p => p.defRating >= 4);
      const tier1AvgBench = tier1Pool.length ? tier1Pool.reduce((s, p) => s + benchHistory(p), 0) / tier1Pool.length : 0;
      const tier2AvgBench = tier2Pool.length ? tier2Pool.reduce((s, p) => s + benchHistory(p), 0) / tier2Pool.length : 0;
      const tier2UnderQuota = tier2Pool.length > 0 && tier2AvgBench < tier1AvgBench / ratio;

      const benchSort = (a, b) => {
        if (isDevInning) {
          // Dev innings: higher rated sit first — give developing players field time
          const tier = b.defRating - a.defRating;
          if (tier !== 0) return tier;
          return benchHistory(a) - benchHistory(b);
        }
        // Competitive: tier 1 (≤3★) benches before tier 2 (≥4★)
        // Tier 2 only mixes in when they're under their quota
        const aTier = a.defRating >= 4 ? 2 : 1;
        const bTier = b.defRating >= 4 ? 2 : 1;
        if (aTier !== bTier && !tier2UnderQuota) return aTier - bTier;
        // Within same tier (or both eligible): fewest bench sits first, lower rated as tiebreak
        const diff = benchHistory(a) - benchHistory(b);
        if (diff !== 0) return diff;
        return a.defRating - b.defRating;
      };

      const noB2B = settings.noBackToBackBench;
      // Build pool: tier 1 always included; tier 2 only when under quota (or dev inning)
      const allCandidates = available
        .filter(p => isDevInning || p.defRating <= 3 || tier2UnderQuota)
        .sort(benchSort);

      // Pass 1: prefer players not yet benched this game, respect back-to-back + immunity
      const pass1 = allCandidates
        .filter(p => !immuneIds.has(p.id) && countBenchedInGame(innings, ing - 1, p.id) === 0 && (!noB2B || !benchedLastInning.has(p.id)));
      for (const p of pass1) { if (benched.size >= benchCount) break; benched.add(p.id); used.add(p.id); }

      // Pass 2: relax "not yet benched this game", still respect back-to-back + immunity
      if (benched.size < benchCount) {
        const pass2 = allCandidates.filter(p => !used.has(p.id) && !immuneIds.has(p.id) && (!noB2B || !benchedLastInning.has(p.id)));
        for (const p of pass2) { if (benched.size >= benchCount) break; benched.add(p.id); used.add(p.id); }
      }

      // Pass 3: relax back-to-back, still respect immunity
      if (benched.size < benchCount) {
        const pass3 = allCandidates.filter(p => !used.has(p.id) && !immuneIds.has(p.id));
        for (const p of pass3) { if (benched.size >= benchCount) break; benched.add(p.id); used.add(p.id); }
      }

      // Pass 4: last resort — anyone remaining (even tier 2 excluded from pool, even immune)
      if (benched.size < benchCount) {
        const pass4 = available.filter(p => !used.has(p.id)).sort(benchSort);
        for (const p of pass4) { if (benched.size >= benchCount) break; benched.add(p.id); used.add(p.id); }
      }
    }

    // 4. Field positions
    const fieldPositions = ALL_FIELD_POSITIONS.filter(p => p !== 'Pitcher' && p !== 'Catcher');
    const fieldPlayers = sorted.filter(p => !used.has(p.id));
    const fieldAsgn = assignFieldPositions(fieldPlayers, fieldPositions, ing, innings, positionHistory, settings, isDevInning);
    Object.assign(assignment, fieldAsgn);

    // 5. Bench slots
    const benchArr = [...benched];
    benchArr.forEach((pid, i) => {
      assignment[`Bench ${i + 1}`] = pid;
    });

    innings[ing] = assignment;
    benchedLastInning = benched;
  }

  // Build LFG and OOR pocket cards
  const lfg = buildLFGLineup(players, positionHistory, innings, standardInnings);
  const oor = buildOORLineup(players, positionHistory, innings, standardInnings);

  return { innings, lfg, oor };
}

// ── Field position assignment ──

function scoreFieldPlayer(p, pos, ing, gameInnings, positionHistory, settings, isDevInning) {
  // Position minimum rating check (configurable per position)
  const minRatings = settings.positionMinRatings || {};
  const minRating = minRatings[pos];
  if (minRating && !isDevInning && p.defRating < minRating) return -9999;

  // Infield cap check — skipped during development innings
  if (settings.infieldCapEnabled && !isDevInning && INFIELD_POSITIONS.includes(pos)) {
    const infieldCount = Object.entries(gameInnings)
      .filter(([ingKey]) => parseInt(ingKey) < ing)
      .filter(([, asgn]) => {
        const playerPos = Object.entries(asgn).find(([, id]) => id === p.id)?.[0];
        return INFIELD_POSITIONS.includes(playerPos);
      }).length;
    if (infieldCount >= (settings.infieldCapValue || 2)) return -9999;
  }

  const jitter = (Math.random() - 0.5) * 0.4;
  const prevPos = getPrevInningPos(gameInnings, ing, p.id);
  const posCount = countPosInGame(gameInnings, ing, pos, p.id);

  return p.defRating * 10
    + jitter
    - (posCount >= 2 ? 999 : posCount === 1 ? 20 : 0)
    - (prevPos === pos ? 8 : 0)
    - (positionHistory[p.id]?.[pos] || 0) * 3
    + (Math.max(0, 3 - (positionHistory[p.id]?.[pos] || 0)) * 2)
    + ((p.prefPositions || []).includes(pos) ? 5 : 0)
    + (ing > 1 && (prevPos === 'Bench 1' || prevPos === 'Bench 2' || prevPos === 'Bench 3') ? 4 : 0);
}

function assignFieldPositions(fieldPlayers, fieldPositions, ing, gameInnings, positionHistory, settings, isDevInning) {
  const assignment = {};
  const usedPlayers = new Set();

  const infield = fieldPositions.filter(p => INFIELD_POSITIONS.includes(p));
  const outfield = fieldPositions.filter(p => OUTFIELD_POSITIONS.includes(p));

  function bestFit(positions, candidates) {
    for (const pos of positions) {
      const avail = candidates.filter(p => !usedPlayers.has(p.id));
      if (!avail.length) break;
      const scored = avail
        .map(p => ({ p, score: scoreFieldPlayer(p, pos, ing, gameInnings, positionHistory, settings, isDevInning) }))
        .filter(x => x.score > -9000)
        .sort((a, b) => b.score - a.score);
      if (!scored.length) continue;
      assignment[pos] = scored[0].p.id;
      usedPlayers.add(scored[0].p.id);
    }
  }

  if (isDevInning) {
    const allPos = [...infield, ...outfield].sort(() => Math.random() - 0.5);
    bestFit(allPos, fieldPlayers);
  } else {
    bestFit(infield, fieldPlayers);
    bestFit(outfield, fieldPlayers);
  }

  // Fallback for unfilled
  for (const pos of fieldPositions) {
    if (assignment[pos]) continue;
    const remaining = fieldPlayers.find(p => !usedPlayers.has(p.id));
    if (remaining) { assignment[pos] = remaining.id; usedPlayers.add(remaining.id); }
  }

  return assignment;
}

// ── LFG (Win Mode) ──

function buildLFGLineup(players, positionHistory, gameInnings = {}, standardInnings = 0) {
  if (!players.length) return null;
  const sorted = [...players].sort((a, b) => b.defRating - a.defRating);
  const assignment = {};
  const used = new Set();

  const benchCounts = {};
  players.forEach(p => { benchCounts[p.id] = countBenchedInGame(gameInnings, standardInnings, p.id); });

  const pitchers = players.filter(p => p.canPitch).sort((a, b) => b.defRating - a.defRating);
  if (pitchers.length) { assignment['Pitcher'] = pitchers[0].id; used.add(pitchers[0].id); }
  else { const best = sorted[0]; if (best) { assignment['Pitcher'] = best.id; used.add(best.id); } }

  const catchers = players.filter(p => p.canCatch && !used.has(p.id));
  if (catchers.length) {
    const best = catchers.sort((a, b) => b.defRating - a.defRating)[0];
    assignment['Catcher'] = best.id; used.add(best.id);
  }

  const fieldPositions = [...INFIELD_POSITIONS, ...OUTFIELD_POSITIONS];
  for (const pos of fieldPositions) {
    const avail = sorted.filter(p => !used.has(p.id));
    if (!avail.length) break;
    const scored = avail.map(p => ({
      p, score: p.defRating * 10 + ((p.prefPositions || []).includes(pos) ? 5 : 0) - (positionHistory[p.id]?.[pos] || 0) * 0.5
    })).sort((a, b) => b.score - a.score);
    assignment[pos] = scored[0].p.id; used.add(scored[0].p.id);
  }

  const remaining = sorted.filter(p => !used.has(p.id));
  remaining.sort((a, b) => (benchCounts[a.id] || 0) - (benchCounts[b.id] || 0));
  remaining.forEach((p, i) => { assignment[`Bench ${i + 1}`] = p.id; });

  return assignment;
}

// ── OOR (Shuffle Mode) ──

function buildOORLineup(players, positionHistory, gameInnings = {}, standardInnings = 0) {
  if (!players.length) return null;
  const sorted = [...players].sort((a, b) => a.defRating - b.defRating + (Math.random() - 0.5));
  const assignment = {};
  const used = new Set();

  const benchCounts = {};
  players.forEach(p => { benchCounts[p.id] = countBenchedInGame(gameInnings, standardInnings, p.id); });

  const pitchers = players.filter(p => p.canPitch).sort((a, b) => b.defRating - a.defRating);
  if (pitchers.length > 1) { assignment['Pitcher'] = pitchers[1].id; used.add(pitchers[1].id); }
  else if (pitchers.length) { assignment['Pitcher'] = pitchers[0].id; used.add(pitchers[0].id); }
  else { const best = sorted[sorted.length - 1]; if (best) { assignment['Pitcher'] = best.id; used.add(best.id); } }

  const catchers = players.filter(p => p.canCatch && !used.has(p.id))
    .sort((a, b) => (positionHistory[a.id]?.['Catcher'] || 0) - (positionHistory[b.id]?.['Catcher'] || 0));
  if (catchers.length) { assignment['Catcher'] = catchers[0].id; used.add(catchers[0].id); }

  const benchCount = Math.max(0, players.length - 9);
  const strong = [...players].filter(p => !used.has(p.id)).sort((a, b) => {
    const aBenched = benchCounts[a.id] || 0;
    const bBenched = benchCounts[b.id] || 0;
    if (aBenched === 0 && bBenched > 0) return -1;
    if (bBenched === 0 && aBenched > 0) return 1;
    return b.defRating - a.defRating;
  });
  const benched = [];
  for (const p of strong) { if (benched.length >= benchCount) break; benched.push(p); used.add(p.id); }
  benched.forEach((p, i) => { assignment[`Bench ${i + 1}`] = p.id; });

  const fieldPositions = [...INFIELD_POSITIONS, ...OUTFIELD_POSITIONS];
  for (const pos of fieldPositions) {
    const avail = sorted.filter(p => !used.has(p.id));
    if (!avail.length) break;
    const scored = avail.map(p => ({ p, score: -(positionHistory[p.id]?.[pos] || 0) * 5 + (Math.random() * 2) })).sort((a, b) => b.score - a.score);
    assignment[pos] = scored[0].p.id; used.add(scored[0].p.id);
  }

  return assignment;
}

// ── Helpers ──

function getPrevInningPos(gameInnings, ing, playerId) {
  if (ing <= 1) return null;
  const prev = gameInnings[ing - 1];
  if (!prev) return null;
  return Object.entries(prev).find(([, id]) => id === playerId)?.[0] || null;
}

function countBenchedInGame(gameInnings, upToInning, playerId) {
  let count = 0;
  for (let i = 1; i <= upToInning; i++) {
    const asgn = gameInnings[i];
    if (!asgn) continue;
    for (const [pos, id] of Object.entries(asgn)) {
      if (id === playerId && pos.startsWith('Bench')) count++;
    }
  }
  return count;
}

function countPosInGame(gameInnings, upToInning, pos, playerId) {
  let count = 0;
  for (let i = 1; i < upToInning; i++) {
    if (gameInnings[i]?.[pos] === playerId) count++;
  }
  return count;
}

export { POSITIONS, ALL_FIELD_POSITIONS, INFIELD_POSITIONS, OUTFIELD_POSITIONS };
