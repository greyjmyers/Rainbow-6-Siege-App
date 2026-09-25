import { OPERATORS, type Operator, type Role, type Side } from "../data/operators";
import { LINEUP_WEIGHT, baseRate, logit, playerOpEdge, sigmoid } from "./model";
import type { CompRule, Player, RoundLog, Settings } from "./types";

export interface SlotResult {
  playerId: string | null;
  opId: string;
  edge: number;
  /** Rounds logged for this player on this operator. */
  n: number;
}

export interface Lineup {
  slots: SlotResult[];
  winP: number;
  /** Expected missing roles, weighted by site probability. */
  gaps: { role: Role; missing: number }[];
  score: number;
}

export interface OptimizeInput {
  side: Side;
  mapId: string;
  /** Site probabilities. Defense: {chosenSite: 1}. Attack: the prediction. */
  sites: Record<string, number>;
  slots: (string | null)[];
  bans: string[];
  locks: Record<number, string>;
  players: Player[];
  logs: RoundLog[];
  settings: Settings;
  operators?: Operator[];
  top?: number;
}

const CANDIDATES_PER_SLOT = 12;

export function rulesFor(settings: Settings, side: Side, mapId: string, siteId?: string): CompRule[] {
  const base = settings.rules[side];
  const extra = siteId ? settings.siteRules[`${mapId}:${siteId}`] ?? [] : [];
  // A site rule for a role replaces the generic one (e.g. "2 hard breachers here").
  const byRole = new Map<Role, CompRule>();
  for (const r of base) byRole.set(r.role, r);
  for (const r of extra) byRole.set(r.role, r);
  return [...byRole.values()];
}

/** Missing operators per rule. "Flex" operators plug the biggest remaining hole. */
export function compGaps(ops: Operator[], rules: CompRule[]) {
  const counts = new Map<Role, number>();
  let flex = 0;
  for (const op of ops) {
    if (op.roles.includes("flex")) flex++;
    for (const r of op.roles) counts.set(r, (counts.get(r) ?? 0) + 1);
  }
  const gaps = rules
    .map((r) => ({ rule: r, missing: Math.max(0, r.min - (counts.get(r.role) ?? 0)) }))
    .sort((a, b) => b.rule.penalty - a.rule.penalty);
  for (const g of gaps) {
    while (flex > 0 && g.missing > 0) {
      g.missing--;
      flex--;
    }
  }
  return gaps;
}

export function optimize(input: OptimizeInput): Lineup[] {
  const { side, mapId, sites, slots, bans, locks, players, logs, settings } = input;
  const top = input.top ?? 3;
  const pool = (input.operators ?? OPERATORS).filter(
    (o) => o.side === side && !bans.includes(o.id),
  );
  const playerById = new Map(players.map((p) => [p.id, p]));

  const siteEntries = Object.entries(sites).filter(([, p]) => p > 0);
  const siteRules = siteEntries.map(([siteId, p]) => ({ p, rules: rulesFor(settings, side, mapId, siteId) }));
  if (siteRules.length === 0) siteRules.push({ p: 1, rules: rulesFor(settings, side, mapId) });

  // Expected base rate across possible sites.
  const baseLogit = siteEntries.length
    ? siteEntries.reduce((acc, [siteId, p]) => acc + p * logit(baseRate(logs, side, mapId, siteId).p), 0)
    : logit(baseRate(logs, side, mapId).p);

  // Per-slot candidate lists: best by personal edge, plus the best filler for every required role.
  const allRoles = new Set(siteRules.flatMap((s) => s.rules.map((r) => r.role)));
  const candidates = slots.map((playerId, i) => {
    const player = playerId ? playerById.get(playerId) : undefined;
    const locked = locks[i];
    const scored = pool
      .filter((o) => !player || player.comfort[o.id] !== 0 || o.id === locked)
      .map((o) => {
        const e = playerOpEdge(logs, player, side, o.id);
        const covers = o.roles.filter((r) => allRoles.has(r) || r === "flex").length;
        return { op: o, edge: e.edge, n: e.n, covers };
      })
      // Ties (common for randoms and unrated ops) go to operators that fill more required roles.
      .sort((a, b) => b.edge - a.edge || b.covers - a.covers);
    if (locked) {
      const hit = scored.find((c) => c.op.id === locked);
      return hit ? [hit] : [];
    }
    const picked = new Map(scored.slice(0, CANDIDATES_PER_SLOT).map((c) => [c.op.id, c]));
    for (const role of allRoles) {
      const best = scored.find((c) => c.op.roles.includes(role) || c.op.roles.includes("flex"));
      if (best) picked.set(best.op.id, best);
    }
    return [...picked.values()].sort((a, b) => b.edge - a.edge || b.covers - a.covers);
  });

  const best: Lineup[] = [];
  const worstKept = () => (best.length < top ? -Infinity : best[best.length - 1].score);
  // Upper bound on what the remaining slots can still add (penalties can only subtract).
  const maxRest = candidates.map((_, i) =>
    candidates.slice(i).reduce((acc, c) => acc + LINEUP_WEIGHT * (c[0]?.edge ?? 0), 0),
  );

  const chosen: (typeof candidates)[number] = [];
  const used = new Set<string>();

  const evaluate = () => {
    const ops = chosen.map((c) => c.op);
    let penalty = 0;
    const missing = new Map<Role, number>();
    for (const { p, rules } of siteRules) {
      for (const g of compGaps(ops, rules)) {
        penalty += p * g.missing * g.rule.penalty;
        if (g.missing) missing.set(g.rule.role, (missing.get(g.rule.role) ?? 0) + p * g.missing);
      }
    }
    const edgeSum = chosen.reduce((a, c) => a + c.edge, 0);
    const score = LINEUP_WEIGHT * edgeSum - penalty;
    if (score <= worstKept()) return;
    best.push({
      slots: chosen.map((c, i) => ({ playerId: slots[i], opId: c.op.id, edge: c.edge, n: c.n })),
      winP: sigmoid(baseLogit + score),
      gaps: [...missing.entries()]
        .filter(([, m]) => m >= 0.05)
        .map(([role, m]) => ({ role, missing: m })),
      score,
    });
    best.sort((a, b) => b.score - a.score);
    if (best.length > top) best.pop();
  };

  const dfs = (i: number, acc: number) => {
    if (i === slots.length) return evaluate();
    if (acc + maxRest[i] <= worstKept()) return;
    for (const c of candidates[i]) {
      if (used.has(c.op.id)) continue;
      used.add(c.op.id);
      chosen.push(c);
      dfs(i + 1, acc + LINEUP_WEIGHT * c.edge);
      chosen.pop();
      used.delete(c.op.id);
    }
  };
  dfs(0, 0);
  return best;
}
