// backend/src/routes/messages.js
// ─── CHAT HISTORY ROUTES ──────────────────────────────────────────────────────
//
//  GET    /api/notebooks/:id/messages          → fetch chat history (paginated)
//  POST   /api/notebooks/:id/messages          → append a message (used internally by query route)
//  DELETE /api/notebooks/:id/messages          → clear all messages in a notebook
//  DELETE /api/notebooks/:id/messages/:msgId   → delete a single message
//
import { Router } from "express";
import db from "../lib/db.js";
import { asyncHandler } from "../lib/helpers.js";

const router = Router({ mergeParams: true });

// ── GET /api/notebooks/:id/messages ──────────────────────────────────────────
// Query params:
//   limit  (default 100, max 500)
//   before (ISO date string) – cursor for pagination
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const notebookId = req.params.id;
    const limit = Math.min(parseInt(req.query.limit || "100"), 500);
    const before = req.query.before ? new Date(req.query.before) : undefined;

    const notebook = await db.notebook.findUnique({
      where: { id: notebookId },
      select: { id: true },
    });
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    const messages = await db.chatMessage.findMany({
      where: {
        notebookId,
        ...(before ? { createdAt: { lt: before } } : {}),
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    res.json(
      messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.content,
        sources: m.sources.split(",").filter(Boolean),
        createdAt: m.createdAt,
      })),
    );
  }),
);

// ── POST /api/notebooks/:id/messages ─────────────────────────────────────────
// Body: { role: "user"|"assistant", content: string, sources?: string[] }
// Called by the query route internally; can also be called directly to seed history.
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const notebookId = req.params.id;
    const { role, content, sources = [] } = req.body;

    if (!["user", "assistant"].includes(role)) {
      return res
        .status(400)
        .json({ error: "role must be 'user' or 'assistant'" });
    }
    if (!content?.trim())
      return res.status(400).json({ error: "content is required" });

    const notebook = await db.notebook.findUnique({
      where: { id: notebookId },
      select: { id: true },
    });
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    const message = await db.chatMessage.create({
      data: {
        notebookId,
        role,
        content: content.trim(),
        sources: sources.join(","),
      },
    });

    res.status(201).json({
      id: message.id,
      role: message.role,
      content: message.content,
      sources: message.sources.split(",").filter(Boolean),
      createdAt: message.createdAt,
    });
  }),
);

// ── DELETE /api/notebooks/:id/messages ───────────────────────────────────────
// Clears the entire chat history for this notebook.
// Does NOT delete the notebook or its files.
router.delete(
  "/",
  asyncHandler(async (req, res) => {
    const notebookId = req.params.id;

    const notebook = await db.notebook.findUnique({
      where: { id: notebookId },
      select: { id: true },
    });
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    const { count } = await db.chatMessage.deleteMany({
      where: { notebookId },
    });

    res.json({ deleted: count, notebookId });
  }),
);

// ── DELETE /api/notebooks/:id/messages/:msgId ─────────────────────────────────
// Deletes a single message by ID.
router.delete(
  "/:msgId",
  asyncHandler(async (req, res) => {
    const { id: notebookId, msgId } = req.params;

    const message = await db.chatMessage.findFirst({
      where: { id: msgId, notebookId },
    });
    if (!message) return res.status(404).json({ error: "Message not found" });

    await db.chatMessage.delete({ where: { id: msgId } });

    res.json({ deleted: msgId });
  }),
);

export default router;
