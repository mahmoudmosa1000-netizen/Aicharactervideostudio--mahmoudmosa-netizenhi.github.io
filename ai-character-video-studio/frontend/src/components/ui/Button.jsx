// ─── components/ui/Button.jsx ─────────────────────────────────────────────────
import "./Button.css";

export default function Button({
  children,
  variant = "default",
  size = "md",
  onClick,
  disabled,
  className = "",
  type = "button",
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`btn btn--${variant} btn--${size} ${className}`}
    >
      {children}
    </button>
  );
}
