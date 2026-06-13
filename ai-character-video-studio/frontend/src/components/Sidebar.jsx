// ─── components/Sidebar.jsx ──────────────────────────────────────────────────
import "./Sidebar.css";
import { NAV_ITEMS } from "../lib/constants";

export default function Sidebar({ page, onNavigate, lockedChar }) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar__logo">
        <div className="sidebar__logo-icon">▶</div>
        <div>
          <div className="sidebar__logo-title">AI Character</div>
          <div className="sidebar__logo-sub">VIDEO STUDIO</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="sidebar__nav">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`sidebar__nav-item ${page === item.id ? "sidebar__nav-item--active" : ""}`}
          >
            <span className="sidebar__nav-icon">{item.icon}</span>
            <span>{item.label}</span>
            {item.badge && (
              <span className="sidebar__nav-badge">{item.badge}</span>
            )}
          </button>
        ))}
      </nav>

      {/* Character-Lock-Status */}
      <div className="sidebar__footer">
        {lockedChar ? (
          <div className="sidebar__lock sidebar__lock--active">
            <div className="sidebar__lock-label">🔒 Active Lock</div>
            <div className="sidebar__lock-name">{lockedChar.name}</div>
            <div className="sidebar__lock-hint">Embedded in all prompts</div>
          </div>
        ) : (
          <div className="sidebar__lock">
            <div className="sidebar__lock-label">No character locked</div>
            <div className="sidebar__lock-hint">Lock a character for consistency</div>
          </div>
        )}
      </div>
    </aside>
  );
}
