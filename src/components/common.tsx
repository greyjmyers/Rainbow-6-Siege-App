import type { Dispatch, SetStateAction } from "react";
import { resolveMaps, type GameMap } from "../data/maps";
import { OPERATORS } from "../data/operators";
import type { AppState } from "../lib/types";

export interface ViewProps {
  state: AppState;
  setState: Dispatch<SetStateAction<AppState>>;
}

export const opName = (id: string) => OPERATORS.find((o) => o.id === id)?.name ?? id;
export const mapsOf = (state: AppState) => resolveMaps(state.maps);
export const mapById = (maps: GameMap[], id: string) => maps.find((m) => m.id === id);
export const siteName = (maps: GameMap[], mapId: string, siteId?: string) =>
  mapById(maps, mapId)?.sites.find((s) => s.id === siteId)?.name ?? "—";

export const pct = (p: number) => `${Math.round(p * 100)}%`;

/** Rough edge (logit) → "+4%" near a coin flip, for human-readable explanations. */
export const edgeLabel = (edge: number) => {
  const d = Math.round((1 / (1 + Math.exp(-edge)) - 0.5) * 100);
  return d === 0 ? "±0" : d > 0 ? `+${d}` : `${d}`;
};

export function WinMeter({ p, n }: { p: number; n?: number }) {
  const tone = p >= 0.55 ? "good" : p <= 0.45 ? "bad" : "even";
  return (
    <div className={`meter ${tone}`}>
      <div className="meter-num">{pct(p)}</div>
      <div className="meter-bar">
        <span style={{ width: pct(p) }} />
      </div>
      {n !== undefined && (
        <div className="meter-sub">
          {n === 0 ? "No rounds logged here yet — estimate is ratings only" : `Based on ${n} logged round${n === 1 ? "" : "s"} here`}
        </div>
      )}
    </div>
  );
}
