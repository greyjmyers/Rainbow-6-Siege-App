import type { Side } from "../data/operators";
import type { Comfort, Player, RoundLog, Settings } from "./types";

/**
 * Win-chance model.
 *
 *   logit(P(win)) = logit(baseRate[map, side, site])
 *                 + LINEUP_WEIGHT * Σ playerOnOpEdge
 *                 − composition penalties
 *
 * Every rate is a Beta-smoothed estimate that shrinks toward its parent
 * (site → map → side → 50%), so a single lucky round can't swing the numbers.
 * With no logged rounds the output is driven entirely by comfort ratings.
 *
 * Imported rounds (e.g. from match history) are weaker evidence than rounds
 * logged live with the exact lineup, so each one counts as `importWeight` of
 * a round. Unknown fields stay unknown — they are never filled with guesses.
 */

export const PRIOR_WEIGHT = 8; // "pseudo-rounds" of belief in each prior
export const LINEUP_WEIGHT = 0.5;
export const DEFAULT_IMPORT_WEIGHT = 0.4;

// Comfort → prior win rate on that operator. Unrated sits just below neutral.
const COMFORT_PRIOR: Record<Comfort, number> = {
  0: 0.3,
  1: 0.42,
  2: 0.46,
  3: 0.5,
  4: 0.54,
  5: 0.58,
};
const UNRATED_PRIOR = 0.46;
const RANDOM_PRIOR = 0.5;

export const logit = (p: number) => Math.log(p / (1 - p));
export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

function shrink(prior: number, wins: number, n: number, k = PRIOR_WEIGHT) {
  return (prior * k + wins) / (k + n);
}

export function logWeight(l: RoundLog, importWeight: number) {
  return l.source === "import" ? importWeight : 1;
}

/** Weighted wins and rounds. */
function tally(logs: RoundLog[], importWeight: number) {
  let w = 0,
    n = 0;
  for (const l of logs) {
    const k = logWeight(l, importWeight);
    n += k;
    if (l.won) w += k;
  }
  return { w, n };
}

export interface BaseRate {
  p: number;
  /** Rounds (unweighted count) that directly informed the most specific level. */
  n: number;
}

export function baseRate(
  logs: RoundLog[],
  side: Side,
  mapId: string,
  siteId?: string,
  importWeight = DEFAULT_IMPORT_WEIGHT,
): BaseRate {
  // Each level's prior comes only from rounds *outside* that level, so a round
  // is never counted twice on its way up the hierarchy.
  const sideLogs = logs.filter((l) => l.side === side);
  const s = tally(sideLogs, importWeight);
  const mapLogs = sideLogs.filter((l) => l.mapId === mapId);
  const m = tally(mapLogs, importWeight);
  const pOtherMaps = shrink(0.5, s.w - m.w, s.n - m.n);
  if (!siteId) return { p: shrink(pOtherMaps, m.w, m.n), n: mapLogs.length };

  const siteLogs = mapLogs.filter((l) => l.siteId === siteId);
  const st = tally(siteLogs, importWeight);
  const pOtherSites = shrink(pOtherMaps, m.w - st.w, m.n - st.n);
  return { p: shrink(pOtherSites, st.w, st.n), n: siteLogs.length };
}

export function comfortPrior(player: Player | undefined, opId: string): number {
  if (!player) return RANDOM_PRIOR;
  const c = player.comfort[opId];
  return c === undefined ? UNRATED_PRIOR : COMFORT_PRIOR[c];
}

export interface Edge {
  /** Logit edge this player brings on this operator vs. their average. */
  edge: number;
  p: number;
  n: number;
}

/**
 * How much better (in logit) a player is on this operator than they are on
 * an average round on this side. Centering on the player's own baseline keeps
 * the team's overall form from being counted twice (it's already in baseRate).
 */
export function playerOpEdge(
  logs: RoundLog[],
  player: Player | undefined,
  side: Side,
  opId: string,
  importWeight = DEFAULT_IMPORT_WEIGHT,
): Edge {
  const prior = comfortPrior(player, opId);
  if (!player) return { edge: logit(prior) - logit(RANDOM_PRIOR), p: prior, n: 0 };

  let opW = 0,
    opN = 0,
    allW = 0,
    allN = 0,
    opCount = 0;
  for (const l of logs) {
    if (l.side !== side) continue;
    const pick = l.picks.find((p) => p.playerId === player.id);
    if (!pick) continue;
    const k = logWeight(l, importWeight);
    allN += k;
    if (l.won) allW += k;
    if (pick.opId === opId) {
      opN += k;
      if (l.won) opW += k;
      opCount++;
    }
  }
  const pOverall = shrink(0.5, allW, allN);
  // The comfort prior is expressed relative to 50%, so re-anchor it on the player's baseline.
  const anchored = sigmoid(logit(pOverall) + logit(prior));
  const p = shrink(anchored, opW, opN);
  return { edge: logit(p) - logit(pOverall), p, n: opCount };
}

/**
 * Probability of each site being defended, for attack-side planning.
 * Blends how often this map's sites showed up in our logs with the
 * "defenders stay after a win" tendency from the previous round.
 */
export function predictSites(
  logs: RoundLog[],
  settings: Settings,
  mapId: string,
  siteIds: string[],
  prev?: { siteId: string; defendersWon: boolean },
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const id of siteIds) counts[id] = 1; // Dirichlet(1) prior
  for (const l of logs) {
    if (l.side === "attack" && l.mapId === mapId && l.siteId && l.siteId in counts) {
      counts[l.siteId] += logWeight(l, settings.importWeight);
    }
  }
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const freq: Record<string, number> = {};
  for (const id of siteIds) freq[id] = counts[id] / total;

  if (!prev || !(prev.siteId in freq)) return freq;

  const pRepeat = repeatRate(logs, settings, prev.defendersWon);
  const othersMass = 1 - freq[prev.siteId];
  const out: Record<string, number> = {};
  for (const id of siteIds) {
    if (id === prev.siteId) out[id] = pRepeat;
    else out[id] = othersMass > 0 ? ((1 - pRepeat) * freq[id]) / othersMass : 0;
  }
  return out;
}

/** Learned from consecutive attack rounds in the same match, shrunk to the settings prior. */
export function repeatRate(logs: RoundLog[], settings: Settings, defendersWon: boolean) {
  const prior = defendersWon ? settings.repeatAfterDefWin : settings.repeatAfterDefLoss;
  const byMatch = new Map<string, RoundLog[]>();
  for (const l of logs) {
    if (l.side !== "attack" || !l.siteId) continue;
    const arr = byMatch.get(l.matchId) ?? [];
    arr.push(l);
    byMatch.set(l.matchId, arr);
  }
  let repeats = 0,
    n = 0;
  for (const rounds of byMatch.values()) {
    rounds.sort((a, b) => a.round - b.round);
    for (let i = 1; i < rounds.length; i++) {
      const a = rounds[i - 1],
        b = rounds[i];
      if (b.round !== a.round + 1) continue;
      // We lost the round on attack ⇔ the defenders won it.
      if (!a.won !== defendersWon) continue;
      const k = Math.min(logWeight(a, settings.importWeight), logWeight(b, settings.importWeight));
      n += k;
      if (a.siteId === b.siteId) repeats += k;
    }
  }
  return shrink(prior, repeats, n, 5);
}
