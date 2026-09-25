import { describe, expect, it } from "vitest";
import { baseRate, playerOpEdge, predictSites } from "./model";
import { optimize } from "./optimizer";
import { DEFAULT_SETTINGS } from "./store";
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
  it("is uniform with no history", () => {
    const p = predictSites([], DEFAULT_SETTINGS, "bank", sites);
    for (const id of sites) expect(p[id]).toBeCloseTo(0.25);
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
