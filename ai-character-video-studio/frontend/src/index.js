// ─── index.js ─────────────────────────────────────────────────────────────────
// Einstiegspunkt: importiert alle CSS-Dateien und mountet React in den DOM.
// ─────────────────────────────────────────────────────────────────────────────
import React from "react";
import ReactDOM from "react-dom/client";

// ── CSS (Reihenfolge wichtig!) ────────────────────────────────────────────────
import "./styles/variables.css";    // 1. Design-Tokens (--bg-0, --gold, etc.)
import "./styles/global.css";       // 2. Reset + Utility-Klassen
import "./styles/animations.css";   // 3. Keyframes + Animations-Klassen

// ── App ───────────────────────────────────────────────────────────────────────
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
