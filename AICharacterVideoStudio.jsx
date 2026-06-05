import { useState, useEffect, useCallback } from "react";

// ─── Design Tokens ─────────────────────────────────────────────────────────────
const C = {
  bg0: "#07070c", bg1: "#0c0c15", bg2: "#11111c", bg3: "#181826", bg4: "#1e1e2e",
  border: "rgba(255,255,255,0.06)", borderMd: "rgba(255,255,255,0.11)", borderHi: "rgba(255,255,255,0.2)",
  gold: "#f59e0b", goldLight: "#fcd34d", goldBg: "rgba(245,158,11,0.1)", goldBorder: "rgba(245,158,11,0.28)",
  blue: "#4f9cf9", blueBg: "rgba(79,156,249,0.1)", blueBorder: "rgba(79,156,249,0.28)",
  green: "#22d3a5", greenBg: "rgba(34,211,165,0.1)",
  purple: "#a78bfa", purpleBg: "rgba(167,139,250,0.1)",
  red: "#fc8888", redBg: "rgba(252,136,136,0.1)",
  t1: "#f0f0f5", t2: "#8888a0", t3: "#44445a",
  fDisplay: '"Syne", "DM Sans", system-ui, sans-serif',
  fBody: '"DM Sans", system-ui, sans-serif',
  fMono: '"JetBrains Mono", "Fira Code", monospace',
};

// ─── Mock Data ──────────────────────────────────────────────────────────────────
const INIT_CHARS = [
  {
    id: 1, name: "Mochi", locked: true, color: C.gold,
    description: "Orange & white cat in traditional Japanese clothing with floral headscarf and gentle round eyes",
    traits: ["Curious", "Warm", "Creative"],
    style: "Studio Ghibli–inspired animation",
    coloring: "Orange & white fur", eyes: "Large, round, amber", clothing: "Yukata + floral headscarf",
    accessories: "Wicker basket, apron", build: "Small, soft proportions",
    videos: 14, series: 3,
  },
  {
    id: 2, name: "Captain Rex", locked: false, color: C.blue,
    description: "Navy blue penguin in a captain's coat with gold buttons, peaked cap and tiny brass telescope",
    traits: ["Adventurous", "Bold", "Loyal"],
    style: "2D cartoon, flat design",
    coloring: "Navy & white plumage", eyes: "Sharp, dark, determined", clothing: "Captain's coat + peaked cap",
    accessories: "Brass telescope, map scroll", build: "Stocky, upright posture",
    videos: 6, series: 1,
  },
];

const INIT_VIDEOS = [
  { id: 1, charId: 1, char: "Mochi", charColor: C.gold, scene: "Baking sourdough in a cozy cottage kitchen", dur: "5s", ratio: "9:16", status: "done", model: "Kling", ts: "2h ago" },
  { id: 2, charId: 1, char: "Mochi", charColor: C.gold, scene: "Opening a flower market at golden-hour sunrise", dur: "8s", ratio: "16:9", status: "done", model: "Runway", ts: "3h ago" },
  { id: 3, charId: 2, char: "Captain Rex", charColor: C.blue, scene: "Navigating a storm with compass in hand", dur: "6s", ratio: "1:1", status: "processing", model: "Luma", ts: "1h ago" },
  { id: 4, charId: 1, char: "Mochi", charColor: C.gold, scene: "Teaching pottery class to small forest creatures", dur: "10s", ratio: "9:16", status: "done", model: "Kling", ts: "1d ago" },
  { id: 5, charId: 2, char: "Captain Rex", charColor: C.blue, scene: "Discovering a treasure map on a remote island", dur: "7s", ratio: "16:9", status: "done", model: "Runway", ts: "2d ago" },
  { id: 6, charId: 1, char: "Mochi", charColor: C.gold, scene: "Writing letters at a moonlit wooden desk", dur: "5s", ratio: "9:16", status: "queued", model: "Kling", ts: "30m ago" },
];

const SCENE_COLORS = [C.gold, C.blue, C.purple, C.green, C.red];

// ─── Primitives ─────────────────────────────────────────────────────────────────
function Btn({ children, variant = "default", onClick, disabled, style: s, size = "md" }) {
  const sz = { sm: { padding: "6px 14px", fontSize: 12 }, md: { padding: "10px 20px", fontSize: 14 }, lg: { padding: "13px 28px", fontSize: 15 } }[size];
  const v = {
    default: { background: C.bg4, color: C.t1, border: `1px solid ${C.borderMd}` },
    primary: { background: C.gold, color: "#1a0d00", border: `1px solid ${C.gold}`, fontWeight: 600 },
    ghost: { background: "transparent", color: C.t2, border: "1px solid transparent" },
    danger: { background: C.redBg, color: C.red, border: `1px solid rgba(252,136,136,0.2)` },
    blue: { background: C.blueBg, color: C.blue, border: `1px solid ${C.blueBorder}` },
  }[variant];
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8, borderRadius: 10, cursor: disabled ? "not-allowed" : "pointer", fontFamily: C.fBody, opacity: disabled ? 0.45 : 1, transition: "all 0.15s", ...sz, ...v, ...s }}>
      {children}
    </button>
  );
}

function Field({ label, children, style: s }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, ...s }}>
      {label && <label style={{ fontSize: 11, color: C.t3, fontWeight: 600, letterSpacing: "0.07em", textTransform: "uppercase" }}>{label}</label>}
      {children}
    </div>
  );
}

const inputBase = { width: "100%", background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 14px", color: C.t1, fontSize: 14, fontFamily: "inherit", outline: "none", transition: "border 0.15s", resize: "vertical" };

function TextInput({ label, value, onChange, placeholder, style: s, type = "text" }) {
  return (
    <Field label={label} style={s}>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={inputBase} />
    </Field>
  );
}

function TextArea({ label, value, onChange, placeholder, rows = 3, style: s }) {
  return (
    <Field label={label} style={s}>
      <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows} style={inputBase} />
    </Field>
  );
}

function Sel({ label, value, onChange, options, style: s }) {
  return (
    <Field label={label} style={s}>
      <select value={value} onChange={e => onChange(e.target.value)} style={{ ...inputBase, cursor: "pointer", appearance: "none" }}>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </Field>
  );
}

function Card({ children, style: s, onClick }) {
  return (
    <div onClick={onClick} style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: 16, padding: "20px 24px", transition: "all 0.15s", cursor: onClick ? "pointer" : "default", ...s }}>
      {children}
    </div>
  );
}

function StatusPill({ status }) {
  const map = { done: { c: C.green, bg: C.greenBg, label: "Done" }, processing: { c: C.gold, bg: C.goldBg, label: "Processing" }, queued: { c: C.t2, bg: C.bg4, label: "Queued" }, error: { c: C.red, bg: C.redBg, label: "Error" } };
  const s = map[status] || map.queued;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, color: s.c, background: s.bg }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: s.c, display: "inline-block", animation: status === "processing" ? "pulse 1.5s infinite" : "none" }} />
      {s.label}
    </span>
  );
}

function PageHdr({ title, subtitle, action }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 32 }}>
      <div>
        <h1 style={{ fontFamily: C.fDisplay, fontSize: 26, fontWeight: 800, color: C.t1, marginBottom: 5 }}>{title}</h1>
        {subtitle && <p style={{ fontSize: 13, color: C.t2, marginTop: 0 }}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

function SectionHdr({ title, action }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
      <h2 style={{ fontFamily: C.fDisplay, fontSize: 16, fontWeight: 700, color: C.t1 }}>{title}</h2>
      {action}
    </div>
  );
}

function EmptyState({ icon, message }) {
  return (
    <div style={{ padding: "48px 24px", textAlign: "center", color: C.t3 }}>
      <div style={{ fontSize: 40, opacity: 0.25, marginBottom: 12 }}>{icon}</div>
      <div style={{ fontSize: 13 }}>{message}</div>
    </div>
  );
}

// ─── Video Thumbnail Card ───────────────────────────────────────────────────────
function VideoThumb({ v, onExport }) {
  return (
    <Card style={{ padding: 0, overflow: "hidden" }}>
      <div style={{ height: 148, background: `linear-gradient(140deg, ${v.charColor}22 0%, ${C.bg3} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ width: 46, height: 46, borderRadius: "50%", background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "rgba(255,255,255,0.8)", cursor: "pointer" }}>▶</div>
        <div style={{ position: "absolute", top: 10, right: 10 }}><StatusPill status={v.status} /></div>
        <div style={{ position: "absolute", bottom: 8, left: 10, background: "rgba(0,0,0,0.6)", padding: "2px 8px", borderRadius: 6, fontSize: 10, color: "rgba(255,255,255,0.6)" }}>{v.ratio} · {v.dur}</div>
        <div style={{ position: "absolute", bottom: 8, right: 10, background: "rgba(0,0,0,0.55)", padding: "2px 8px", borderRadius: 6, fontSize: 10, color: "rgba(255,255,255,0.4)" }}>{v.model}</div>
      </div>
      <div style={{ padding: "12px 14px" }}>
        <div style={{ fontSize: 12, fontWeight: 500, color: C.t1, marginBottom: 8, lineHeight: 1.5 }}>{v.scene}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
          <span style={{ fontSize: 11, color: v.charColor, fontWeight: 600 }}>{v.char}</span>
          <span style={{ fontSize: 10, color: C.t3 }}>{v.ts}</span>
        </div>
        {onExport && (
          <div style={{ display: "flex", gap: 6 }}>
            <Btn size="sm" variant="default" style={{ flex: 1, fontSize: 11 }} onClick={() => onExport(v, "mp4")}>⬇ MP4</Btn>
            <Btn size="sm" variant="default" style={{ flex: 1, fontSize: 11 }} onClick={() => onExport(v, "reels")}>⬇ Reels</Btn>
          </div>
        )}
      </div>
    </Card>
  );
}

// ─── Dashboard ──────────────────────────────────────────────────────────────────
function Dashboard({ videos, chars, onNavigate }) {
  const stats = [
    { label: "Characters", value: chars.length, sub: `${chars.filter(c => c.locked).length} locked`, color: C.gold },
    { label: "Videos Generated", value: videos.length, sub: "+3 this week", color: C.blue },
    { label: "Story Series", value: chars.reduce((a, c) => a + c.series, 0), sub: "scenes total", color: C.purple },
    { label: "Processing", value: videos.filter(v => v.status === "processing").length, sub: "Est. 2 min", color: C.green },
  ];
  const quickActions = [
    { title: "Create Story Series", desc: "Generate 5 connected scenes from one idea", icon: "◇", page: "story", color: C.purple, bg: C.purpleBg },
    { title: "Add Character", desc: "Upload reference images for a new character", icon: "◈", page: "characters", color: C.gold, bg: C.goldBg },
    { title: "Generate Video", desc: "Create a single scene with precise control", icon: "▶", page: "video", color: C.blue, bg: C.blueBg },
  ];
  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageHdr title="Dashboard" subtitle="Your creative studio at a glance" action={<Btn variant="primary" onClick={() => onNavigate("video")}>+ New Video</Btn>} />

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 28 }}>
        {stats.map(s => (
          <Card key={s.label} style={{ padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: C.t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 10 }}>{s.label}</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: s.color, fontFamily: C.fDisplay, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: C.t3, marginTop: 8 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Quick actions */}
      <SectionHdr title="Quick Actions" />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        {quickActions.map(a => (
          <Card key={a.title} onClick={() => onNavigate(a.page)} style={{ cursor: "pointer" }}>
            <div style={{ width: 42, height: 42, borderRadius: 12, background: a.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, color: a.color, marginBottom: 14 }}>{a.icon}</div>
            <div style={{ fontWeight: 700, color: C.t1, fontSize: 14, marginBottom: 6, fontFamily: C.fDisplay }}>{a.title}</div>
            <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6 }}>{a.desc}</div>
          </Card>
        ))}
      </div>

      {/* Recent videos */}
      <SectionHdr title="Recent Videos" action={<Btn variant="ghost" size="sm" onClick={() => onNavigate("history")}>View all →</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 28 }}>
        {videos.slice(0, 3).map(v => <VideoThumb key={v.id} v={v} />)}
      </div>

      {/* Characters */}
      <SectionHdr title="Characters" action={<Btn variant="ghost" size="sm" onClick={() => onNavigate("characters")}>Manage →</Btn>} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {chars.map(c => (
          <Card key={c.id} style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 18px" }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${c.color}18`, border: `1px solid ${c.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>◈</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span style={{ fontWeight: 700, color: C.t1, fontSize: 14, fontFamily: C.fDisplay }}>{c.name}</span>
                {c.locked && <span style={{ fontSize: 9, color: C.gold, background: C.goldBg, padding: "1px 8px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.06em" }}>LOCKED</span>}
              </div>
              <div style={{ fontSize: 11, color: C.t2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.description}</div>
              <div style={{ fontSize: 10, color: C.t3, marginTop: 4 }}>{c.videos} videos · {c.series} series</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Character Manager ──────────────────────────────────────────────────────────
function CharacterManager({ chars, setChars }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [apiError, setApiError] = useState(null);

  const analyzeChar = async () => {
    if (!name || !desc) return;
    setAnalyzing(true); setAnalysis(null); setApiError(null);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          messages: [{ role: "user", content: `Analyze this character for AI video generation consistency.
Character: ${name}
Description: ${desc}
Respond ONLY with valid JSON (no markdown, no preamble):
{"coloring":"...","eyes":"...","clothing":"...","accessories":"...","build":"...","style":"...","traits":["trait1","trait2","trait3"],"consistencyNote":"One sentence for consistent video generation"}` }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const parsed = JSON.parse(text.replace(/```json\n?|\n?```/g, "").trim());
      setAnalysis(parsed);
    } catch {
      setApiError("Analysis failed — please check your API connection and try again.");
    }
    setAnalyzing(false);
  };

  const saveChar = () => {
    if (!name || !analysis) return;
    setChars(prev => [...prev, {
      id: Date.now(), name, description: desc, locked: false,
      color: C.purple,
      traits: analysis.traits || [], style: analysis.style || "Animated",
      coloring: analysis.coloring || "—", eyes: analysis.eyes || "—",
      clothing: analysis.clothing || "—", accessories: analysis.accessories || "—",
      build: analysis.build || "—", consistencyNote: analysis.consistencyNote,
      videos: 0, series: 0,
    }]);
    setShowAdd(false); setName(""); setDesc(""); setAnalysis(null);
  };

  const toggleLock = id => setChars(prev => prev.map(c => c.id === id ? { ...c, locked: !c.locked } : c));
  const deleteChar = id => setChars(prev => prev.filter(c => c.id !== id));

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageHdr title="Character Manager" subtitle="Build and manage AI-consistent character profiles"
        action={<Btn variant="primary" onClick={() => setShowAdd(!showAdd)}>+ Add Character</Btn>} />

      {/* Add form */}
      {showAdd && (
        <Card style={{ marginBottom: 28, border: `1px solid ${C.goldBorder}` }}>
          <div style={{ fontFamily: C.fDisplay, fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 20 }}>New Character Profile</div>
          {/* Upload zone */}
          <div style={{ border: `2px dashed ${C.borderMd}`, borderRadius: 12, padding: "28px", textAlign: "center", marginBottom: 18, background: C.bg3, cursor: "pointer" }}>
            <div style={{ fontSize: 28, opacity: 0.25, marginBottom: 8 }}>⬆</div>
            <div style={{ color: C.t2, fontSize: 13 }}>Drop reference images here</div>
            <div style={{ color: C.t3, fontSize: 11, marginTop: 4 }}>PNG, JPG up to 10 MB — multiple views recommended</div>
            <Btn size="sm" style={{ marginTop: 12 }}>Browse Files</Btn>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 14, marginBottom: 16 }}>
            <TextInput label="Character Name" value={name} onChange={setName} placeholder="e.g. Mochi" />
            <TextInput label="Visual Description" value={desc} onChange={setDesc} placeholder="Describe appearance, clothing, colors, style in detail..." />
          </div>

          {analyzing && (
            <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 18px", background: C.bg3, borderRadius: 10, marginBottom: 14, color: C.t2, fontSize: 13 }}>
              <div style={{ width: 18, height: 18, border: `2px solid ${C.bg4}`, borderTop: `2px solid ${C.gold}`, borderRadius: "50%", animation: "spin 1s linear infinite", flexShrink: 0 }} />
              Analyzing character traits...
            </div>
          )}

          {analysis && !analysis.error && (
            <div style={{ background: C.goldBg, border: `1px solid ${C.goldBorder}`, borderRadius: 12, padding: "16px 20px", marginBottom: 16 }}>
              <div style={{ fontSize: 11, color: C.gold, fontWeight: 700, marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.07em" }}>✓ Character Analysis Complete</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 14 }}>
                {[["Coloring", analysis.coloring], ["Eyes", analysis.eyes], ["Clothing", analysis.clothing], ["Accessories", analysis.accessories], ["Build", analysis.build], ["Style", analysis.style]].map(([k, v]) => (
                  <div key={k} style={{ background: C.bg2, borderRadius: 8, padding: "8px 12px" }}>
                    <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>{k}</div>
                    <div style={{ fontSize: 12, color: C.t1, fontWeight: 500 }}>{v}</div>
                  </div>
                ))}
              </div>
              {analysis.consistencyNote && (
                <div style={{ fontSize: 12, color: C.t2, fontStyle: "italic", background: C.bg3, padding: "10px 14px", borderRadius: 8, lineHeight: 1.7 }}>
                  "{analysis.consistencyNote}"
                </div>
              )}
              <div style={{ display: "flex", gap: 6, marginTop: 12 }}>
                {(analysis.traits || []).map(t => (
                  <span key={t} style={{ fontSize: 11, color: C.gold, background: C.goldBg, padding: "2px 10px", borderRadius: 20, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
            </div>
          )}

          {apiError && (
            <div style={{ background: C.redBg, border: "1px solid rgba(252,136,136,0.2)", borderRadius: 10, padding: "12px 16px", marginBottom: 14, color: C.red, fontSize: 13 }}>
              {apiError}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
            <Btn variant="ghost" onClick={() => { setShowAdd(false); setAnalysis(null); setApiError(null); }}>Cancel</Btn>
            <Btn onClick={analyzeChar} disabled={analyzing || !desc || !name}>
              {analyzing ? "⟳ Analyzing…" : "◈ Analyze Character"}
            </Btn>
            {analysis && !apiError && (
              <Btn variant="primary" onClick={saveChar}>Save Character</Btn>
            )}
          </div>
        </Card>
      )}

      {/* Character grid */}
      {chars.length === 0 && <EmptyState icon="◈" message="No characters yet — add your first character to begin" />}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        {chars.map(c => (
          <Card key={c.id} style={{ border: `1px solid ${c.locked ? c.color + "44" : C.border}`, background: c.locked ? `${c.color}06` : C.bg2 }}>
            {/* Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 52, height: 52, borderRadius: 14, background: `${c.color}1a`, border: `1px solid ${c.color}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>◈</div>
                <div>
                  <div style={{ fontFamily: C.fDisplay, fontSize: 17, fontWeight: 800, color: C.t1 }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: C.t2, marginTop: 2 }}>{c.style}</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <button onClick={() => toggleLock(c.id)} style={{ padding: "5px 12px", borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: "pointer", border: "none", background: c.locked ? C.goldBg : C.bg4, color: c.locked ? C.gold : C.t3, letterSpacing: "0.04em" }}>
                  {c.locked ? "🔒 LOCKED" : "🔓 LOCK"}
                </button>
                <button onClick={() => deleteChar(c.id)} style={{ background: "none", border: "none", color: C.t3, cursor: "pointer", fontSize: 16, padding: "4px", lineHeight: 1 }}>✕</button>
              </div>
            </div>
            {/* Description */}
            <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.7, marginBottom: 14 }}>{c.description}</div>
            {/* Trait grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 8, marginBottom: 14 }}>
              {[["Coloring", c.coloring], ["Eyes", c.eyes], ["Clothing", c.clothing]].map(([k, v]) => (
                <div key={k} style={{ background: C.bg3, borderRadius: 8, padding: "8px 10px" }}>
                  <div style={{ fontSize: 9, color: C.t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{k}</div>
                  <div style={{ fontSize: 11, color: C.t1, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
            {/* Footer */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", gap: 5 }}>
                {(c.traits || []).slice(0, 3).map(t => (
                  <span key={t} style={{ fontSize: 10, color: c.color, background: `${c.color}18`, padding: "2px 9px", borderRadius: 20, fontWeight: 600 }}>{t}</span>
                ))}
              </div>
              <div style={{ fontSize: 11, color: C.t3 }}>{c.videos} videos · {c.series} series</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Video Creator ───────────────────────────────────────────────────────────────
function VideoCreator({ chars, setVideos }) {
  const [charId, setCharId] = useState(chars[0]?.id || 1);
  const [scene, setScene] = useState("");
  const [camera, setCamera] = useState("");
  const [style, setStyle] = useState("studio-ghibli");
  const [duration, setDuration] = useState("5");
  const [ratio, setRatio] = useState("9:16");
  const [model, setModel] = useState("kling");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);

  const selectedChar = chars.find(c => c.id === charId) || chars[0];

  const prompt = selectedChar && scene
    ? `[Character Consistency: ${selectedChar.name} — ${selectedChar.description}. Traits: ${selectedChar.traits?.join(", ")}. Clothing: ${selectedChar.clothing}, ${selectedChar.accessories}.] Scene: ${scene}${camera ? ` Camera: ${camera}.` : ""} Visual style: ${style}. Duration: ${duration}s. Ratio: ${ratio}.`
    : "";

  const generate = async () => {
    if (!scene || !selectedChar) return;
    setGenerating(true); setResult(null);
    await new Promise(r => setTimeout(r, 2800));
    const newVid = { id: Date.now(), charId: selectedChar.id, char: selectedChar.name, charColor: selectedChar.color, scene, dur: `${duration}s`, ratio, status: "processing", model: model.charAt(0).toUpperCase() + model.slice(1), ts: "just now" };
    setVideos(prev => [newVid, ...prev]);
    setResult(newVid);
    setGenerating(false);
  };

  const ratioAspect = ratio === "16:9" ? "16/9" : ratio === "9:16" ? "9/16" : ratio === "1:1" ? "1/1" : "4/5";

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageHdr title="Video Creator" subtitle="Generate videos with locked character consistency" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 24 }}>
        {/* Left */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          {/* Character picker */}
          <Card>
            <Field label="Character">
              <div style={{ display: "flex", gap: 10, marginTop: 2 }}>
                {chars.map(c => (
                  <button key={c.id} onClick={() => setCharId(c.id)} style={{ flex: 1, padding: "12px 14px", borderRadius: 12, cursor: "pointer", border: charId === c.id ? `1.5px solid ${c.color}` : `1px solid ${C.border}`, background: charId === c.id ? `${c.color}0e` : C.bg3, display: "flex", alignItems: "center", gap: 10, textAlign: "left", transition: "all 0.15s" }}>
                    <div style={{ width: 34, height: 34, borderRadius: 10, background: `${c.color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>◈</div>
                    <div>
                      <div style={{ fontWeight: 700, color: C.t1, fontSize: 13, fontFamily: C.fDisplay }}>{c.name}</div>
                      <div style={{ fontSize: 10, color: c.locked ? C.gold : C.t3, marginTop: 1 }}>{c.locked ? "🔒 Locked" : "Unlocked"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </Field>
          </Card>

          <Card>
            <TextArea label="Scene Description" value={scene} onChange={setScene} rows={4} style={{ marginBottom: 14 }}
              placeholder="Describe what the character is doing, the setting, mood, lighting… be vivid and specific." />
            <TextInput label="Camera Instructions (optional)" value={camera} onChange={setCamera} style={{ marginBottom: 14 }}
              placeholder="e.g. Slow push-in, warm golden-hour light, shallow depth of field" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
              <Sel label="Style" value={style} onChange={setStyle} options={[
                { value: "studio-ghibli", label: "Studio Ghibli" }, { value: "pixar", label: "Pixar 3D" },
                { value: "anime", label: "Anime" }, { value: "2d-cartoon", label: "2D Cartoon" },
                { value: "watercolor", label: "Watercolor" }, { value: "realistic", label: "Realistic" },
              ]} />
              <Sel label="Duration" value={duration} onChange={setDuration} options={[
                { value: "3", label: "3 sec" }, { value: "5", label: "5 sec" },
                { value: "8", label: "8 sec" }, { value: "10", label: "10 sec" }, { value: "15", label: "15 sec" },
              ]} />
              <Sel label="Aspect Ratio" value={ratio} onChange={setRatio} options={[
                { value: "9:16", label: "9:16 TikTok" }, { value: "16:9", label: "16:9 YouTube" },
                { value: "1:1", label: "1:1 Square" }, { value: "4:5", label: "4:5 Instagram" },
              ]} />
              <Sel label="AI Model" value={model} onChange={setModel} options={[
                { value: "kling", label: "Kling AI" }, { value: "runway", label: "Runway Gen-3" }, { value: "luma", label: "Luma Dream" },
              ]} />
            </div>
          </Card>

          {/* Prompt preview */}
          {prompt && (
            <Card style={{ background: C.bg3 }}>
              <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Auto-built Prompt</div>
              <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.8, fontFamily: C.fMono, background: C.bg2, padding: "12px 14px", borderRadius: 8, border: `1px solid ${C.border}` }}>{prompt}</div>
            </Card>
          )}

          <Btn variant="primary" size="lg" onClick={generate} disabled={generating || !scene} style={{ width: "100%" }}>
            {generating ? "⟳ Submitting to AI…" : "▶ Generate Video"}
          </Btn>
        </div>

        {/* Right */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Preview box */}
          <div style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 16, aspectRatio: ratioAspect, minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            {generating ? (
              <>
                <div style={{ width: 38, height: 38, borderRadius: "50%", border: `3px solid ${C.bg4}`, borderTop: `3px solid ${C.gold}`, animation: "spin 1s linear infinite" }} />
                <div style={{ color: C.t2, fontSize: 13 }}>Submitting to {model}…</div>
              </>
            ) : result ? (
              <>
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: C.goldBg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, color: C.gold }}>▶</div>
                <div style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>Video queued!</div>
                <StatusPill status="processing" />
                <div style={{ fontSize: 11, color: C.t3 }}>Est. 2–4 minutes</div>
              </>
            ) : (
              <>
                <div style={{ fontSize: 36, opacity: 0.1 }}>▶</div>
                <div style={{ color: C.t3, fontSize: 12 }}>Preview will appear here</div>
              </>
            )}
          </div>

          {/* Character profile */}
          {selectedChar && (
            <Card>
              <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Character Profile</div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: `${selectedChar.color}1a`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>◈</div>
                <div>
                  <div style={{ fontWeight: 700, color: C.t1, fontSize: 14, fontFamily: C.fDisplay }}>{selectedChar.name}</div>
                  {selectedChar.locked && <div style={{ fontSize: 10, color: C.gold, marginTop: 1 }}>🔒 Consistency locked</div>}
                </div>
              </div>
              {[["Coloring", selectedChar.coloring], ["Eyes", selectedChar.eyes], ["Clothing", selectedChar.clothing], ["Accessories", selectedChar.accessories]].map(([k, v]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${C.border}`, fontSize: 12 }}>
                  <span style={{ color: C.t3 }}>{k}</span>
                  <span style={{ color: C.t1, fontWeight: 500, textAlign: "right", maxWidth: "60%" }}>{v}</span>
                </div>
              ))}
            </Card>
          )}

          {/* Export targets */}
          <Card>
            <div style={{ fontSize: 10, color: C.t3, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 12 }}>Export Targets</div>
            {[["MP4 (1080p)", "Universal"], ["TikTok", "9:16 optimised"], ["Instagram Reels", "4:5 crop"], ["YouTube Shorts", "With subtitles"]].map(([fmt, hint]) => (
              <div key={fmt} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", background: C.bg3, borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                <span style={{ color: C.t1, fontWeight: 500 }}>{fmt}</span>
                <span style={{ fontSize: 10, color: C.t3 }}>{hint}</span>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}

// ─── Story Creator ───────────────────────────────────────────────────────────────
function StoryCreator({ chars }) {
  const [charId, setCharId] = useState(String(chars[0]?.id || 1));
  const [idea, setIdea] = useState("");
  const [scenes, setScenes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState(null);
  const [editingIdx, setEditingIdx] = useState(null);

  const selectedChar = chars.find(c => c.id === Number(charId)) || chars[0];

  const generateStory = async () => {
    if (!idea || !selectedChar) return;
    setLoading(true); setApiError(null); setScenes([]);
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1200,
          messages: [{
            role: "user",
            content: `You are an AI video story writer specialising in short-form animated content.

Character: ${selectedChar.name}
Character description: ${selectedChar.description}
Story idea: "${idea}"

Generate exactly 5 connected video scenes. ${selectedChar.name} must appear identically in ALL scenes.

Respond ONLY with a raw JSON array — no markdown, no preamble, no backticks:
[
  {
    "scene": 1,
    "title": "Short evocative title",
    "description": "What ${selectedChar.name} is doing — 2-3 vivid visual sentences that can drive a video prompt",
    "camera": "Specific camera move and framing",
    "mood": "One-word emotional tone",
    "duration": "5s"
  }
]`,
          }],
        }),
      });
      const data = await res.json();
      const text = data.content?.[0]?.text || "";
      const clean = text.replace(/```json\n?|\n?```/g, "").trim();
      setScenes(JSON.parse(clean));
    } catch {
      setApiError("Story generation failed. Check your connection and try again.");
    }
    setLoading(false);
  };

  const updateScene = (idx, field, val) => {
    setScenes(prev => prev.map((s, i) => i === idx ? { ...s, [field]: val } : s));
  };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageHdr title="Story Creator" subtitle="One idea → five connected scenes, same character throughout" />

      {/* Input bar */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: "grid", gridTemplateColumns: "200px 1fr auto", gap: 14, alignItems: "flex-end" }}>
          <Sel label="Character" value={charId} onChange={setCharId}
            options={chars.map(c => ({ value: String(c.id), label: `${c.name}${c.locked ? " 🔒" : ""}` }))} />
          <TextInput label="Story Idea" value={idea} onChange={setIdea}
            placeholder='e.g. "Mochi opens a bakery and slowly befriends the whole neighbourhood" — one line is enough' />
          <Btn variant="primary" size="lg" onClick={generateStory} disabled={loading || !idea} style={{ whiteSpace: "nowrap", alignSelf: "flex-end" }}>
            {loading ? "⟳ Generating…" : "◇ Create Story"}
          </Btn>
        </div>
      </Card>

      {apiError && (
        <div style={{ background: C.redBg, border: "1px solid rgba(252,136,136,0.2)", borderRadius: 12, padding: "14px 18px", marginBottom: 20, color: C.red, fontSize: 13 }}>
          {apiError}
        </div>
      )}

      {/* Skeleton loader */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} style={{ height: 96, background: C.bg2, borderRadius: 14, border: `1px solid ${C.border}`, overflow: "hidden", position: "relative" }}>
              <div style={{ position: "absolute", inset: 0, background: `linear-gradient(90deg, transparent 0%, ${C.bg3} 50%, transparent 100%)`, backgroundSize: "200% 100%", animation: "shimmer 1.4s ease infinite" }} />
            </div>
          ))}
        </div>
      )}

      {scenes.length > 0 && (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ fontFamily: C.fDisplay, fontSize: 15, fontWeight: 700, color: C.t1 }}>
              Story: <span style={{ color: C.t2, fontWeight: 400 }}>"{idea}"</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <Btn size="sm">⬇ Export Prompts</Btn>
              <Btn size="sm" variant="primary">▶ Generate All 5 Videos</Btn>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {scenes.map((s, i) => (
              <Card key={i} style={{ display: "grid", gridTemplateColumns: "56px 1fr auto", gap: 18, alignItems: "flex-start", padding: "18px 20px" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <div style={{ width: 46, height: 46, borderRadius: 12, background: `${SCENE_COLORS[i]}18`, border: `1px solid ${SCENE_COLORS[i]}33`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, fontWeight: 800, color: SCENE_COLORS[i], fontFamily: C.fDisplay }}>{s.scene}</div>
                  {i < scenes.length - 1 && <div style={{ width: 1, height: 20, background: C.border, marginTop: 6 }} />}
                </div>
                <div>
                  {editingIdx === i ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <TextInput value={s.title} onChange={v => updateScene(i, "title", v)} />
                      <TextArea value={s.description} onChange={v => updateScene(i, "description", v)} rows={3} />
                      <Btn size="sm" onClick={() => setEditingIdx(null)}>✓ Done</Btn>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontFamily: C.fDisplay, fontSize: 14, fontWeight: 700, color: C.t1, marginBottom: 6 }}>{s.title}</div>
                      <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.75, marginBottom: 10 }}>{s.description}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 11, color: C.t3, background: C.bg3, padding: "3px 10px", borderRadius: 8 }}>📷 {s.camera}</span>
                        <span style={{ fontSize: 11, color: SCENE_COLORS[i], background: `${SCENE_COLORS[i]}12`, padding: "3px 10px", borderRadius: 8 }}>✦ {s.mood}</span>
                        <span style={{ fontSize: 11, color: C.t3, background: C.bg3, padding: "3px 10px", borderRadius: 8 }}>⏱ {s.duration}</span>
                      </div>
                    </>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, flexShrink: 0 }}>
                  <Btn variant="primary" size="sm">▶ Generate</Btn>
                  <Btn size="sm" onClick={() => setEditingIdx(editingIdx === i ? null : i)}>✎ Edit</Btn>
                </div>
              </Card>
            ))}
          </div>

          {/* Consistency banner */}
          <div style={{ marginTop: 20, background: C.goldBg, border: `1px solid ${C.goldBorder}`, borderRadius: 12, padding: "14px 18px", display: "flex", gap: 14, alignItems: "center" }}>
            <div style={{ fontSize: 22 }}>🔒</div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.gold, marginBottom: 3 }}>Character Consistency Active</div>
              <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.6 }}>
                {selectedChar?.name}'s full visual profile is embedded into every scene prompt — same face, same clothing, same style across all 5 videos.
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────────
function History({ videos, chars }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("newest");

  const filtered = videos
    .filter(v => filter === "all" || v.char === filter)
    .sort((a, b) => sort === "newest" ? b.id - a.id : a.id - b.id);

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageHdr title="Video History" subtitle={`${videos.length} videos generated`} />

      {/* Filter bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div style={{ display: "flex", gap: 8 }}>
          {["all", ...chars.map(c => c.name)].map(f => (
            <button key={f} onClick={() => setFilter(f)}
              style={{ padding: "7px 16px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer", border: "none", fontFamily: C.fBody, transition: "all 0.15s", background: filter === f ? C.gold : C.bg3, color: filter === f ? "#1a0d00" : C.t2 }}>
              {f === "all" ? "All Videos" : f}
            </button>
          ))}
        </div>
        <Sel value={sort} onChange={setSort} options={[{ value: "newest", label: "Newest first" }, { value: "oldest", label: "Oldest first" }]} style={{ width: 160 }} />
      </div>

      {filtered.length === 0 && <EmptyState icon="▶" message="No videos yet — generate your first video to see it here" />}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
        {filtered.map(v => <VideoThumb key={v.id} v={v} onExport={(vid, fmt) => console.log("export", vid.id, fmt)} />)}
      </div>
    </div>
  );
}

// ─── Settings ─────────────────────────────────────────────────────────────────────
function ToggleRow({ label, defaultVal }) {
  const [on, setOn] = useState(defaultVal);
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: C.bg3, borderRadius: 10 }}>
      <span style={{ fontSize: 13, color: C.t1 }}>{label}</span>
      <button onClick={() => setOn(!on)} style={{ width: 40, height: 22, borderRadius: 11, border: "none", cursor: "pointer", background: on ? C.gold : C.bg4, position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
        <div style={{ width: 16, height: 16, borderRadius: "50%", background: "white", position: "absolute", top: 3, left: on ? 21 : 3, transition: "left 0.2s" }} />
      </button>
    </div>
  );
}

function Settings() {
  const [keys, setKeys] = useState({ kling: "", runway: "", luma: "", openai: "" });
  const [defaultModel, setDefaultModel] = useState("kling");
  const [defaultRatio, setDefaultRatio] = useState("9:16");
  const [saved, setSaved] = useState(false);

  const save = () => { setSaved(true); setTimeout(() => setSaved(false), 2200); };

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      <PageHdr title="Settings" subtitle="API keys, defaults, and consistency engine" />
      <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 640 }}>

        {/* API Keys */}
        <Card>
          <div style={{ fontFamily: C.fDisplay, fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 20 }}>API Keys</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[
              { key: "kling", label: "Kling AI API Key", hint: "kling.kuaishou.com — Developer Dashboard" },
              { key: "runway", label: "Runway Gen-3 API Key", hint: "app.runwayml.com — API Settings" },
              { key: "luma", label: "Luma Dream Machine Key", hint: "lumalabs.ai — API Access" },
              { key: "openai", label: "OpenAI API Key", hint: "platform.openai.com/api-keys" },
            ].map(({ key, label, hint }) => (
              <div key={key}>
                <TextInput label={label} type="password" value={keys[key]} onChange={v => setKeys(p => ({ ...p, [key]: v }))} placeholder="sk-•••••••••••••••••••••••••" />
                <div style={{ fontSize: 11, color: C.t3, marginTop: 4 }}>{hint}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Defaults */}
        <Card>
          <div style={{ fontFamily: C.fDisplay, fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 20 }}>Generation Defaults</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Sel label="Default AI Model" value={defaultModel} onChange={setDefaultModel} options={[
              { value: "kling", label: "Kling AI" }, { value: "runway", label: "Runway Gen-3" }, { value: "luma", label: "Luma Dream" },
            ]} />
            <Sel label="Default Aspect Ratio" value={defaultRatio} onChange={setDefaultRatio} options={[
              { value: "9:16", label: "9:16 — TikTok / Reels" }, { value: "16:9", label: "16:9 — YouTube" }, { value: "1:1", label: "1:1 — Square" },
            ]} />
          </div>
        </Card>

        {/* Consistency Engine */}
        <Card>
          <div style={{ fontFamily: C.fDisplay, fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 10 }}>Character Consistency Engine</div>
          <div style={{ fontSize: 12, color: C.t2, lineHeight: 1.8, marginBottom: 18 }}>
            When Character Lock is enabled, the engine automatically embeds a full visual consistency block into every prompt — same face, colours, clothing, and style across every scene and every video.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ToggleRow label="Auto-embed character profile in all prompts" defaultVal={true} />
            <ToggleRow label="Warn when generating without a locked character" defaultVal={true} />
            <ToggleRow label="Include style consistency clause in prompt" defaultVal={true} />
            <ToggleRow label="Auto-lock characters after first generated video" defaultVal={false} />
            <ToggleRow label="Show prompt preview before each generation" defaultVal={true} />
          </div>
        </Card>

        {/* Export */}
        <Card>
          <div style={{ fontFamily: C.fDisplay, fontSize: 15, fontWeight: 700, color: C.t1, marginBottom: 18 }}>Export Preferences</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <ToggleRow label="Auto-generate subtitles on export" defaultVal={false} />
            <ToggleRow label="Watermark with studio logo" defaultVal={false} />
            <ToggleRow label="Save source prompts with each export" defaultVal={true} />
          </div>
        </Card>

        <Btn variant="primary" size="lg" onClick={save} style={{ width: 200 }}>
          {saved ? "✓ Saved!" : "Save Settings"}
        </Btn>
      </div>
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────────
const NAV = [
  { id: "dashboard", label: "Dashboard", icon: "⬡" },
  { id: "characters", label: "Characters", icon: "◈" },
  { id: "video", label: "Video Creator", icon: "▶" },
  { id: "story", label: "Story Creator", icon: "◇" },
  { id: "history", label: "History", icon: "⊟" },
  { id: "settings", label: "Settings", icon: "◎" },
];

function Sidebar({ page, onNavigate, lockedChar }) {
  return (
    <div style={{ width: 236, flexShrink: 0, background: C.bg1, borderRight: `1px solid ${C.border}`, display: "flex", flexDirection: "column", height: "100vh", position: "sticky", top: 0, overflowY: "auto" }}>
      {/* Logo */}
      <div style={{ padding: "22px 20px 20px", borderBottom: `1px solid ${C.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 11, background: C.goldBg, border: `1px solid ${C.goldBorder}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, color: C.gold }}>▶</div>
          <div>
            <div style={{ fontFamily: C.fDisplay, fontSize: 13, fontWeight: 800, color: C.t1, letterSpacing: "-0.01em" }}>AI Character</div>
            <div style={{ fontFamily: C.fDisplay, fontSize: 11, color: C.gold, fontWeight: 600, letterSpacing: "0.04em" }}>VIDEO STUDIO</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav style={{ padding: "14px 10px", flex: 1 }}>
        {NAV.map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)} style={{ width: "100%", padding: "9px 12px", borderRadius: 10, border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: 10, textAlign: "left", fontFamily: C.fBody, fontSize: 13, fontWeight: 500, marginBottom: 2, transition: "all 0.15s", background: page === item.id ? C.goldBg : "transparent", color: page === item.id ? C.gold : C.t2, borderLeft: page === item.id ? `2px solid ${C.gold}` : "2px solid transparent" }}>
            <span style={{ fontSize: 15, opacity: page === item.id ? 1 : 0.6 }}>{item.icon}</span>
            {item.label}
            {item.id === "story" && <span style={{ marginLeft: "auto", fontSize: 9, color: C.purple, background: C.purpleBg, padding: "1px 7px", borderRadius: 10, fontWeight: 700, letterSpacing: "0.05em" }}>AI</span>}
          </button>
        ))}
      </nav>

      {/* Active character */}
      <div style={{ padding: "14px 16px", borderTop: `1px solid ${C.border}` }}>
        {lockedChar ? (
          <div style={{ background: C.goldBg, border: `1px solid ${C.goldBorder}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: C.gold, fontWeight: 700, marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>🔒 Active Lock</div>
            <div style={{ fontSize: 11, color: C.t1, fontWeight: 600, marginBottom: 2 }}>{lockedChar.name}</div>
            <div style={{ fontSize: 10, color: C.t2 }}>Embedded in all prompts</div>
          </div>
        ) : (
          <div style={{ background: C.bg3, border: `1px solid ${C.border}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 10, color: C.t3, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>No character locked</div>
            <div style={{ fontSize: 10, color: C.t3 }}>Lock a character for consistency</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App Root ────────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("dashboard");
  const [chars, setChars] = useState(INIT_CHARS);
  const [videos, setVideos] = useState(INIT_VIDEOS);

  const lockedChar = chars.find(c => c.locked) || null;

  useEffect(() => {
    // Inject Google Fonts
    if (!document.getElementById("__cvs_fonts")) {
      const link = document.createElement("link");
      link.id = "__cvs_fonts";
      link.rel = "stylesheet";
      link.href = "https://fonts.googleapis.com/css2?family=Syne:wght@500;600;700;800&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap";
      document.head.appendChild(link);
    }
    if (!document.getElementById("__cvs_styles")) {
      const style = document.createElement("style");
      style.id = "__cvs_styles";
      style.textContent = `
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: #07070c; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
        input, textarea, select, button { font-family: "DM Sans", system-ui, sans-serif; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.18); }
        input:focus, textarea:focus, select:focus { border-color: rgba(245,158,11,0.45) !important; box-shadow: 0 0 0 3px rgba(245,158,11,0.08); }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }
        @keyframes shimmer { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
      `;
      document.head.appendChild(style);
    }
  }, []);

  const pages = { dashboard: Dashboard, characters: CharacterManager, video: VideoCreator, story: StoryCreator, history: History, settings: Settings };
  const PageComponent = pages[page] || Dashboard;

  const pageProps = { onNavigate: setPage, chars, setChars, videos, setVideos };

  return (
    <div style={{ display: "flex", minHeight: "100vh", background: C.bg0, fontFamily: C.fBody }}>
      <Sidebar page={page} onNavigate={setPage} lockedChar={lockedChar} />
      <main style={{ flex: 1, overflowY: "auto", padding: "32px 36px", maxHeight: "100vh" }}>
        <PageComponent {...pageProps} />
      </main>
    </div>
  );
}
