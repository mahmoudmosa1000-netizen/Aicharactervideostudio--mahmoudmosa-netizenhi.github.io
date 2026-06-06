// ─── components/ui/Input.jsx ─────────────────────────────────────────────────
import "./Input.css";

// ─── Textfeld ─────────────────────────────────────────────────────────────────
export function TextInput({ label, value, onChange, placeholder, type = "text", className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label">{label}</label>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="field__input"
      />
    </div>
  );
}

// ─── Mehrzeiliges Textfeld ────────────────────────────────────────────────────
export function TextArea({ label, value, onChange, placeholder, rows = 3, className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label">{label}</label>}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="field__input"
      />
    </div>
  );
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
export function Select({ label, value, onChange, options, className = "" }) {
  return (
    <div className={`field ${className}`}>
      {label && <label className="field__label">{label}</label>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field__input field__select"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
