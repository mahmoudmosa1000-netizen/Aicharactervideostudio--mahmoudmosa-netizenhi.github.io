// ─── components/ProcessingTimer.jsx ──────────────────────────────────────────
import { useState, useEffect } from "react";
import "./ProcessingTimer.css";

function getStage(pct) {
  if (pct < 5)   return "Queued — waiting for GPU...";
  if (pct < 15)  return "Initializing model...";
  if (pct < 35)  return "Generating keyframes...";
  if (pct < 58)  return "Compositing scene...";
  if (pct < 78)  return "Rendering output...";
  if (pct < 94)  return "Encoding video...";
  if (pct < 100) return "Almost ready!";
  return "✓ Done";
}

function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s.toString().padStart(2, "0")}s` : `${s}s`;
}

export default function ProcessingTimer({ video, onComplete, compact = false }) {
  const total = video.estimatedSecs || 180;
  const [elapsed, setElapsed] = useState(
    () => Math.floor((Date.now() - (video.createdAt || Date.now())) / 1000)
  );

  useEffect(() => {
    if (video.status !== "processing") return;
    const iv = setInterval(() => {
      const e = Math.floor((Date.now() - (video.createdAt || Date.now())) / 1000);
      setElapsed(e);
      if (e >= total) {
        clearInterval(iv);
        onComplete && onComplete(video.id);
      }
    }, 1000);
    return () => clearInterval(iv);
  }, [video.id, total, video.status]);

  const pct = Math.min(99, Math.floor((elapsed / total) * 100));
  const remaining = Math.max(0, total - elapsed);

  if (compact) {
    return (
      <div className="pt-compact">
        <div className="pt-track"><div className="pt-fill" style={{ width: `${pct}%` }} /></div>
        <div className="pt-compact-meta">
          <span className="pt-pct">{pct}%</span>
          <span className="pt-remain">{remaining > 0 ? `${fmtTime(remaining)} left` : "Finalizing..."}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="pt">
      <div className="pt-stage">
        <div className="pt-stage-dot" />
        {getStage(pct)}
      </div>
      <div className="pt-track"><div className="pt-fill" style={{ width: `${pct}%` }} /></div>
      <div className="pt-meta">
        <span className="pt-pct">{pct}%</span>
        <span className="pt-remain">
          {remaining > 0 ? `${fmtTime(remaining)} remaining` : "Finalizing..."}
        </span>
      </div>
      <div className="pt-elapsed">
        Started {fmtTime(elapsed)} ago · Est. total: {fmtTime(total)} · {video.model}
      </div>
    </div>
  );
}
