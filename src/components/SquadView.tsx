import { useState } from "react";
import { OPERATORS, type Side } from "../data/operators";
import { uid } from "../lib/store";
import type { Comfort, Player } from "../lib/types";
import type { ViewProps } from "./common";

// Tap cycle: unrated → 1 → … → 5 → won't play → unrated
const CYCLE: (Comfort | undefined)[] = [undefined, 1, 2, 3, 4, 5, 0];

export default function SquadView({ state, setState }: ViewProps) {
  const [name, setName] = useState("");
  const [openId, setOpenId] = useState<string | null>(state.players[0]?.id ?? null);

  const add = () => {
    const n = name.trim();
    if (!n) return;
    const p: Player = { id: uid(), name: n, comfort: {} };
    setState((s) => ({ ...s, players: [...s.players, p] }));
    setName("");
    setOpenId(p.id);
  };

  const patch = (id: string, fn: (p: Player) => Player) =>
    setState((s) => ({ ...s, players: s.players.map((p) => (p.id === id ? fn(p) : p)) }));

  const remove = (id: string) => {
    if (!confirm("Remove this player? Their logged rounds stay in history.")) return;
    setState((s) => ({ ...s, players: s.players.filter((p) => p.id !== id) }));
  };

  return (
    <section>
      <h2>Squad</h2>
      <p className="hint">
        Rate each operator honestly: 5 = your best, 1 = you can play it, ✕ = never put me on this. Logged
        rounds gradually override these ratings.
      </p>
      <form
        className="add-row"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Player name" maxLength={24} />
        <button className="primary" type="submit">
          Add
        </button>
      </form>

      {state.players.map((p) => {
        const record = playerRecord(state.logs, p.id);
        return (
          <div className="card" key={p.id}>
            <button className="player-head" onClick={() => setOpenId(openId === p.id ? null : p.id)}>
              <span className="player-name">{p.name}</span>
              <span className="muted small">
                {Object.values(p.comfort).filter((c) => c > 0).length} ops rated · {record.w}-{record.n - record.w}
              </span>
            </button>
            {openId === p.id && (
              <>
                <label className="label">Ubisoft name (for a future stats import)</label>
                <input
                  value={p.ubisoftName ?? ""}
                  onChange={(e) => patch(p.id, (x) => ({ ...x, ubisoftName: e.target.value }))}
                  placeholder="optional"
                />
                {(["attack", "defense"] as Side[]).map((side) => (
                  <div key={side}>
                    <div className="label">{side === "attack" ? "Attackers" : "Defenders"}</div>
                    <div className="op-grid">
                      {OPERATORS.filter((o) => o.side === side).map((o) => {
                        const c = p.comfort[o.id];
                        const next = CYCLE[(CYCLE.indexOf(c) + 1) % CYCLE.length];
                        return (
                          <button
                            key={o.id}
                            className={`op-cell c${c ?? "u"}`}
                            onClick={() =>
                              patch(p.id, (x) => {
                                const comfort = { ...x.comfort };
                                if (next === undefined) delete comfort[o.id];
                                else comfort[o.id] = next;
                                return { ...x, comfort };
                              })
                            }
                          >
                            <span>{o.name}</span>
                            <b>{c === undefined ? "·" : c === 0 ? "✕" : c}</b>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <button className="ghost danger" onClick={() => remove(p.id)}>
                  Remove {p.name}
                </button>
              </>
            )}
          </div>
        );
      })}
    </section>
  );
}

function playerRecord(logs: ViewProps["state"]["logs"], id: string) {
  let w = 0,
    n = 0;
  for (const l of logs) {
    if (!l.picks.some((p) => p.playerId === id)) continue;
    n++;
    if (l.won) w++;
  }
  return { w, n };
}
