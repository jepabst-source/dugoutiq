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
export function buildFullRotation({ players, standardInnings, settings, positionHistory = {} }) {
  if (!players.length) return { innings: {}, lfg: {}, oor: {} };

  const sorted = [...players].sort((a, b) => b.defRating - a.defRating);
  const p1 = players.find(p => p.role === 'P1');
  const p2 = players.find(p => p.role === 'P2');
  const catchers = players.filter(p => p.canCatch);
  const benchCount = Math.max(0, players.length - 9);

  const innings = {};
  let benchedLastInning = new Set();

  for (let ing = 1; ing <= standardInnings; ing++) {
    const isDevInning = settings.devInningsEnabled && ing % settings.devInningCycle === 0;

    const assignment = {};
    const used = new Set();

    // 1. Pitcher
    if (p1) {
      assignment['Pitcher'] = p1.id;
      used.add(p1.id);
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

    // 3. Bench selection
    const benched = new Set();
    if (benchCount > 0) {
      const benchHistory = (p) =>
        (positionHistory[p.id]?.['Bench 1'] || 0) + (positionHistory[p.id]?.['Bench 2'] || 0);

      const lowerPlayers = players.filter(p => p.defRating <= 3);
      const avgLowerBench = lowerPlayers.length
        ? lowerPlayers.reduce((s, p) => s + benchHistory(p), 0) / lowerPlayers.length
        : 0;
      const upperQuota = avgLowerBench / 3;

      const benchSort = isDevInning
        ? () => Math.random() - 0.5
        : (a, b) => {
            const aHist = benchHistory(a);
            const bHist = benchHistory(b);
            const nudge = avgLowerBench >= 3;
            const aEff = (nudge && a.defRating >= 4 && aHist < upperQuota) ? a.defRating - 1.5 : a.defRating;
            const bEff = (nudge && b.defRating >= 4 && bHist < upperQuota) ? b.defRating - 1.5 : b.defRating;
            const tier = Math.round(aEff) - Math.round(bEff);
            if (tier !== 0) return tier;
            return aHist - bHist;
          };

      // Pass 1: exclude players benched last inning (if no-back-to-back is enabled)
      const noB2B = settings.noBackToBackBench;
      const pass1 = sorted
        .filter(p => !used.has(p.id) && countBenchedInGame(innings, ing - 1, p.id) === 0 && (!noB2B || !benchedLastInning.has(p.id)))
        .sort(benchSort);
      for (const p of pass1) { if (benched.size >= benchCount) break; benched.add(p.id); used.add(p.id); }

      // Pass 2: relax back-to-back constraint
      if (benched.size < benchCount) {
        const pass2 = sorted.filter(p => !used.has(p.id) && countBenchedInGame(innings, ing - 1, p.id) === 0).sort(benchSort);
        for (const p of pass2) { if (benched.size >= benchCount) break; benched.add(p.id); used.add(p.id); }
      }

      // Pass 3: anyone remaining
      if (benched.size < benchCount) {
        const pass3 = sorted.filter(p => !used.has(p.id)).sort(benchSort);
        for (const p of pass3) { if (benched.size >= benchCount) break; benched.add(p.id); used.add(p.id); }
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
  const lfg = buildLFGLineup(players, positionHistory);
  const oor = buildOORLineup(players, positionHistory);

  return { innings, lfg, oor };
}

// ── Field position assignment ──

function scoreFieldPlayer(p, pos, ing, gameInnings, positionHistory, settings, isDevInning) {
  // Position minimum rating check (configurable per position)
  const minRatings = settings.positionMinRatings || {};
  const minRating = minRatings[pos];
  if (minRating && !isDevInning && p.defRating < minRating) return -9999;

  // Infield cap check
  if (settings.infieldCapEnabled && INFIELD_POSITIONS.includes(pos)) {
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

function buildLFGLineup(players, positionHistory) {
  if (!players.length) return null;
  const sorted = [...players].sort((a, b) => b.defRating - a.defRating);
  const assignment = {};
  const used = new Set();

  const p1 = players.find(p => p.role === 'P1');
  if (p1) { assignment['Pitcher'] = p1.id; used.add(p1.id); }

  const catchers = players.filter(p => p.canCatch && !used.has(p.id));
  if (catchers.length) {
    const best = catchers.sort((a, b) => b.defRating - a.defRating)[0];
    assignment['Catcher'] = best.id;
    used.add(best.id);
  }

  const fieldPositions = [...INFIELD_POSITIONS, ...OUTFIELD_POSITIONS];
  for (const pos of fieldPositions) {
    const avail = sorted.filter(p => !used.has(p.id));
    if (!avail.length) break;
    const scored = avail.map(p => ({
      p,
      score: p.defRating * 10
        + ((p.prefPositions || []).includes(pos) ? 5 : 0)
        - (positionHistory[p.id]?.[pos] || 0) * 0.5
    })).sort((a, b) => b.score - a.score);
    assignment[pos] = scored[0].p.id;
    used.add(scored[0].p.id);
  }

  const remaining = sorted.filter(p => !used.has(p.id));
  remaining.forEach((p, i) => {
    assignment[`Bench ${i + 1}`] = p.id;
  });

  return assignment;
}

// ── OOR (Shuffle Mode) ──

function buildOORLineup(players, positionHistory) {
  if (!players.length) return null;
  const sorted = [...players].sort((a, b) => a.defRating - b.defRating + (Math.random() - 0.5));
  const assignment = {};
  const used = new Set();

  const p2 = players.find(p => p.role === 'P2');
  const p1 = players.find(p => p.role === 'P1');
  if (p2) { assignment['Pitcher'] = p2.id; used.add(p2.id); }
  else if (p1) { assignment['Pitcher'] = p1.id; used.add(p1.id); }

  const catchers = players.filter(p => p.canCatch && !used.has(p.id))
    .sort((a, b) => (positionHistory[a.id]?.['Catcher'] || 0) - (positionHistory[b.id]?.['Catcher'] || 0));
  if (catchers.length) { assignment['Catcher'] = catchers[0].id; used.add(catchers[0].id); }

  // Bench strongest players (they rest)
  const benchCount = Math.max(0, players.length - 9);
  const strong = [...players].filter(p => !used.has(p.id)).sort((a, b) => b.defRating - a.defRating);
  const benched = [];
  for (const p of strong) {
    if (benched.length >= benchCount) break;
    benched.push(p);
    used.add(p.id);
  }
  benched.forEach((p, i) => { assignment[`Bench ${i + 1}`] = p.id; });

  // Fill field — lower-rated first, reward first-timers
  const fieldPositions = [...INFIELD_POSITIONS, ...OUTFIELD_POSITIONS];
  for (const pos of fieldPositions) {
    const avail = sorted.filter(p => !used.has(p.id));
    if (!avail.length) break;
    const scored = avail.map(p => ({
      p,
      score: -(positionHistory[p.id]?.[pos] || 0) * 5 + (Math.random() * 2)
    })).sort((a, b) => b.score - a.score);
    assignment[pos] = scored[0].p.id;
    used.add(scored[0].p.id);
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
