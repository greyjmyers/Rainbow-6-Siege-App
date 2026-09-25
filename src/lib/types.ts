import type { Role, Side } from "../data/operators";

/** 0 = refuses to play it, 1–5 = comfort. Missing = unrated. */
export type Comfort = 0 | 1 | 2 | 3 | 4 | 5;

export interface Player {
  id: string;
  name: string;
  /** Ubisoft name, kept for a future stats import. */
  ubisoftName?: string;
  comfort: Record<string, Comfort>;
}

/** A lineup slot: a known squad member, or null for a random teammate. */
export interface Pick {
  playerId: string | null;
  opId: string;
}

export type SameOps = "same" | "changed";

export interface RoundLog {
  id: string;
  ts: number;
  matchId: string;
  mapId: string;
  side: Side;
  round: number;
  /** Site played. On attack this is where the defenders set up (fill in after the round). */
  siteId?: string;
  picks: Pick[];
  won: boolean;
  /** Attack: did the defenders' operators look the same as the previous round? */
  sameOps?: SameOps;
  /** Missing = logged by hand in the app. Imported rounds count for less (see Settings.importWeight). */
  source?: "manual" | "import";
}

export interface CompRule {
  role: Role;
  min: number;
  /** Logit penalty per missing operator (0.35 ≈ −8–9% win chance near 50%). */
  penalty: number;
}

export interface Settings {
  rules: Record<Side, CompRule[]>;
  /** "mapId:siteId" → extra minimums for that site, e.g. two hard breachers. */
  siteRules: Record<string, CompRule[]>;
  /** Prior belief that defenders stay on the same site after winning / losing a round. */
  repeatAfterDefWin: number;
  repeatAfterDefLoss: number;
  /** "mapId:siteId" → how often that site gets picked (SITE_META weights). Missing = normal. */
  siteMeta: Record<string, number>;
  /** Odds multiplier on a repeat when the defenders show the same operators as last round. */
  sameOpsOdds: number;
  /** How much one imported round counts relative to a hand-logged one (0–1). */
  importWeight: number;
}

export interface LiveMatch {
  id: string;
  mapId: string;
  side: Side;
  round: number;
  /** Up to five slots; null = random / not in the squad list. */
  slots: (string | null)[];
  bans: string[];
  /** slot index → locked operator id */
  locks: Record<number, string>;
  /** Attack: what the defenders' operators look like vs. last round (from drones / kill feed). */
  sameOps?: SameOps;
  /** Defense: the site we chose. Attack: unknown until the round ends. */
  siteId?: string;
}

export interface AppState {
  version: 1;
  players: Player[];
  logs: RoundLog[];
  settings: Settings;
  match: LiveMatch | null;
}
