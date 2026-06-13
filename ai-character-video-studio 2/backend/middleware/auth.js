// ─── backend/middleware/auth.js ───────────────────────────────────────────────
// Einfache API-Key-Authentifizierung als Middleware.
// Kann später durch JWT ersetzt werden.
// ─────────────────────────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  // Im Entwicklungsmodus überspringen
  if (process.env.NODE_ENV === "development") return next();

  const key = req.headers["x-api-key"] || req.query.apiKey;
  if (!key || key !== process.env.APP_API_KEY) {
    return res.status(401).json({ success: false, error: "Nicht autorisiert" });
  }
  next();
}

module.exports = { requireAuth };
