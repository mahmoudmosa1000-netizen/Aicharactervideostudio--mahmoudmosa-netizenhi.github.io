// ─── components/CharacterManager.jsx ─────────────────────────────────────────
import { useState } from "react";
import "./CharacterManager.css";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { TextInput, TextArea } from "./ui/Input";
import { charactersApi } from "../lib/api";

export default function CharacterManager({ chars, setChars }) {
  const [showAdd, setShowAdd]       = useState(false);
  const [name, setName]             = useState("");
  const [desc, setDesc]             = useState("");
  const [analyzing, setAnalyzing]   = useState(false);
  const [analysis, setAnalysis]     = useState(null);
  const [apiError, setApiError]     = useState(null);

  const analyzeChar = async () => {
    if (!name || !desc) return;
    setAnalyzing(true); setAnalysis(null); setApiError(null);
    try {
      const result = await charactersApi.analyze(name, desc);
      setAnalysis(result);
    } catch {
      setApiError("Analysis failed — please check your API key and try again.");
    }
    setAnalyzing(false);
  };

  const saveChar = () => {
    if (!name || !analysis) return;
    const newChar = {
      id: Date.now(), name, description: desc, locked: false,
      color: "#a78bfa",
      traits: analysis.traits || [],
      style: analysis.style || "Animated",
      coloring: analysis.coloring || "—",
      eyes: analysis.eyes || "—",
      clothing: analysis.clothing || "—",
      accessories: analysis.accessories || "—",
      build: analysis.build || "—",
      consistencyNote: analysis.consistencyNote,
      videos: 0, series: 0,
    };
    setChars((prev) => [...prev, newChar]);
    setShowAdd(false); setName(""); setDesc(""); setAnalysis(null);
  };

  const toggleLock  = (id) => setChars((prev) => prev.map((c) => c.id === id ? { ...c, locked: !c.locked } : c));
  const deleteChar  = (id) => setChars((prev) => prev.filter((c) => c.id !== id));

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Character Manager</h1>
          <p className="page-subtitle">Build and manage AI-consistent character profiles</p>
        </div>
        <Button variant="primary" onClick={() => setShowAdd(!showAdd)}>
          + Add Character
        </Button>
      </div>

      {/* Add-Form */}
      {showAdd && (
        <Card className="char-add-form animate-scale-in" highlight>
          <h3 className="char-add-form__title">New Character Profile</h3>

          <div className="upload-zone char-add-form__upload">
            <div className="char-add-form__upload-icon">⬆</div>
            <p>Drop reference images here</p>
            <span>PNG, JPG up to 10 MB — multiple views recommended</span>
            <Button size="sm">Browse Files</Button>
          </div>

          <div className="char-add-form__fields">
            <TextInput label="Character Name" value={name} onChange={setName} placeholder="e.g. Mochi" />
            <TextInput label="Visual Description" value={desc} onChange={setDesc} placeholder="Describe appearance, clothing, colors, style in detail…" />
          </div>

          {analyzing && (
            <div className="char-add-form__analyzing">
              <div className="spinner" style={{ width: 18, height: 18 }} />
              Analyzing character traits…
            </div>
          )}

          {analysis && (
            <div className="char-analysis animate-fade-in">
              <div className="char-analysis__title">✓ Character Analysis Complete</div>
              <div className="char-analysis__grid">
                {[["Coloring", analysis.coloring], ["Eyes", analysis.eyes], ["Clothing", analysis.clothing],
                  ["Accessories", analysis.accessories], ["Build", analysis.build], ["Style", analysis.style]].map(([k, v]) => (
                  <div key={k} className="char-analysis__item">
                    <div className="char-analysis__item-key">{k}</div>
                    <div className="char-analysis__item-val">{v}</div>
                  </div>
                ))}
              </div>
              {analysis.consistencyNote && (
                <div className="char-analysis__note">"{analysis.consistencyNote}"</div>
              )}
              <div className="char-analysis__traits">
                {(analysis.traits || []).map((t) => (
                  <span key={t} className="badge badge-gold">{t}</span>
                ))}
              </div>
            </div>
          )}

          {apiError && <div className="error-box">{apiError}</div>}

          <div className="char-add-form__actions">
            <Button variant="ghost" onClick={() => { setShowAdd(false); setAnalysis(null); }}>Cancel</Button>
            <Button onClick={analyzeChar} disabled={analyzing || !desc || !name}>
              {analyzing ? "⟳ Analyzing…" : "◈ Analyze Character"}
            </Button>
            {analysis && <Button variant="primary" onClick={saveChar}>Save Character</Button>}
          </div>
        </Card>
      )}

      {/* Character Grid */}
      {chars.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">◈</div>
          <p>No characters yet — add your first character to begin</p>
        </div>
      )}

      <div className="char-grid">
        {chars.map((c) => (
          <CharCard key={c.id} char={c} onToggleLock={toggleLock} onDelete={deleteChar} />
        ))}
      </div>
    </div>
  );
}

function CharCard({ char: c, onToggleLock, onDelete }) {
  return (
    <Card className={`char-card ${c.locked ? "char-card--locked" : ""}`} style={{ borderColor: c.locked ? `${c.color}44` : undefined }}>
      <div className="char-card__header">
        <div className="char-card__identity">
          <div className="char-card__avatar" style={{ background: `${c.color}1a`, border: `1px solid ${c.color}33` }}>◈</div>
          <div>
            <div className="char-card__name">{c.name}</div>
            <div className="char-card__style">{c.style}</div>
          </div>
        </div>
        <div className="char-card__controls">
          <button
            className={`char-card__lock-btn ${c.locked ? "char-card__lock-btn--active" : ""}`}
            onClick={() => onToggleLock(c.id)}
          >
            {c.locked ? "🔒 LOCKED" : "🔓 LOCK"}
          </button>
          <button className="char-card__delete-btn" onClick={() => onDelete(c.id)}>✕</button>
        </div>
      </div>

      <p className="char-card__desc">{c.description}</p>

      <div className="char-card__traits-grid">
        {[["Coloring", c.coloring], ["Eyes", c.eyes], ["Clothing", c.clothing]].map(([k, v]) => (
          <div key={k} className="char-card__trait">
            <div className="char-card__trait-key">{k}</div>
            <div className="char-card__trait-val">{v}</div>
          </div>
        ))}
      </div>

      <div className="char-card__footer">
        <div className="char-card__tags">
          {(c.traits || []).slice(0, 3).map((t) => (
            <span key={t} className="char-card__tag" style={{ color: c.color, background: `${c.color}18` }}>{t}</span>
          ))}
        </div>
        <span className="char-card__count">{c.videos} videos · {c.series} series</span>
      </div>
    </Card>
  );
}
