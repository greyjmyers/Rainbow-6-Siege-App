import { useState } from "react";
import { MAPS } from "../data/maps";
import { ROLE_LABELS, type Role, type Side } from "../data/operators";
import { DEFAULT_SETTINGS, emptyState, parseState } from "../lib/store";
import type { CompRule, Settings } from "../lib/types";
import type { ViewProps } from "./common";

export default function SetupView({ state, setState }: ViewProps) {
  const s = state.settings;
  const [mapId, setMapId] = useState(MAPS[0].id);
  const map = MAPS.find((m) => m.id === mapId)!;

  const setSettings = (fn: (x: Settings) => Settings) =>
    setState((st) => ({ ...st, settings: fn(st.settings) }));

  const setRule = (side: Side, role: Role, patch: Partial<CompRule>) =>
    setSettings((x) => ({
      ...x,
      rules: { ...x.rules, [side]: x.rules[side].map((r) => (r.role === role ? { ...r, ...patch } : r)) },
    }));

  const siteMin = (siteId: string, role: Role) =>
    s.siteRules[`${mapId}:${siteId}`]?.find((r) => r.role === role)?.min;

  const setSiteMin = (siteId: string, side: Side, role: Role, min: number | undefined) =>
    setSettings((x) => {
      const key = `${mapId}:${siteId}`;
      const base = x.rules[side].find((r) => r.role === role)!;
      const others = (x.siteRules[key] ?? []).filter((r) => r.role !== role);
      const next = min === undefined ? others : [...others, { ...base, min }];
      return { ...x, siteRules: { ...x.siteRules, [key]: next } };
    });

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `prepphase-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const importData = async (file: File) => {
    try {
      const next = parseState(await file.text());
      if (confirm(`Replace current data with ${next.players.length} players and ${next.logs.length} rounds?`)) {
        setState(next);
      }
    } catch (e) {
      alert(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <section>
      <h2>Setup</h2>

      <div className="card">
        <h3>Team composition rules</h3>
        <p className="hint">
          Minimum of each role, and how hard to punish a lineup that's missing it. The penalty is in log-odds:
          0.45 costs roughly 11% win chance near a coin flip.
        </p>
        {(["attack", "defense"] as Side[]).map((side) => (
          <div key={side}>
            <div className="label">{side === "attack" ? "Attack" : "Defense"}</div>
            {s.rules[side].map((r) => (
              <div className="rule-row" key={r.role}>
                <span>{ROLE_LABELS[r.role]}</span>
                <label>
                  min
                  <input
                    type="number"
                    min={0}
                    max={5}
                    value={r.min}
                    onChange={(e) => setRule(side, r.role, { min: clampInt(e.target.value, 0, 5) })}
                  />
                </label>
                <label>
                  penalty
                  <input
                    type="number"
                    step={0.05}
                    min={0}
                    max={2}
                    value={r.penalty}
                    onChange={(e) => setRule(side, r.role, { penalty: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </label>
              </div>
            ))}
          </div>
        ))}
      </div>

      <div className="card">
        <h3>Site-specific needs</h3>
        <p className="hint">Override a minimum for one site — e.g. a site that needs two hard breachers.</p>
        <select value={mapId} onChange={(e) => setMapId(e.target.value)}>
          {MAPS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <table className="tbl">
          <thead>
            <tr>
              <th>Site</th>
              <th>Hard breach</th>
              <th>Anti-breach</th>
            </tr>
          </thead>
          <tbody>
            {map.sites.map((site) => (
              <tr key={site.id}>
                <td>
                  <b>{site.floor}</b> {site.name}
                </td>
                {(
                  [
                    ["attack", "hard-breach"],
                    ["defense", "anti-breach"],
                  ] as [Side, Role][]
                ).map(([side, role]) => (
                  <td key={role}>
                    <select
                      value={siteMin(site.id, role) ?? ""}
                      onChange={(e) =>
                        setSiteMin(site.id, side, role, e.target.value === "" ? undefined : Number(e.target.value))
                      }
                    >
                      <option value="">default</option>
                      {[0, 1, 2, 3].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h3>Site rotation assumptions</h3>
        <p className="hint">
          Starting belief for how often defenders stay on the same site. Your logged attack rounds take over as they
          pile up.
        </p>
        <div className="rule-row">
          <span>Stay after they win</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={s.repeatAfterDefWin}
            onChange={(e) => setSettings((x) => ({ ...x, repeatAfterDefWin: clamp01(e.target.value) }))}
          />
        </div>
        <div className="rule-row">
          <span>Stay after they lose</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={s.repeatAfterDefLoss}
            onChange={(e) => setSettings((x) => ({ ...x, repeatAfterDefLoss: clamp01(e.target.value) }))}
          />
        </div>
      </div>

      <div className="card">
        <h3>Imported history</h3>
        <p className="hint">
          Rounds pulled from match history are weaker evidence than rounds you log live with the exact lineup. At 0.4,
          five imported rounds count about as much as two logged ones.
        </p>
        <div className="rule-row">
          <span>Weight of one imported round</span>
          <input
            type="number"
            step={0.1}
            min={0}
            max={1}
            value={s.importWeight}
            onChange={(e) =>
              setSettings((x) => ({ ...x, importWeight: Math.min(1, Math.max(0, Number(e.target.value) || 0)) }))
            }
          />
        </div>
      </div>

      <div className="card">
        <h3>Data</h3>
        <p className="hint">Everything lives on this device. Export to back up or hand the file to a squadmate.</p>
        <div className="btn-row">
          <button className="primary" onClick={exportData}>
            Export JSON
          </button>
          <label className="button ghost">
            Import JSON
            <input
              type="file"
              accept="application/json"
              hidden
              onChange={(e) => e.target.files?.[0] && importData(e.target.files[0])}
            />
          </label>
        </div>
        <div className="btn-row">
          <button
            className="ghost"
            onClick={() => confirm("Reset rules to defaults?") && setSettings(() => structuredClone(DEFAULT_SETTINGS))}
          >
            Reset rules
          </button>
          <button
            className="ghost danger"
            onClick={() => confirm("Delete ALL players, rounds and settings?") && setState(emptyState())}
          >
            Wipe everything
          </button>
        </div>
      </div>
    </section>
  );
}

const clampInt = (v: string, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(Number(v) || 0)));
const clamp01 = (v: string) => Math.min(0.99, Math.max(0.01, Number(v) || 0));
