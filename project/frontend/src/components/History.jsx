// ─── components/History.jsx ──────────────────────────────────────────────────
import { useState } from "react";
import "./History.css";
import Card from "./ui/Card";
import Button from "./ui/Button";
import StatusPill from "./ui/StatusPill";
import { Select } from "./ui/Input";

export default function History({ videos, chars }) {
  const [filter, setFilter] = useState("all");
  const [sort, setSort]     = useState("newest");

  const filtered = videos
    .filter((v) => filter === "all" || v.char === filter)
    .sort((a, b) => sort === "newest" ? b.id - a.id : a.id - b.id);

  return (
    <div className="page animate-fade-in">
      <div className="page-header">
        <div>
          <h1>Video History</h1>
          <p className="page-subtitle">{videos.length} videos generated</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="history-filters">
        <div className="history-filter-pills">
          {["all", ...chars.map((c) => c.name)].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`history-filter-pill ${filter === f ? "history-filter-pill--active" : ""}`}
            >
              {f === "all" ? "All Videos" : f}
            </button>
          ))}
        </div>
        <Select value={sort} onChange={setSort} options={[
          { value: "newest", label: "Newest first" },
          { value: "oldest", label: "Oldest first" },
        ]} className="history-sort" />
      </div>

      {filtered.length === 0 && (
        <div className="empty-state">
          <div className="empty-state__icon">▶</div>
          <p>No videos yet — generate your first video to see it here</p>
        </div>
      )}

      <div className="history-grid">
        {filtered.map((v) => (
          <HistoryCard key={v.id} video={v} />
        ))}
      </div>
    </div>
  );
}

function HistoryCard({ video: v }) {
  return (
    <Card className="history-card">
      <div className="history-card__thumb"
        style={{ background: `linear-gradient(140deg, ${v.charColor}22 0%, var(--bg-3) 100%)` }}>
        <div className="history-card__play">▶</div>
        <div className="history-card__status"><StatusPill status={v.status} /></div>
        <div className="history-card__badge-ratio">{v.ratio} · {v.dur}</div>
        <div className="history-card__badge-model">{v.model}</div>
      </div>
      <div className="history-card__body">
        <div className="history-card__scene">{v.scene}</div>
        <div className="history-card__meta">
          <span style={{ color: v.charColor, fontWeight: 600 }}>{v.char}</span>
          <span className="history-card__ts">{v.ts}</span>
        </div>
        <div className="history-card__actions">
          <Button size="sm" className="history-card__btn">⬇ MP4</Button>
          <Button size="sm" className="history-card__btn">⬇ Reels</Button>
          <Button size="sm" className="history-card__btn">⬇ Shorts</Button>
        </div>
      </div>
    </Card>
  );
}
