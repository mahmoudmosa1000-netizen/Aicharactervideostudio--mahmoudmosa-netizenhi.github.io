// ─── components/Settings.jsx ─────────────────────────────────────────────────
import { useState } from "react";
import "./Settings.css";
import Card from "./ui/Card";
import Button from "./ui/Button";
import { TextInput, Select } from "./ui/Input";
import { DEFAULT_MODEL_OPTIONS, RATIO_OPTIONS } from "../lib/constants";

// ─── Toggle-Schalter ─────────────────────────────────────────────────────────
function Toggle({ label, defaultVal }) {
  const [on, setOn] = useState(defaultVal);
  return (
    <div className="toggle-row">
      <span className="toggle-row__label">{label}</span>
      <button
        className={`toggle ${on ? "toggle--on" : ""}`}
        onClick={() => setOn(!on)}
        aria-label={label}
      >
        <div className="toggle__knob" />
      </button>
    </div>
  );
}

// ─── Settings-Sektion ─────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <Card>
      <h3 className="settings-section__title">{title}</h3>
      {children}
    </Card>
  );
}

export default function Settings() {
  const [keys, setKeys]   = useState({ kling: "", runway: "", luma: "", openai: "" });
  const [model, setModel] = useState("kling");
  const [ratio, setRatio] = useState("9:16");
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2200); };

  const apiKeyFields = [
    { key: "kling",  label: "Kling AI API Key",       hint: "kling.kuaishou.com — Developer Dashboard" },
    { key: "runway", label: "Runway Gen-3 API Key",    hint: "app.runwayml.com — API Settings" },
    { key: "luma",   label: "Luma Dream Machine Key",  hint: "lumalabs.ai — API Access" },
    { key: "openai", label: "OpenAI API Key",          hint: "platform.openai.com/api-keys" },
  ];

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Settings</h1>
          <p className="page-subtitle">API keys, defaults, and consistency engine</p>
        </div>
      </div>

      <div className="settings-layout">
        {/* API Keys */}
        <Section title="API Keys">
          <div className="settings-api-keys">
            {apiKeyFields.map(({ key, label, hint }) => (
              <div key={key}>
                <TextInput
                  label={label} type="password"
                  value={keys[key]}
                  onChange={(v) => setKeys((p) => ({ ...p, [key]: v }))}
                  placeholder="sk-•••••••••••••••••••••••••"
                />
                <p className="settings-hint">{hint}</p>
              </div>
            ))}
          </div>
        </Section>

        {/* Defaults */}
        <Section title="Generation Defaults">
          <div className="settings-defaults">
            <Select label="Default AI Model"     value={model} onChange={setModel} options={DEFAULT_MODEL_OPTIONS} />
            <Select label="Default Aspect Ratio" value={ratio} onChange={setRatio} options={RATIO_OPTIONS} />
          </div>
        </Section>

        {/* Consistency Engine */}
        <Section title="Character Consistency Engine">
          <p className="settings-desc">
            When Character Lock is enabled, the engine embeds a full visual consistency block into every prompt — same face, colours, clothing, and style across every video.
          </p>
          <div className="settings-toggles">
            <Toggle label="Auto-embed character profile in all prompts"        defaultVal={true}  />
            <Toggle label="Warn when generating without a locked character"    defaultVal={true}  />
            <Toggle label="Include style consistency clause in prompt"         defaultVal={true}  />
            <Toggle label="Auto-lock characters after first generated video"   defaultVal={false} />
            <Toggle label="Show prompt preview before each generation"         defaultVal={true}  />
          </div>
        </Section>

        {/* Export */}
        <Section title="Export Preferences">
          <div className="settings-toggles">
            <Toggle label="Auto-generate subtitles on export" defaultVal={false} />
            <Toggle label="Watermark with studio logo"        defaultVal={false} />
            <Toggle label="Save source prompts with export"   defaultVal={true}  />
          </div>
        </Section>

        <Button variant="primary" size="lg" onClick={save} className="settings-save-btn">
          {saved ? "✓ Gespeichert!" : "Einstellungen speichern"}
        </Button>
      </div>
    </div>
  );
}
