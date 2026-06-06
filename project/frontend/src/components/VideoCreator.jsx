// ─── components/VideoCreator.jsx ─────────────────────────────────────────────
import { useState, useEffect } from "react";
import "./VideoCreator.css";
import Card from "./ui/Card";
import Button from "./ui/Button";
import StatusPill from "./ui/StatusPill";
import { TextInput, TextArea, Select } from "./ui/Input";
import { videosApi } from "../lib/api";
import { STYLE_OPTIONS, DURATION_OPTIONS, RATIO_OPTIONS, MODEL_OPTIONS } from "../lib/constants";

export default function VideoCreator({ chars, setVideos }) {
  const [charId, setCharId]     = useState(chars[0]?.id || 1);
  const [scene, setScene]       = useState("");
  const [camera, setCamera]     = useState("");
  const [style, setStyle]       = useState("studio-ghibli");
  const [duration, setDuration] = useState("5");
  const [ratio, setRatio]       = useState("9:16");
  const [model, setModel]       = useState("kling");
  const [generating, setGenerating] = useState(false);
  const [result, setResult]     = useState(null);
  const [prompt, setPrompt]     = useState("");

  const selectedChar = chars.find((c) => c.id === Number(charId)) || chars[0];

  // Prompt automatisch aufbauen
  useEffect(() => {
    if (!selectedChar || !scene) { setPrompt(""); return; }
    setPrompt(videosApi.buildPrompt(selectedChar, scene, camera, style, duration, ratio));
  }, [scene, camera, style, duration, ratio, charId, selectedChar]);

  const generate = async () => {
    if (!scene || !selectedChar) return;
    setGenerating(true); setResult(null);
    await new Promise((r) => setTimeout(r, 2800)); // Simulation
    const newVid = {
      id: Date.now(), charId: selectedChar.id, char: selectedChar.name,
      charColor: selectedChar.color, scene, dur: `${duration}s`,
      ratio, status: "processing",
      model: MODEL_OPTIONS.find((m) => m.value === model)?.label || model,
      ts: "just now", prompt,
    };
    setVideos((prev) => [newVid, ...prev]);
    setResult(newVid);
    setGenerating(false);
  };

  const ratioStyle = {
    "16:9": "16 / 9", "9:16": "9 / 16", "1:1": "1 / 1", "4:5": "4 / 5",
  }[ratio] || "9 / 16";

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Video Creator</h1>
          <p className="page-subtitle">Generate videos with locked character consistency</p>
        </div>
      </div>

      <div className="vc-layout">
        {/* ── Left Panel ─────────────────────────────────────────────────── */}
        <div className="vc-form">
          {/* Character Picker */}
          <Card>
            <div className="field">
              <label className="field__label">Character</label>
              <div className="vc-char-picker">
                {chars.map((c) => (
                  <button
                    key={c.id}
                    className={`vc-char-btn ${Number(charId) === c.id ? "vc-char-btn--active" : ""}`}
                    style={Number(charId) === c.id ? { borderColor: c.color, background: `${c.color}0e` } : {}}
                    onClick={() => setCharId(c.id)}
                  >
                    <div className="vc-char-btn__avatar" style={{ background: `${c.color}20` }}>◈</div>
                    <div>
                      <div className="vc-char-btn__name">{c.name}</div>
                      <div className="vc-char-btn__lock" style={{ color: c.locked ? "var(--gold)" : "var(--text-3)" }}>
                        {c.locked ? "🔒 Locked" : "Unlocked"}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* Scene Inputs */}
          <Card>
            <TextArea label="Scene Description" value={scene} onChange={setScene} rows={4} className="vc-scene"
              placeholder="Describe what the character is doing, the setting, mood, lighting… be vivid and specific." />
            <TextInput label="Camera Instructions (optional)" value={camera} onChange={setCamera} className="vc-camera"
              placeholder="e.g. Slow push-in, warm golden-hour light, shallow depth of field" />
            <div className="vc-options">
              <Select label="Style"        value={style}    onChange={setStyle}    options={STYLE_OPTIONS} />
              <Select label="Duration"     value={duration} onChange={setDuration} options={DURATION_OPTIONS} />
              <Select label="Aspect Ratio" value={ratio}    onChange={setRatio}    options={RATIO_OPTIONS} />
              <Select label="AI Model"     value={model}    onChange={setModel}    options={MODEL_OPTIONS} />
            </div>
          </Card>

          {/* Prompt Preview */}
          {prompt && (
            <Card className="vc-prompt-card">
              <div className="vc-prompt-label">Auto-built Prompt</div>
              <div className="prompt-preview">{prompt}</div>
            </Card>
          )}

          <Button variant="primary" size="lg" onClick={generate} disabled={generating || !scene} className="vc-generate-btn">
            {generating ? "⟳ Submitting to AI…" : "▶ Generate Video"}
          </Button>
        </div>

        {/* ── Right Panel ────────────────────────────────────────────────── */}
        <div className="vc-sidebar">
          {/* Preview */}
          <div className="vc-preview" style={{ aspectRatio: ratioStyle }}>
            {generating ? (
              <>
                <div className="spinner" />
                <span>Submitting to {model}…</span>
              </>
            ) : result ? (
              <>
                <div className="vc-preview__done-icon">▶</div>
                <div className="vc-preview__done-text">Video queued!</div>
                <StatusPill status="processing" />
                <span className="vc-preview__eta">Est. 2–4 minutes</span>
              </>
            ) : (
              <>
                <div className="vc-preview__empty-icon">▶</div>
                <span>Preview will appear here</span>
              </>
            )}
          </div>

          {/* Character Profile */}
          {selectedChar && (
            <Card>
              <div className="vc-profile-label">Character Profile</div>
              <div className="vc-profile-header">
                <div className="vc-profile-avatar" style={{ background: `${selectedChar.color}1a` }}>◈</div>
                <div>
                  <div className="vc-profile-name">{selectedChar.name}</div>
                  {selectedChar.locked && <div className="vc-profile-lock">🔒 Consistency locked</div>}
                </div>
              </div>
              {[["Coloring", selectedChar.coloring], ["Eyes", selectedChar.eyes],
                ["Clothing", selectedChar.clothing], ["Accessories", selectedChar.accessories]].map(([k, v]) => (
                <div key={k} className="vc-profile-row">
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
            </Card>
          )}

          {/* Export Targets */}
          <Card>
            <div className="vc-profile-label">Export Targets</div>
            {[["MP4 (1080p)", "Universal"], ["TikTok", "9:16 optimised"],
              ["Instagram Reels", "4:5 crop"], ["YouTube Shorts", "With subtitles"]].map(([fmt, hint]) => (
              <div key={fmt} className="vc-export-row">
                <span>{fmt}</span><span>{hint}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
