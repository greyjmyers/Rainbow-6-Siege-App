import { useState } from "react";
import type { GameMap } from "../data/maps";
import { ROLE_LABELS, type Role, type Side } from "../data/operators";
import { SITE_META } from "../lib/model";
import { DEFAULT_SETTINGS, emptyState, parseState } from "../lib/store";
import type { CompRule, Settings } from "../lib/types";
import { mapsOf, type ViewProps } from "./common";
import { uid } from "../lib/store";

export default function SetupView({ state, setState }: ViewProps) {
  const s = state.settings;
  const maps = mapsOf(state);
  const [mapId, setMapId] = useState(maps[0].id);
  const map = maps.find((m) => m.id === mapId) ?? maps[0];

  // Saving a map stores the whole map as an override keyed by id (site ids are kept, so history stays attached).
  const saveMap = (next: GameMap) =>
    setState((st) => ({ ...st, maps: [...(st.maps ?? []).filter((m) => m.id !== next.id), next] }));

  const addMap = () => {
    const name = prompt("Map name")?.trim();
    if (!name) return;
    const id = `custom-${uid()}`;
    saveMap({
      id,
      name,
      sites: [
        { id: "s1", floor: "2F", name: "Site 1" },
        { id: "s2", floor: "1F", name: "Site 2" },
        { id: "s3", floor: "1F", name: "Site 3" },
        { id: "s4", floor: "B", name: "Site 4" },
      ],
    });
    setMapId(id);
  };

  const setSettings = (fn: (x: Settings) => Settings) =>
    setState((st) => ({ ...st, settings: fn(st.settings) }));

  const setRule = (side: Side, role: Role, patch: Partial<CompRule>) =>
    setSettings((x) => ({
      ...x,
      rules: { ...x.rules, [side]: x.rules[side].map((r) => (r.role === role ? { ...r, ...patch } : r)) },
    }));

  const siteMin = (siteId: string, role: Role) =>
    s.siteRules[`${map.id}:${siteId}`]?.find((r) => r.role === role)?.min;

  const setSiteMin = (siteId: string, side: Side, role: Role, min: number | undefined) =>
    setSettings((x) => {
      const key = `${map.id}:${siteId}`;
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
        <h3>Sites</h3>
        <p className="hint">
          How often each site gets picked (your starting belief for attack predictions — logged rounds refine it), and
          any site that needs more than the default, e.g. two hard breachers.
        </p>
        <div className="add-row">
          <select value={map.id} onChange={(e) => setMapId(e.target.value)}>
            {maps.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <button className="ghost" onClick={addMap}>
            + Map
          </button>
        </div>
        <div className="site-edit">
          {map.sites.map((site, i) => (
            <div className="site-edit-row" key={site.id}>
              <input
                className="floor"
                value={site.floor}
                maxLength={3}
                aria-label="Floor"
                onChange={(e) =>
                  saveMap({ ...map, sites: map.sites.map((x, j) => (j === i ? { ...x, floor: e.target.value } : x)) })
                }
              />
              <input
                value={site.name}
                aria-label="Site name"
                onChange={(e) =>
                  saveMap({ ...map, sites: map.sites.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })
                }
              />
            </div>
          ))}
        </div>
        <table className="tbl">
          <thead>
            <tr>
              <th>Site</th>
              <th>Picked</th>
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
                <td>
                  <select
                    value={s.siteMeta[`${map.id}:${site.id}`] ?? 1}
                    onChange={(e) =>
                      setSettings((x) => ({
                        ...x,
                        siteMeta: { ...x.siteMeta, [`${map.id}:${site.id}`]: Number(e.target.value) },
                      }))
                    }
                  >
                    {SITE_META.map((o) => (
                      <option key={o.label} value={o.weight}>
                        {o.label}
                      </option>
                    ))}
                  </select>
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
          <span>Stay after they lose it once</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={s.repeatAfterDefLoss}
            onChange={(e) => setSettings((x) => ({ ...x, repeatAfterDefLoss: clamp01(e.target.value) }))}
          />
        </div>
        <div className="rule-row">
          <span>Stay after losing it twice in a row</span>
          <input
            type="number"
            step={0.05}
            min={0}
            max={1}
            value={s.repeatAfterDefLoss2}
            onChange={(e) => setSettings((x) => ({ ...x, repeatAfterDefLoss2: clamp01(e.target.value) }))}
          />
        </div>
        <div className="rule-row">
          <span>Same ops as last round → repeat odds ×</span>
          <input
            type="number"
            step={0.5}
            min={1}
            max={20}
            value={s.sameOpsOdds}
            onChange={(e) =>
              setSettings((x) => ({ ...x, sameOpsOdds: Math.min(20, Math.max(1, Number(e.target.value) || 1)) }))
            }
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
