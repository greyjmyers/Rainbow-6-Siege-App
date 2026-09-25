import { MAPS } from "../data/maps";
import { baseRate } from "../lib/model";
import { mapById, opName, pct, siteName, type ViewProps } from "./common";

export default function HistoryView({ state, setState }: ViewProps) {
  const { logs, players } = state;
  const playerName = (id: string | null) => (id ? players.find((p) => p.id === id)?.name ?? "?" : "Random");

  const raw = (side: "attack" | "defense", mapId?: string, siteId?: string) => {
    const xs = logs.filter(
      (l) => l.side === side && (!mapId || l.mapId === mapId) && (!siteId || l.siteId === siteId),
    );
    return { w: xs.filter((l) => l.won).length, n: xs.length };
  };

  const played = MAPS.filter((m) => logs.some((l) => l.mapId === m.id));

  return (
    <section>
      <h2>History</h2>
      {logs.length === 0 ? (
        <p className="hint">No rounds logged yet. Every "Won / Lost" tap during a match lands here.</p>
      ) : (
        <>
          <div className="card">
            <h3>Overall</h3>
            {(["attack", "defense"] as const).map((side) => {
              const r = raw(side);
              return (
                <div className="stat-row" key={side}>
                  <span>{side === "attack" ? "Attack" : "Defense"}</span>
                  <span>
                    {r.w}-{r.n - r.w} {r.n > 0 && <span className="muted">({pct(r.w / r.n)})</span>}
                  </span>
                </div>
              );
            })}
          </div>

          {played.map((m) => (
            <div className="card" key={m.id}>
              <h3>{m.name}</h3>
              <table className="tbl">
                <thead>
                  <tr>
                    <th>Site</th>
                    <th>Atk</th>
                    <th>Def</th>
                  </tr>
                </thead>
                <tbody>
                  {m.sites.map((s) => {
                    const a = raw("attack", m.id, s.id);
                    const d = raw("defense", m.id, s.id);
                    if (a.n + d.n === 0) return null;
                    return (
                      <tr key={s.id}>
                        <td>
                          <b>{s.floor}</b> {s.name}
                        </td>
                        <td title={`Estimated ${pct(baseRate(logs, "attack", m.id, s.id, state.settings.importWeight).p)}`}>
                          {a.n ? `${a.w}-${a.n - a.w}` : "—"}
                        </td>
                        <td title={`Estimated ${pct(baseRate(logs, "defense", m.id, s.id, state.settings.importWeight).p)}`}>
                          {d.n ? `${d.w}-${d.n - d.w}` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}

          <div className="card">
            <h3>Recent rounds</h3>
            {[...logs]
              .sort((a, b) => b.ts - a.ts)
              .slice(0, 40)
              .map((l) => (
                <div className="log-row" key={l.id}>
                  <span className={`dot ${l.won ? "w" : "l"}`} />
                  <div className="log-main">
                    <div>
                      {mapById(l.mapId)?.name} · R{l.round} · {l.side === "attack" ? "ATK" : "DEF"} ·{" "}
                      {siteName(l.mapId, l.siteId)}
                      {l.source === "import" && <span className="muted small"> · imported</span>}
                    </div>
                    <div className="muted small">
                      {l.picks.map((p) => `${playerName(p.playerId)}: ${opName(p.opId)}`).join(" · ")}
                    </div>
                  </div>
                  <button
                    className="x"
                    aria-label="Delete round"
                    onClick={() => setState((s) => ({ ...s, logs: s.logs.filter((x) => x.id !== l.id) }))}
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
    </section>
  );
}
