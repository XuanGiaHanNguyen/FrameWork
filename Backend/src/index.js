// backend/src/index.js
import "dotenv/config";
import express from "express";
import cors from "cors";

import notebookRoutes from "./routes/notebooks.js";
import fileRoutes from "./routes/files.js";
import messageRoutes from "./routes/messages.js";
import queryRoutes from "./routes/query.js";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);
app.options(/.*/, cors());
app.use(express.json({ limit: "10mb" }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.use("/api/notebooks", notebookRoutes);
app.use("/api/notebooks/:id/files", fileRoutes);
app.use("/api/notebooks/:id/messages", messageRoutes);
app.use("/api/notebooks/:id/query", queryRoutes);

// ── Health ────────────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`🚀  Backend running on http://localhost:${PORT}`);
});

// ── Error handling ────────────────────────────────────────────────────────────
process.on("uncaughtException", (err) => {
  console.error("Uncaught Exception:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});
