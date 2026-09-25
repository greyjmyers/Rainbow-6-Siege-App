import { useState } from "react";
import { useAppState } from "./lib/store";
import MatchView from "./components/MatchView";
import SquadView from "./components/SquadView";
import HistoryView from "./components/HistoryView";
import SetupView from "./components/SetupView";

const TABS = ["Match", "Squad", "History", "Setup"] as const;
type Tab = (typeof TABS)[number];

export default function App() {
  const [state, setState] = useAppState();
  const [tab, setTab] = useState<Tab>(state.players.length ? "Match" : "Squad");

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden>
            ◆
          </span>
          PrepPhase
        </div>
      </header>
      <main>
        {tab === "Match" && <MatchView state={state} setState={setState} goSquad={() => setTab("Squad")} />}
        {tab === "Squad" && <SquadView state={state} setState={setState} />}
        {tab === "History" && <HistoryView state={state} setState={setState} />}
        {tab === "Setup" && <SetupView state={state} setState={setState} />}
      </main>
      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t} className={t === tab ? "active" : ""} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </nav>
    </div>
  );
}
