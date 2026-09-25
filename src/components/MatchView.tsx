import { useMemo, useState } from "react";
import { MAPS } from "../data/maps";
import { OPERATORS, ROLE_LABELS, type Side } from "../data/operators";
import { baseRate, predictSites } from "../lib/model";
import { optimize, type Lineup } from "../lib/optimizer";
import { uid } from "../lib/store";
import type { LiveMatch } from "../lib/types";
import { WinMeter, edgeLabel, mapById, opName, pct, siteName, type ViewProps } from "./common";

export default function MatchView({ state, setState, goSquad }: ViewProps & { goSquad: () => void }) {
  const m = state.match;
  if (!m) return <StartMatch state={state} setState={setState} goSquad={goSquad} />;
  return <LiveMatchView state={state} setState={setState} m={m} />;
}

function StartMatch({ state, setState, goSquad }: ViewProps & { goSquad: () => void }) {
  const [mapId, setMapId] = useState(MAPS[0].id);
  const [side, setSide] = useState<Side>("attack");

  const start = () => {
    const slots: (string | null)[] = state.players.slice(0, 5).map((p) => p.id);
    while (slots.length < 5) slots.push(null);
    setState((s) => ({ ...s, match: { id: uid(), mapId, side, round: 1, slots, bans: [], locks: {} } }));
  };

  return (
    <section>
      <h2>New match</h2>
      {state.players.length === 0 && (
        <div className="callout">
          Add your squad and rate their operators first — that's what the recommendations are built on.{" "}
          <button className="link" onClick={goSquad}>
            Go to Squad →
          </button>
        </div>
      )}
      <label className="label">Map</label>
      <div className="chips">
        {MAPS.map((mp) => (
          <button key={mp.id} className={`chip ${mp.id === mapId ? "on" : ""}`} onClick={() => setMapId(mp.id)}>
            {mp.name}
          </button>
        ))}
      </div>
      <label className="label">Starting side</label>
      <SideToggle side={side} onChange={setSide} />
      <button className="primary big" onClick={start}>
        Start match
      </button>
    </section>
  );
}

function SideToggle({ side, onChange }: { side: Side; onChange: (s: Side) => void }) {
  return (
    <div className="seg">
      {(["attack", "defense"] as const).map((s) => (
        <button key={s} className={side === s ? `on ${s}` : ""} onClick={() => onChange(s)}>
          {s === "attack" ? "Attack" : "Defense"}
        </button>
      ))}
    </div>
  );
}

function LiveMatchView({ state, setState, m }: ViewProps & { m: LiveMatch }) {
  const map = mapById(m.mapId)!;
  const { players, logs, settings } = state;
  const [pending, setPending] = useState<boolean | null>(null); // attack: won? waiting for site
  const [showBans, setShowBans] = useState(false);

  const update = (patch: Partial<LiveMatch>) =>
    setState((s) => (s.match ? { ...s, match: { ...s.match, ...patch } } : s));

  const matchLogs = logs.filter((l) => l.matchId === m.id).sort((a, b) => a.round - b.round);
  const score = {
    us: matchLogs.filter((l) => l.won).length,
    them: matchLogs.filter((l) => !l.won).length,
  };
  const prevLog = matchLogs.find((l) => l.round === m.round - 1);

  const siteIds = map.sites.map((s) => s.id);

  // Attack: where will they be? Defense: which site should we pick?
  const sitePrediction = useMemo(() => {
    if (m.side !== "attack") return null;
    const prev =
      prevLog && prevLog.side === "attack" && prevLog.siteId
        ? { siteId: prevLog.siteId, defendersWon: !prevLog.won }
        : undefined;
    return predictSites(logs, settings, m.mapId, siteIds, prev);
  }, [m.side, m.mapId, logs, settings, prevLog, siteIds.join()]);

  const common = {
    side: m.side,
    mapId: m.mapId,
    slots: m.slots,
    bans: m.bans,
    locks: m.locks,
    players,
    logs,
    settings,
  };

  const siteRanking = useMemo(() => {
    if (m.side !== "defense") return null;
    return map.sites
      .map((s) => {
        const best = optimize({ ...common, sites: { [s.id]: 1 }, top: 1 })[0];
        return { site: s, winP: best?.winP ?? 0, n: baseRate(logs, "defense", m.mapId, s.id).n };
      })
      .sort((a, b) => b.winP - a.winP);
  }, [m, players, logs, settings]);

  const defenseSite = m.side === "defense" ? m.siteId ?? siteRanking?.[0]?.site.id : undefined;

  const lineups: Lineup[] = useMemo(() => {
    const sites = m.side === "attack" ? sitePrediction! : { [defenseSite!]: 1 };
    return optimize({ ...common, sites });
  }, [m, players, logs, settings, sitePrediction, defenseSite]);

  const best = lineups[0];
  const baseN = baseRate(logs, m.side, m.mapId, defenseSite).n;

  const logRound = (won: boolean, siteId?: string) => {
    if (!best) return;
    const entry = {
      id: uid(),
      ts: Date.now(),
      matchId: m.id,
      mapId: m.mapId,
      side: m.side,
      round: m.round,
      siteId: m.side === "defense" ? defenseSite : siteId,
      picks: best.slots.map((s) => ({ playerId: s.playerId, opId: s.opId })),
      won,
    };
    const nextRound = m.round + 1;
    // Sides swap at halftime; overtime varies by playlist, so it's left to the side toggle.
    const swap = m.round === 3;
    setState((s) => ({
      ...s,
      logs: [...s.logs, entry],
      match: s.match && {
        ...s.match,
        round: nextRound,
        side: swap ? (m.side === "attack" ? "defense" : "attack") : m.side,
        siteId: swap ? undefined : s.match.siteId,
        locks: swap ? {} : s.match.locks,
      },
    }));
    setPending(null);
  };

  const undo = () => {
    const last = matchLogs[matchLogs.length - 1];
    if (!last) return;
    setState((s) => ({
      ...s,
      logs: s.logs.filter((l) => l.id !== last.id),
      match: s.match && { ...s.match, round: last.round, side: last.side },
    }));
  };

  const endMatch = () => {
    if (confirm("End this match? Logged rounds are kept.")) setState((s) => ({ ...s, match: null }));
  };

  const sideOps = OPERATORS.filter((o) => o.side === m.side);
  const usedPlayers = new Set(m.slots.filter(Boolean));

  return (
    <section>
      <div className="match-head">
        <div>
          <div className="map-name">{map.name}</div>
          <div className="muted">
            Round {m.round} · {score.us}–{score.them}
          </div>
        </div>
        <SideToggle side={m.side} onChange={(side) => update({ side, locks: {}, siteId: undefined })} />
      </div>

      {m.side === "attack" && sitePrediction && (
        <div className="card">
          <h3>Where they'll likely be</h3>
          {map.sites
            .map((s) => ({ s, p: sitePrediction[s.id] }))
            .sort((a, b) => b.p - a.p)
            .map(({ s, p }) => (
              <div className="bar-row" key={s.id}>
                <span className="bar-label">
                  <b>{s.floor}</b> {s.name}
                </span>
                <span className="bar">
                  <span style={{ width: pct(p) }} />
                </span>
                <span className="bar-val">{pct(p)}</span>
              </div>
            ))}
          <p className="hint">
            {prevLog?.siteId && prevLog.side === "attack"
              ? `Last round was ${siteName(m.mapId, prevLog.siteId)} and they ${prevLog.won ? "lost" : "won"} it.`
              : "Log the site after each attack round and this gets sharper."}
          </p>
        </div>
      )}

      {m.side === "defense" && siteRanking && (
        <div className="card">
          <h3>Pick a site</h3>
          {siteRanking.map(({ site, winP, n }) => (
            <button
              key={site.id}
              className={`site-row ${site.id === defenseSite ? "on" : ""}`}
              onClick={() => update({ siteId: site.id })}
            >
              <span>
                <b>{site.floor}</b> {site.name}
                <span className="muted small"> · {n} logged</span>
              </span>
              <span className="site-p">{pct(winP)}</span>
            </button>
          ))}
        </div>
      )}

      <div className="card rec">
        <h3>Recommended lineup</h3>
        {best ? (
          <>
            <WinMeter p={best.winP} n={baseN} />
            <div className="lineup">
              {m.slots.map((pid, i) => {
                const slot = best.slots[i];
                const locked = m.locks[i];
                return (
                  <div className="slot" key={i}>
                    <select
                      className="who"
                      value={pid ?? ""}
                      onChange={(e) => {
                        const slots = [...m.slots];
                        slots[i] = e.target.value || null;
                        update({ slots });
                      }}
                    >
                      <option value="">Random</option>
                      {players
                        .filter((p) => p.id === pid || !usedPlayers.has(p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>
                    <select
                      className={`op ${locked ? "locked" : ""}`}
                      value={locked ?? ""}
                      onChange={(e) => {
                        const locks = { ...m.locks };
                        if (e.target.value) locks[i] = e.target.value;
                        else delete locks[i];
                        update({ locks });
                      }}
                    >
                      <option value="">{slot ? `${opName(slot.opId)}` : "—"}</option>
                      {sideOps
                        .filter((o) => !m.bans.includes(o.id))
                        .map((o) => (
                          <option key={o.id} value={o.id}>
                            🔒 {o.name}
                          </option>
                        ))}
                    </select>
                    {slot && (
                      <span className={`edge ${slot.edge > 0.05 ? "pos" : slot.edge < -0.05 ? "neg" : ""}`}>
                        {edgeLabel(slot.edge)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {best.gaps.length > 0 && (
              <div className="warn">
                Missing:{" "}
                {best.gaps
                  .map((g) => `${ROLE_LABELS[g.role]}${g.missing < 0.95 ? ` (${pct(g.missing)} of sites)` : ""}`)
                  .join(", ")}
              </div>
            )}
            {lineups.length > 1 && (
              <details className="alts">
                <summary>Alternatives</summary>
                {lineups.slice(1).map((l, k) => (
                  <div className="alt" key={k}>
                    <span>{l.slots.map((s) => opName(s.opId)).join(" · ")}</span>
                    <span className="muted">{pct(l.winP)}</span>
                  </div>
                ))}
              </details>
            )}
          </>
        ) : (
          <p className="warn">No valid lineup — too many bans or refusals. Unlock a slot or remove a ban.</p>
        )}
      </div>

      <details className="card" open={showBans} onToggle={(e) => setShowBans((e.target as HTMLDetailsElement).open)}>
        <summary>
          Bans {m.bans.length > 0 && <span className="muted">({m.bans.map(opName).join(", ")})</span>}
        </summary>
        {(["attack", "defense"] as const).map((side) => (
          <div key={side}>
            <div className="label">{side === "attack" ? "Attackers" : "Defenders"}</div>
            <div className="chips small">
              {OPERATORS.filter((o) => o.side === side).map((o) => (
                <button
                  key={o.id}
                  className={`chip ${m.bans.includes(o.id) ? "ban" : ""}`}
                  onClick={() =>
                    update({
                      bans: m.bans.includes(o.id) ? m.bans.filter((b) => b !== o.id) : [...m.bans, o.id],
                    })
                  }
                >
                  {o.name}
                </button>
              ))}
            </div>
          </div>
        ))}
      </details>

      {pending === null ? (
        <div className="result-row">
          <button className="win" disabled={!best} onClick={() => (m.side === "attack" ? setPending(true) : logRound(true))}>
            Won round
          </button>
          <button className="loss" disabled={!best} onClick={() => (m.side === "attack" ? setPending(false) : logRound(false))}>
            Lost round
          </button>
        </div>
      ) : (
        <div className="card">
          <h3>{pending ? "Won" : "Lost"} — which site were they on?</h3>
          <div className="chips">
            {map.sites.map((s) => (
              <button key={s.id} className="chip" onClick={() => logRound(pending, s.id)}>
                <b>{s.floor}</b> {s.name}
              </button>
            ))}
            <button className="chip ghost" onClick={() => logRound(pending)}>
              Didn't find out
            </button>
            <button className="chip ghost" onClick={() => setPending(null)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="footer-actions">
        <button className="ghost" disabled={matchLogs.length === 0} onClick={undo}>
          Undo last round
        </button>
        <button className="ghost" onClick={endMatch}>
          End match
        </button>
      </div>
    </section>
  );
}
