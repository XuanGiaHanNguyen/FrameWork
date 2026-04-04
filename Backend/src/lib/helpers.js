// backend/src/lib/helpers.js
// ─── SHARED MIDDLEWARE & HELPERS ──────────────────────────────────────────────
import multer from "multer";

// ── Multer: store uploads in memory (we forward to S3 ourselves) ──────────────
export const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 50 * 1024 * 1024 }, // 50 MB per file
  fileFilter(_req, file, cb) {
    const allowed = ["application/pdf", "text/plain", "text/markdown"];
    // multer may report .md as application/octet-stream — allow by extension too
    const ext = file.originalname.split(".").pop().toLowerCase();
    if (allowed.includes(file.mimetype) || ["pdf", "txt", "md"].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// ── SSE: open a streaming response and return a send helper ───────────────────
// Usage:
//   const send = openSSE(res);
//   send({ type: "token", token: "hello" });
//   res.end();
export function openSSE(res) {
  res.setHeader("Content-Type",  "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection",    "keep-alive");
  res.flushHeaders();

  return function sendEvent(payload) {
    res.write(`data: ${JSON.stringify(payload)}\n\n`);
  };
}

// ── Wrap an async route so errors are forwarded to Express error handler ───────
export const asyncHandler = fn => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// ── Determine MIME type from file extension ────────────────────────────────────
export function mimeFromName(filename) {
  const ext = filename.split(".").pop().toLowerCase();
  return (
    ext === "pdf" ? "application/pdf" :
    ext === "md"  ? "text/markdown"   :
    "text/plain"
  );
}