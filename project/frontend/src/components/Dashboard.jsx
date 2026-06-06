// ─── components/Dashboard.jsx ────────────────────────────────────────────────
import "./Dashboard.css";
import Card from "./ui/Card";
import Button from "./ui/Button";
import StatusPill from "./ui/StatusPill";

export default function Dashboard({ videos, chars, onNavigate }) {
  const stats = [
    { label: "Characters",      value: chars.length,                                         sub: `${chars.filter((c) => c.locked).length} locked`,   color: "gold"   },
    { label: "Videos Generated",value: videos.length,                                        sub: "+3 this week",                                       color: "blue"   },
    { label: "Story Series",     value: chars.reduce((a, c) => a + (c.series || 0), 0),      sub: "scenes total",                                       color: "purple" },
    { label: "Processing",       value: videos.filter((v) => v.status === "processing").length, sub: "Est. 2 min",                                      color: "green"  },
  ];

  const quickActions = [
    { title: "Create Story Series", desc: "Generate 5 connected scenes from one idea", icon: "◇", page: "story",      color: "purple" },
    { title: "Add Character",        desc: "Upload reference images for a new character", icon: "◈", page: "characters", color: "gold"   },
    { title: "Generate Video",       desc: "Create a single scene with precise control",  icon: "▶", page: "video",      color: "blue"   },
  ];

  return (
    <div className="page animate-fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1>Dashboard</h1>
          <p className="page-subtitle">Your creative studio at a glance</p>
        </div>
        <Button variant="primary" onClick={() => onNavigate("video")}>
          + New Video
        </Button>
      </div>

      {/* Stats */}
      <div className="dashboard__stats">
        {stats.map((s) => (
          <Card key={s.label} className="stat-card">
            <div className="stat-card__label">{s.label}</div>
            <div className={`stat-card__value stat-card__value--${s.color}`}>{s.value}</div>
            <div className="stat-card__sub">{s.sub}</div>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="section-header">
        <h2>Quick Actions</h2>
      </div>
      <div className="dashboard__actions">
        {quickActions.map((a) => (
          <Card key={a.title} onClick={() => onNavigate(a.page)} className="action-card">
            <div className={`action-card__icon action-card__icon--${a.color}`}>{a.icon}</div>
            <div className="action-card__title">{a.title}</div>
            <div className="action-card__desc">{a.desc}</div>
          </Card>
        ))}
      </div>

      {/* Recent Videos */}
      <div className="section-header">
        <h2>Recent Videos</h2>
        <Button variant="ghost" size="sm" onClick={() => onNavigate("history")}>
          View all →
        </Button>
      </div>
      <div className="dashboard__videos">
        {videos.slice(0, 3).map((v) => (
          <VideoThumbCard key={v.id} video={v} />
        ))}
      </div>

      {/* Characters */}
      <div className="section-header">
        <h2>Characters</h2>
        <Button variant="ghost" size="sm" onClick={() => onNavigate("characters")}>
          Manage →
        </Button>
      </div>
      <div className="dashboard__chars">
        {chars.map((c) => (
          <Card key={c.id} className="char-mini-card">
            <div className="char-mini-card__avatar" style={{ background: `${c.color}18`, border: `1px solid ${c.color}33` }}>◈</div>
            <div className="char-mini-card__info">
              <div className="char-mini-card__name">
                {c.name}
                {c.locked && <span className="badge badge-gold">LOCKED</span>}
              </div>
              <div className="char-mini-card__desc">{c.description}</div>
              <div className="char-mini-card__stats">{c.videos} videos · {c.series} series</div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function VideoThumbCard({ video: v }) {
  return (
    <Card className="video-thumb">
      <div className="video-thumb__preview" style={{ background: `linear-gradient(140deg, ${v.charColor}22 0%, var(--bg-3) 100%)` }}>
        <div className="video-thumb__play">▶</div>
        <div className="video-thumb__status"><StatusPill status={v.status} /></div>
        <div className="video-thumb__meta">{v.ratio} · {v.dur}</div>
      </div>
      <div className="video-thumb__body">
        <div className="video-thumb__scene">{v.scene}</div>
        <div className="video-thumb__footer">
          <span style={{ color: v.charColor }}>{v.char}</span>
          <span className="video-thumb__ts">{v.ts}</span>
        </div>
      </div>
    </Card>
  );
}
