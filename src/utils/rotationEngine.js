/**
 * DugoutIQ Defensive Rotation Engine
 *
 * ============================================================================
 * RULES / CONSTANTS
 * ============================================================================
 *
 * BENCH SELECTION (competitive innings):
 *   - Tier 2 (4-5 star) gets a flat offset equal to `benchRatioTier2` setting
 *     (default 1.5) added to their bench history score. They won't bench until
 *     tier 1 players average that many bench sits.
 *   - Within tier: fewest bench sits first, lower rated as tiebreak.
 *   - 4 passes:
 *       (1) not yet benched this game + noB2B + immunity
 *       (2) relax "not yet benched this game"
 *       (3) relax noB2B
 *       (4) anyone remaining
 *   - Min-rating immunity: if only 1 player meets a position's min-rating,
 *     they are immune from bench in competitive innings.
 *
 * BENCH SELECTION (dev innings):
 *   - Pure fairness: fewest bench sits first, lower rated as tiebreak.
 *     No tier protection.
 *
 * POSITION MIN-RATINGS:
 *   - Competitive: hard block below min-rating (-9999).
 *   - Dev: allow 1 star below min (effectiveMin = minRating - 1, minimum 1).
 *   - Enforced in BOTH scoring AND fallback.
 *   - Positions with min-ratings are processed FIRST (highest min first)
 *     so qualified players aren't consumed by other positions.
 *
 * FIELD POSITION SCORING:
 *   - Rating weight: competitive infield=10, competitive outfield=4, dev=2.
 *   - Jitter: +/-0.25 (small, won't override history).
 *   - In-game repeat: -999 for 3rd+ time at same position, -20 for 2nd time.
 *   - Same position as last inning: -8.
 *   - Cross-game history: -5 per count.
 *   - New position bonus: +3 per slot below 3 (max +9).
 *   - Preferred position: +5.
 *   - Coming off bench: +4.
 *   - Sticky positions: +15 if player was at this same position last inning
 *     AND the position has a min-rating >= 3. Keeps key players (1B, SS, etc.)
 *     in place for at least 2 consecutive innings.
 *   - Infield cap enforced in competitive only.
 *
 * POSITION ASSIGNMENT ORDER:
 *   - Competitive: min-rated infield first (highest min first), then
 *     remaining infield (shuffled), then outfield (shuffled).
 *   - Dev: min-rated positions first (highest min first), then remaining
 *     (shuffled).
 *   - Fallback respects min-ratings; last-resort only if positions still empty.
 *
 * PITCHER:
 *   - Competitive: best pitcher.
 *   - Dev: non-best pitcher if available.
 *
 * CATCHER:
 *   - Score by rating, penalize repeats.
 *
 * LFG / OOR POCKET CARDS:
 *   - Kept as-is (win mode / shuffle mode).
 *
 * ============================================================================
 */

// ---------------------------------------------------------------------------
// Position constants
// ---------------------------------------------------------------------------

const POSITIONS = {
  infield: ['Pitcher', 'Catcher', '1st Base', '2nd Base', 'Shortstop', '3rd Base'],
  outfield: ['Left Field', 'Center Field', 'Right Field'],
  bench: ['Bench 1', 'Bench 2', 'Bench 3'],
};

const ALL_FIELD_POSITIONS = [...POSITIONS.infield, ...POSITIONS.outfield];
const INFIELD_POSITIONS = ['1st Base', '2nd Base', '3rd Base', 'Shortstop'];
const OUTFIELD_POSITIONS = ['Left Field', 'Center Field', 'Right Field'];

// ---------------------------------------------------------------------------
// Scoring constants
// ---------------------------------------------------------------------------

const SCORE_MIN_RATING_BLOCK    = -9999;
const SCORE_INFIELD_CAP_BLOCK   = -9999;
const SCORE_THIRD_REPEAT        = -999;
const SCORE_SECOND_REPEAT       = -20;
const SCORE_SAME_AS_LAST_INNING = -8;
const SCORE_CROSS_GAME_HISTORY  = -5;
const SCORE_NEW_POSITION_BONUS  = 3;    // per slot below 3 history count (max +9)
const SCORE_PREFERRED_POSITION  = 5;
const SCORE_COMING_OFF_BENCH    = 4;
// Sticky position bonus by level (0 = off, 1–5 = increasing stickiness)
const STICKY_BONUS_BY_LEVEL     = [0, 5, 10, 15, 20, 25];
const SCORE_JITTER_RANGE        = 0.5;  // total range; applied as (random - 0.5) * 0.5

const RATING_WEIGHT_COMPETITIVE_INFIELD  = 10;
const RATING_WEIGHT_COMPETITIVE_OUTFIELD = 4;
const RATING_WEIGHT_DEV                  = 2;

const DEFAULT_BENCH_RATIO_TIER2 = 1.5;
const TIER2_MIN_RATING          = 4;

// ---------------------------------------------------------------------------
// Helpers (preserved as-is)
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Bench history — saved history + current game
// ---------------------------------------------------------------------------

function getBenchHistory(playerId, positionHistory, gameInnings, currentInning) {
  const saved = (positionHistory[playerId]?.['Bench 1'] || 0)
    + (positionHistory[playerId]?.['Bench 2'] || 0)
    + (positionHistory[playerId]?.['Bench 3'] || 0);
  return saved + countBenchedInGame(gameInnings, currentInning - 1, playerId);
}

// ---------------------------------------------------------------------------
// Min-rating immunity — competitive only
// If only 1 player meets a position's min-rating, they are immune from bench.
// ---------------------------------------------------------------------------

function computeImmuneIds(players, usedIds, settings) {
  const immuneIds = new Set();
  const minRatings = settings.positionMinRatings || {};

  for (const [pos, minRating] of Object.entries(minRatings)) {
    if (!minRating || pos === 'Pitcher' || pos === 'Catcher') continue;
    const eligible = players.filter(p => !usedIds.has(p.id) && p.defRating >= minRating);
    if (eligible.length <= 1) {
      eligible.forEach(p => immuneIds.add(p.id));
    }
  }

  return immuneIds;
}

// ---------------------------------------------------------------------------
// Bench selection
// ---------------------------------------------------------------------------

function selectBench(players, usedIds, benchCount, ing, gameInnings, positionHistory, settings, isDevInning, benchedLastInning) {
  if (benchCount <= 0) return new Set();

  const benched = new Set();
  const used = new Set(usedIds);
  const ratio = settings.benchRatioTier2 ?? DEFAULT_BENCH_RATIO_TIER2;
  const noB2B = settings.noBackToBackBench;
  const immuneIds = isDevInning ? new Set() : computeImmuneIds(players, used, settings);

  const benchHistory = (p) => getBenchHistory(p.id, positionHistory, gameInnings, ing);

  const benchSort = (a, b) => {
    if (isDevInning) {
      // Pure fairness: fewest bench sits first, lower rated as tiebreak
      const diff = benchHistory(a) - benchHistory(b);
      return diff !== 0 ? diff : a.defRating - b.defRating;
    }
    // Competitive: tier 2 offset + tiny rating tiebreak (lower rated benches first)
    const aEff = benchHistory(a) + (a.defRating >= TIER2_MIN_RATING ? ratio : 0) + a.defRating * 0.01;
    const bEff = benchHistory(b) + (b.defRating >= TIER2_MIN_RATING ? ratio : 0) + b.defRating * 0.01;
    return aEff - bEff;
  };

  const candidates = players.filter(p => !used.has(p.id)).sort(benchSort);

  const fillFromPass = (filterFn) => {
    for (const p of candidates) {
      if (benched.size >= benchCount) break;
      if (used.has(p.id)) continue;
      if (!filterFn(p)) continue;
      benched.add(p.id);
      used.add(p.id);
    }
  };

  // Pass 1: not yet benched this game + noB2B + immunity
  fillFromPass(p =>
    !immuneIds.has(p.id)
    && countBenchedInGame(gameInnings, ing - 1, p.id) === 0
    && (!noB2B || !benchedLastInning.has(p.id))
  );

  // Pass 2: relax "not yet benched this game"
  fillFromPass(p =>
    !immuneIds.has(p.id)
    && (!noB2B || !benchedLastInning.has(p.id))
  );

  // Pass 3: relax noB2B, still respect immunity
  fillFromPass(p => !immuneIds.has(p.id));

  // Pass 4: anyone remaining (even immune)
  fillFromPass(() => true);

  return benched;
}

// ---------------------------------------------------------------------------
// Field position scoring
// ---------------------------------------------------------------------------

function scoreFieldPlayer(p, pos, ing, gameInnings, positionHistory, settings, isDevInning) {
  const minRatings = settings.positionMinRatings || {};
  const minRating = minRatings[pos];

  // Min-rating enforcement
  if (minRating) {
    const effectiveMin = isDevInning ? Math.max(1, minRating - 1) : minRating;
    if (p.defRating < effectiveMin) return SCORE_MIN_RATING_BLOCK;
  }

  // Infield cap — competitive only
  if (settings.infieldCapEnabled && !isDevInning && INFIELD_POSITIONS.includes(pos)) {
    const infieldCount = Object.entries(gameInnings)
      .filter(([ingKey]) => parseInt(ingKey) < ing)
      .filter(([, asgn]) => {
        const playerPos = Object.entries(asgn).find(([, id]) => id === p.id)?.[0];
        return INFIELD_POSITIONS.includes(playerPos);
      }).length;
    if (infieldCount >= (settings.infieldCapValue || 2)) return SCORE_INFIELD_CAP_BLOCK;
  }

  const jitter = (Math.random() - 0.5) * SCORE_JITTER_RANGE;
  const prevPos = getPrevInningPos(gameInnings, ing, p.id);
  const posCount = countPosInGame(gameInnings, ing, pos, p.id);
  const histCount = positionHistory[p.id]?.[pos] || 0;

  const ratingWeight = isDevInning
    ? RATING_WEIGHT_DEV
    : (OUTFIELD_POSITIONS.includes(pos) ? RATING_WEIGHT_COMPETITIVE_OUTFIELD : RATING_WEIGHT_COMPETITIVE_INFIELD);

  const comingOffBench = prevPos && prevPos.startsWith('Bench');

  // Sticky positions: level 1-5 controls how strongly players stick to
  // high-min-rating positions. Level 3 matches the old boolean behavior (+15).
  // Levels 1-2 only cancel same-as-last penalty; levels 3-5 cancel both.
  const rawSticky = settings.stickyPositions;
  const stickyLevel = rawSticky === true ? 3 : (Number(rawSticky) || 0);
  const isSticky = stickyLevel > 0 && prevPos === pos && minRating >= 3;

  const cancelRepeat = isSticky && stickyLevel >= 3;
  const cancelSameAsLast = isSticky;

  const repeatPenalty = cancelRepeat ? 0
    : (posCount >= 2 ? SCORE_THIRD_REPEAT : posCount === 1 ? SCORE_SECOND_REPEAT : 0);
  const sameAsLastPenalty = cancelSameAsLast ? 0
    : (prevPos === pos ? SCORE_SAME_AS_LAST_INNING : 0);
  const stickyBonus = isSticky ? STICKY_BONUS_BY_LEVEL[stickyLevel] : 0;

  return p.defRating * ratingWeight
    + jitter
    + repeatPenalty
    + sameAsLastPenalty
    + stickyBonus
    + histCount * SCORE_CROSS_GAME_HISTORY
    + Math.max(0, 3 - histCount) * SCORE_NEW_POSITION_BONUS
    + ((p.prefPositions || []).includes(pos) ? SCORE_PREFERRED_POSITION : 0)
    + (ing > 1 && comingOffBench ? SCORE_COMING_OFF_BENCH : 0);
}

// ---------------------------------------------------------------------------
// Field position assignment
// ---------------------------------------------------------------------------

function assignFieldPositions(fieldPlayers, fieldPositions, ing, gameInnings, positionHistory, settings, isDevInning) {
  const assignment = {};
  const usedPlayers = new Set();
  const minRatings = settings.positionMinRatings || {};

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

  const minRatedPos = fieldPositions.filter(p => minRatings[p]);
  const unratedPos = fieldPositions.filter(p => !minRatings[p]);

  if (isDevInning) {
    // Dev: min-rated positions first (highest min first), then remaining (shuffled)
    bestFit(
      minRatedPos.sort((a, b) => (minRatings[b] || 0) - (minRatings[a] || 0)),
      fieldPlayers
    );
    bestFit(
      unratedPos.sort(() => Math.random() - 0.5),
      fieldPlayers
    );
  } else {
    // Competitive: min-rated infield first (highest min first),
    // then remaining infield (shuffled), then outfield (shuffled)
    const infield = fieldPositions.filter(p => INFIELD_POSITIONS.includes(p));
    const outfield = fieldPositions.filter(p => OUTFIELD_POSITIONS.includes(p));

    const minRatedInfield = infield
      .filter(p => minRatings[p])
      .sort((a, b) => (minRatings[b] || 0) - (minRatings[a] || 0));
    const unratedInfield = infield
      .filter(p => !minRatings[p])
      .sort(() => Math.random() - 0.5);

    bestFit([...minRatedInfield, ...unratedInfield], fieldPlayers);
    bestFit(outfield.sort(() => Math.random() - 0.5), fieldPlayers);
  }

  // Fallback: fill any remaining empty positions
  for (const pos of fieldPositions) {
    if (assignment[pos]) continue;
    const effectiveMin = minRatings[pos]
      ? (isDevInning ? Math.max(1, minRatings[pos] - 1) : minRatings[pos])
      : 0;
    // Try qualified players first
    let fill = fieldPlayers.find(p => !usedPlayers.has(p.id) && p.defRating >= effectiveMin);
    // Last-resort: anyone remaining
    if (!fill) {
      fill = fieldPlayers.find(p => !usedPlayers.has(p.id));
    }
    if (fill) {
      assignment[pos] = fill.id;
      usedPlayers.add(fill.id);
    }
  }

  return assignment;
}

// ---------------------------------------------------------------------------
// Pitcher assignment
// ---------------------------------------------------------------------------

function assignPitcher(pitchers, bestPitcher, sorted, used, isDevInning) {
  if (pitchers.length) {
    if (isDevInning) {
      const devPitcher = pitchers.find((p, i) => i > 0 && !used.has(p.id)) || bestPitcher;
      if (devPitcher) { used.add(devPitcher.id); return devPitcher.id; }
    } else {
      used.add(bestPitcher.id);
      return bestPitcher.id;
    }
  }
  const fallback = sorted.find(p => !used.has(p.id));
  if (fallback) { used.add(fallback.id); return fallback.id; }
  return null;
}

// ---------------------------------------------------------------------------
// Catcher assignment
// ---------------------------------------------------------------------------

function assignCatcher(catchers, used, gameInnings, ing, positionHistory) {
  const avail = catchers.filter(p => !used.has(p.id));
  if (!avail.length) return null;

  const scored = avail.map(p => ({
    p,
    score: p.defRating * 10
      - (positionHistory[p.id]?.['Catcher'] || 0) * 3
      - (countPosInGame(gameInnings, ing, 'Catcher', p.id) >= 2 ? 999 : 0)
      - (countPosInGame(gameInnings, ing, 'Catcher', p.id) === 1 ? 8 : 0),
  })).sort((a, b) => b.score - a.score);

  used.add(scored[0].p.id);
  return scored[0].p.id;
}

// ---------------------------------------------------------------------------
// Main entry — build full rotation
// ---------------------------------------------------------------------------

/**
 * Generate a full game rotation.
 * @param {Object}  params
 * @param {Array}   params.players          - Active players for today
 * @param {number}  params.standardInnings  - Number of standard innings (total - 1 for pocket card)
 * @param {Object}  params.settings         - Team settings with rules
 * @param {Object}  params.positionHistory  - Historical position counts from saved games
 * @param {Object}  params.inningModes      - Map of inning number to 'competitive' | 'development'
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
    const mode = inningModes[ing] || 'competitive';
    const isDevInning = mode === 'development';
    const assignment = {};
    const used = new Set();

    // 1. Pitcher
    const pitcherId = assignPitcher(pitchers, bestPitcher, sorted, used, isDevInning);
    if (pitcherId) assignment['Pitcher'] = pitcherId;

    // 2. Catcher
    const catcherId = assignCatcher(catchers, used, innings, ing, positionHistory);
    if (catcherId) assignment['Catcher'] = catcherId;

    // 3. Bench
    const benched = selectBench(
      players, used, benchCount, ing, innings,
      positionHistory, settings, isDevInning, benchedLastInning
    );
    benched.forEach(id => used.add(id));

    // 4. Field positions (excluding Pitcher and Catcher)
    const fieldPositions = ALL_FIELD_POSITIONS.filter(p => p !== 'Pitcher' && p !== 'Catcher');
    const fieldPlayers = sorted.filter(p => !used.has(p.id));
    const fieldAsgn = assignFieldPositions(
      fieldPlayers, fieldPositions, ing, innings,
      positionHistory, settings, isDevInning
    );
    Object.assign(assignment, fieldAsgn);

    // 5. Bench slots
    [...benched].forEach((pid, i) => {
      assignment[`Bench ${i + 1}`] = pid;
    });

    innings[ing] = assignment;
    benchedLastInning = benched;
  }

  // Pocket cards
  const lfg = buildLFGLineup(players, positionHistory, innings, standardInnings);
  const oor = buildOORLineup(players, positionHistory, innings, standardInnings);

  return { innings, lfg, oor };
}

// ---------------------------------------------------------------------------
// LFG (Win Mode) pocket card
// ---------------------------------------------------------------------------

function buildLFGLineup(players, positionHistory, gameInnings = {}, standardInnings = 0) {
  if (!players.length) return null;

  const sorted = [...players].sort((a, b) => b.defRating - a.defRating);
  const assignment = {};
  const used = new Set();

  const benchCounts = {};
  players.forEach(p => { benchCounts[p.id] = countBenchedInGame(gameInnings, standardInnings, p.id); });

  // Pitcher — best pitcher
  const pitchers = players.filter(p => p.canPitch).sort((a, b) => b.defRating - a.defRating);
  if (pitchers.length) {
    assignment['Pitcher'] = pitchers[0].id;
    used.add(pitchers[0].id);
  } else if (sorted[0]) {
    assignment['Pitcher'] = sorted[0].id;
    used.add(sorted[0].id);
  }

  // Catcher — best available
  const catchers = players.filter(p => p.canCatch && !used.has(p.id))
    .sort((a, b) => b.defRating - a.defRating);
  if (catchers.length) {
    assignment['Catcher'] = catchers[0].id;
    used.add(catchers[0].id);
  }

  // Field positions — by rating + preference
  const fieldPositions = [...INFIELD_POSITIONS, ...OUTFIELD_POSITIONS];
  for (const pos of fieldPositions) {
    const avail = sorted.filter(p => !used.has(p.id));
    if (!avail.length) break;
    const scored = avail.map(p => ({
      p,
      score: p.defRating * 10
        + ((p.prefPositions || []).includes(pos) ? 5 : 0)
        - (positionHistory[p.id]?.[pos] || 0) * 0.5,
    })).sort((a, b) => b.score - a.score);
    assignment[pos] = scored[0].p.id;
    used.add(scored[0].p.id);
  }

  // Remaining players to bench — fewest bench sits in game first
  const remaining = sorted.filter(p => !used.has(p.id));
  remaining.sort((a, b) => (benchCounts[a.id] || 0) - (benchCounts[b.id] || 0));
  remaining.forEach((p, i) => { assignment[`Bench ${i + 1}`] = p.id; });

  return assignment;
}

// ---------------------------------------------------------------------------
// OOR (Shuffle Mode) pocket card
// ---------------------------------------------------------------------------

function buildOORLineup(players, positionHistory, gameInnings = {}, standardInnings = 0) {
  if (!players.length) return null;

  const sorted = [...players].sort((a, b) => a.defRating - b.defRating + (Math.random() - 0.5));
  const assignment = {};
  const used = new Set();

  const benchCounts = {};
  players.forEach(p => { benchCounts[p.id] = countBenchedInGame(gameInnings, standardInnings, p.id); });

  // Pitcher — second-best if available
  const pitchers = players.filter(p => p.canPitch).sort((a, b) => b.defRating - a.defRating);
  if (pitchers.length > 1) {
    assignment['Pitcher'] = pitchers[1].id;
    used.add(pitchers[1].id);
  } else if (pitchers.length) {
    assignment['Pitcher'] = pitchers[0].id;
    used.add(pitchers[0].id);
  } else {
    const last = sorted[sorted.length - 1];
    if (last) { assignment['Pitcher'] = last.id; used.add(last.id); }
  }

  // Catcher — least catcher history
  const catchers = players.filter(p => p.canCatch && !used.has(p.id))
    .sort((a, b) => (positionHistory[a.id]?.['Catcher'] || 0) - (positionHistory[b.id]?.['Catcher'] || 0));
  if (catchers.length) {
    assignment['Catcher'] = catchers[0].id;
    used.add(catchers[0].id);
  }

  // Bench — strongest players who haven't been benched yet, then by rating
  const benchCount = Math.max(0, players.length - 9);
  const strong = players.filter(p => !used.has(p.id)).sort((a, b) => {
    const aBenched = benchCounts[a.id] || 0;
    const bBenched = benchCounts[b.id] || 0;
    if (aBenched === 0 && bBenched > 0) return -1;
    if (bBenched === 0 && aBenched > 0) return 1;
    return b.defRating - a.defRating;
  });
  const benchedPlayers = [];
  for (const p of strong) {
    if (benchedPlayers.length >= benchCount) break;
    benchedPlayers.push(p);
    used.add(p.id);
  }
  benchedPlayers.forEach((p, i) => { assignment[`Bench ${i + 1}`] = p.id; });

  // Field positions — variety-driven
  const fieldPositions = [...INFIELD_POSITIONS, ...OUTFIELD_POSITIONS];
  for (const pos of fieldPositions) {
    const avail = sorted.filter(p => !used.has(p.id));
    if (!avail.length) break;
    const scored = avail.map(p => ({
      p,
      score: -(positionHistory[p.id]?.[pos] || 0) * 5 + (Math.random() * 2),
    })).sort((a, b) => b.score - a.score);
    assignment[pos] = scored[0].p.id;
    used.add(scored[0].p.id);
  }

  return assignment;
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export { POSITIONS, ALL_FIELD_POSITIONS, INFIELD_POSITIONS, OUTFIELD_POSITIONS };
