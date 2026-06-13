// ─── components/ui/Card.jsx ───────────────────────────────────────────────────
import "./Card.css";

export default function Card({ children, className = "", onClick, highlight }) {
  return (
    <div
      onClick={onClick}
      className={`card ${highlight ? "card--highlight" : ""} ${onClick ? "card--clickable" : ""} ${className}`}
    >
      {children}
    </div>
  );
}
