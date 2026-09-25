import { describe, expect, it } from "vitest";
import { baseRate, playerOpEdge, predictSites, siteLossStreak } from "./model";
import { optimize } from "./optimizer";
import { DEFAULT_SETTINGS, findPlayerByName } from "./store";
import type { Player, RoundLog } from "./types";

const player = (id: string, comfort: Player["comfort"]): Player => ({ id, name: id, comfort });

const round = (over: Partial<RoundLog>): RoundLog => ({
  id: Math.random().toString(),
  ts: 0,
  matchId: "m1",
  mapId: "bank",
  side: "attack",
  round: 1,
  picks: [],
  won: true,
  ...over,
});

describe("baseRate", () => {
  it("is 50% with no data and shrinks small samples toward the parent", () => {
    expect(baseRate([], "attack", "bank").p).toBeCloseTo(0.5);
    const one = baseRate([round({ won: true })], "attack", "bank");
    expect(one.p).toBeGreaterThan(0.5);
    expect(one.p).toBeLessThan(0.6);
  });
});

describe("imported rounds", () => {
  it("count for importWeight of a logged round", () => {
    const logged = [round({ won: true }), round({ won: true })];
    const imported = Array.from({ length: 5 }, () => round({ won: true, source: "import" }));
    // 5 × 0.4 = 2 rounds of evidence, same as two logged wins.
    expect(baseRate(imported, "attack", "bank", undefined, 0.4).p).toBeCloseTo(
      baseRate(logged, "attack", "bank", undefined, 0.4).p,
    );
    expect(baseRate(imported, "attack", "bank", undefined, 0.4).n).toBe(5);
  });

  it("are ignored at weight 0", () => {
    const imported = Array.from({ length: 10 }, () => round({ won: true, source: "import" }));
    expect(baseRate(imported, "attack", "bank", undefined, 0).p).toBeCloseTo(0.5);
  });
});

describe("playerOpEdge", () => {
  it("prefers higher-comfort operators with no logs", () => {
    const p = player("a", { thermite: 5, hibana: 1 });
    expect(playerOpEdge([], p, "attack", "thermite").edge).toBeGreaterThan(
      playerOpEdge([], p, "attack", "hibana").edge,
    );
  });

  it("lets logged results override comfort", () => {
    const p = player("a", { thermite: 5, hibana: 3 });
    const logs = [
      ...Array.from({ length: 20 }, () => round({ picks: [{ playerId: "a", opId: "thermite" }], won: false })),
      ...Array.from({ length: 20 }, () => round({ picks: [{ playerId: "a", opId: "hibana" }], won: true })),
    ];
    expect(playerOpEdge(logs, p, "attack", "hibana").edge).toBeGreaterThan(
      playerOpEdge(logs, p, "attack", "thermite").edge,
    );
  });
});

describe("predictSites", () => {
  const sites = ["a", "b", "c", "d"];
  it("is uniform with no history or site settings", () => {
    const p = predictSites([], { ...DEFAULT_SETTINGS, siteMeta: {} }, "bank", sites);
    for (const id of sites) expect(p[id]).toBeCloseTo(0.25);
  });
  it("starts from site popularity settings", () => {
    const settings = { ...DEFAULT_SETTINGS, siteMeta: { "bank:d": 0, "bank:a": 2 } };
    const p = predictSites([], settings, "bank", sites);
    expect(p.d).toBe(0);
    expect(p.a).toBeCloseTo(0.5);
    expect(p.b).toBeCloseTo(0.25);
  });

  it("same defender ops push toward a repeat, changed ops away from it", () => {
    const base = predictSites([], DEFAULT_SETTINGS, "bank", sites, { siteId: "b", defendersWon: false });
    const same = predictSites([], DEFAULT_SETTINGS, "bank", sites, { siteId: "b", defendersWon: false, sameOps: "same" });
    const changed = predictSites([], DEFAULT_SETTINGS, "bank", sites, {
      siteId: "b",
      defendersWon: false,
      sameOps: "changed",
    });
    expect(same.b).toBeGreaterThan(base.b);
    expect(changed.b).toBeLessThan(base.b);
  });

  it("leans toward a repeat after the defenders win", () => {
    const p = predictSites([], DEFAULT_SETTINGS, "bank", sites, { siteId: "b", defendersWon: true });
    expect(p.b).toBeCloseTo(DEFAULT_SETTINGS.repeatAfterDefWin);
    expect(Object.values(p).reduce((x, y) => x + y, 0)).toBeCloseTo(1);
  });
});

describe("optimize", () => {
  const players = [
    player("a", { ash: 5, thermite: 2 }),
    player("b", { ash: 5, hibana: 4 }),
    player("c", { twitch: 5 }),
    player("d", { iq: 4 }),
    player("e", { sledge: 4 }),
  ];
  const base = {
    side: "attack" as const,
    mapId: "bank",
    sites: { "lockers-cctv-room": 1 },
    slots: players.map((p) => p.id),
    bans: [],
    locks: {},
    players,
    logs: [],
    settings: DEFAULT_SETTINGS,
  };

  it("never assigns the same operator twice and includes a hard breacher", () => {
    const [best] = optimize(base);
    const ops = best.slots.map((s) => s.opId);
    expect(new Set(ops).size).toBe(5);
    expect(ops.some((o) => ["thermite", "hibana", "maverick", "ace"].includes(o))).toBe(true);
    expect(best.gaps.find((g) => g.role === "hard-breach")).toBeUndefined();
  });

  it("respects bans, locks and refusals", () => {
    const refusing = players.map((p) => (p.id === "c" ? player("c", { twitch: 0, thatcher: 5 }) : p));
    const [best] = optimize({ ...base, players: refusing, bans: ["hibana"], locks: { 0: "ash" } });
    expect(best.slots[0].opId).toBe("ash");
    expect(best.slots.map((s) => s.opId)).not.toContain("hibana");
    expect(best.slots[2].opId).not.toBe("twitch");
  });

  it("handles random teammates and a partial squad", () => {
    const res = optimize({ ...base, slots: ["a", "b", null, null, null] });
    expect(res[0].slots).toHaveLength(5);
    expect(res[0].winP).toBeGreaterThan(0);
    expect(res[0].winP).toBeLessThan(1);
  });

  it("gives random teammates operators that close composition gaps", () => {
    const def = [player("a", { mute: 5 }), player("b", { jager: 5 }), player("c", { valkyrie: 4 })];
    const [best] = optimize({
      ...base,
      side: "defense",
      players: def,
      slots: ["a", "b", "c", null, null],
    });
    expect(best.gaps).toEqual([]);
  });

  it("applies site-specific requirements", () => {
    const settings = {
      ...DEFAULT_SETTINGS,
      siteRules: { "bank:lockers-cctv-room": [{ role: "hard-breach" as const, min: 2, penalty: 0.45 }] },
    };
    const [best] = optimize({ ...base, settings });
    const hard = best.slots.filter((s) => ["thermite", "hibana", "maverick", "ace"].includes(s.opId));
    expect(hard.length).toBe(2);
  });
});

describe("run-it-back after losses (Nighthaven Labs, 25 Sep)", () => {
  // We attacked rounds 1–3 and won all three: top floor, top floor again, then they rotated to basement.
  const nh = (n: number, siteId: string) =>
    round({ mapId: "nighthaven-labs", matchId: "nh", round: n, siteId, won: true });
  const sites = ["top", "g1", "g2", "base"];

  it("counts consecutive losses on the same site", () => {
    const rounds = [nh(1, "top"), nh(2, "top"), nh(3, "base")];
    expect(siteLossStreak(rounds, 0)).toBe(1);
    expect(siteLossStreak(rounds, 1)).toBe(2);
    expect(siteLossStreak(rounds, 2)).toBe(1);
  });

  it("expects a run-back after one loss and a rotation after two", () => {
    const once = predictSites([], DEFAULT_SETTINGS, "nighthaven-labs", sites, {
      siteId: "top",
      defendersWon: false,
      lossStreak: 1,
    });
    const twice = predictSites([], DEFAULT_SETTINGS, "nighthaven-labs", sites, {
      siteId: "top",
      defendersWon: false,
      lossStreak: 2,
    });
    expect(once.top).toBeGreaterThan(0.5);
    expect(twice.top).toBeLessThan(0.25);
  });

  it("learns the pattern from logged matches", () => {
    const history = [nh(1, "top"), nh(2, "top"), nh(3, "base")];
    const learned = predictSites(history, DEFAULT_SETTINGS, "nighthaven-labs", sites, {
      siteId: "g1",
      defendersWon: false,
      lossStreak: 1,
    });
    const prior = predictSites([], DEFAULT_SETTINGS, "nighthaven-labs", sites, {
      siteId: "g1",
      defendersWon: false,
      lossStreak: 1,
    });
    expect(learned.g1).toBeGreaterThan(prior.g1);
  });
});

describe("findPlayerByName", () => {
  it("matches a scoreboard name to a gamertag or Ubisoft name, ignoring case", () => {
    const me: Player = { id: "me", name: "Grey", gamertag: "GOON X Tsunamii", ubisoftName: "keister-sunday", comfort: {} };
    expect(findPlayerByName([me], "GOON x Tsunamii")?.id).toBe("me");
    expect(findPlayerByName([me], "Keister-Sunday")?.id).toBe("me");
    expect(findPlayerByName([me], "junksweat")).toBeUndefined();
  });
});
