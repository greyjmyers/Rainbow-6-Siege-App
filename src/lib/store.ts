import { useEffect, useState } from "react";
import type { AppState, Settings } from "./types";

const KEY = "prepphase:v1";

// Sites that are rarely picked in ranked. Everything else defaults to "normal"; edit in Setup.
const RARE = 0.3;
const DEFAULT_SITE_META: Record<string, number> = {
  "bank:open-area-staff-room": RARE,
  "border:bathroom-tellers": RARE,
  "clubhouse:bar-stage": RARE,
  "kafe:kitchen-service-kitchen-cooking": RARE,
};

export const DEFAULT_SETTINGS: Settings = {
  rules: {
    attack: [
      { role: "hard-breach", min: 1, penalty: 0.45 },
      { role: "anti-gadget", min: 1, penalty: 0.25 },
      { role: "intel", min: 1, penalty: 0.15 },
      { role: "entry", min: 1, penalty: 0.1 },
    ],
    defense: [
      { role: "anti-breach", min: 1, penalty: 0.45 },
      { role: "intel", min: 1, penalty: 0.15 },
      { role: "roam", min: 1, penalty: 0.1 },
      { role: "trap", min: 1, penalty: 0.1 },
      { role: "anchor", min: 1, penalty: 0.1 },
    ],
  },
  siteRules: {},
  repeatAfterDefWin: 0.6,
  repeatAfterDefLoss: 0.3,
  importWeight: 0.4,
  siteMeta: DEFAULT_SITE_META,
  sameOpsOdds: 3,
};

export const emptyState = (): AppState => ({
  version: 1,
  players: [],
  logs: [],
  settings: structuredClone(DEFAULT_SETTINGS),
  match: null,
});

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export function parseState(raw: string): AppState {
  const data = JSON.parse(raw) as Partial<AppState>;
  if (data.version !== 1 || !Array.isArray(data.players) || !Array.isArray(data.logs)) {
    throw new Error("Not a PrepPhase export");
  }
  return {
    ...emptyState(),
    ...data,
    settings: { ...structuredClone(DEFAULT_SETTINGS), ...data.settings },
  } as AppState;
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? parseState(raw) : emptyState();
  } catch {
    return emptyState();
  }
}

export function useAppState() {
  const [state, setState] = useState<AppState>(load);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // Storage full or blocked (private mode) — the app still works for this session.
    }
  }, [state]);
  return [state, setState] as const;
}
