// ─── components/ui/StatusPill.jsx ────────────────────────────────────────────
import "./StatusPill.css";

const STATUS_MAP = {
  done:       { label: "Done",       className: "pill--green"  },
  processing: { label: "Processing", className: "pill--gold",  pulse: true },
  queued:     { label: "Queued",     className: "pill--gray"   },
  error:      { label: "Error",      className: "pill--red"    },
};

export default function StatusPill({ status }) {
  const s = STATUS_MAP[status] || STATUS_MAP.queued;
  return (
    <span className={`pill ${s.className}`}>
      <span className={`pill__dot ${s.pulse ? "animate-pulse" : ""}`} />
      {s.label}
    </span>
  );
}
