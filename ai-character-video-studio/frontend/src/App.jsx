// ─── App.jsx ──────────────────────────────────────────────────────────────────
// Root-Komponente: verwaltet globalen State und Seitennavigation.
// ─────────────────────────────────────────────────────────────────────────────
import { useState } from "react";

import Sidebar            from "./components/Sidebar";
import Dashboard          from "./components/Dashboard";
import CharacterManager   from "./components/CharacterManager";
import VideoCreator       from "./components/VideoCreator";
import StoryCreator       from "./components/StoryCreator";
import History            from "./components/History";
import Settings           from "./components/Settings";

import { MOCK_CHARACTERS, MOCK_VIDEOS } from "./lib/constants";

export default function App() {
  // ─── Globaler State ─────────────────────────────────────────────────────────
  const [page,    setPage]    = useState("dashboard");
  const [chars,   setChars]   = useState(MOCK_CHARACTERS);
  const [videos,  setVideos]  = useState(MOCK_VIDEOS);

  // Aktiv gesperrter Charakter (für Sidebar und Prompt-Einbettung)
  const lockedChar = chars.find((c) => c.locked) || null;

  // ─── Props für alle Seiten ───────────────────────────────────────────────────
  const sharedProps = {
    chars,
    setChars,
    videos,
    setVideos,
    onNavigate: setPage,
  };

  // ─── Seiten-Routing ──────────────────────────────────────────────────────────
  const renderPage = () => {
    switch (page) {
      case "dashboard":   return <Dashboard        {...sharedProps} />;
      case "characters":  return <CharacterManager {...sharedProps} />;
      case "video":       return <VideoCreator     {...sharedProps} />;
      case "story":       return <StoryCreator     {...sharedProps} />;
      case "history":     return <History          {...sharedProps} />;
      case "settings":    return <Settings         {...sharedProps} />;
      default:            return <Dashboard        {...sharedProps} />;
    }
  };

  return (
    <div className="app-shell">
      <Sidebar page={page} onNavigate={setPage} lockedChar={lockedChar} />
      <main className="app-main">
        {renderPage()}
      </main>
    </div>
  );
}
