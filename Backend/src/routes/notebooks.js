// backend/src/routes/notebooks.js
// ─── NOTEBOOK (FOLDER) ROUTES ─────────────────────────────────────────────────
//
//  POST   /api/notebooks              → create empty notebook
//  GET    /api/notebooks              → list all notebooks (with file + message counts)
//  GET    /api/notebooks/:id          → get one notebook (files + recent messages)
//  PATCH  /api/notebooks/:id          → rename notebook
//  DELETE /api/notebooks/:id          → delete notebook + all files (S3) + all messages
//
import { Router } from "express";
import db from "../lib/db.js";
import { deleteNotebookFiles } from "../lib/s3.js";
import { asyncHandler } from "../lib/helpers.js";

const router = Router();

// ── POST /api/notebooks ───────────────────────────────────────────────────────
// Body: { name: string }
// Creates a blank notebook. No files, no messages.
router.post("/", asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const notebook = await db.notebook.create({
    data: { name: name.trim() },
  });

  res.status(201).json(notebook);
}));

// ── GET /api/notebooks ────────────────────────────────────────────────────────
// Returns all notebooks with counts — used to render the home grid.
router.get("/", asyncHandler(async (_req, res) => {
  const notebooks = await db.notebook.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { files: true, messages: true },
      },
      files: {
        select: { id: true, name: true, sizeBytes: true, chunks: true, createdAt: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  // Shape into the format the frontend expects
  const shaped = notebooks.map(nb => ({
    id:         nb.id,
    name:       nb.name,
    createdAt:  nb.createdAt,
    updatedAt:  nb.updatedAt,
    fileCount:  nb._count.files,
    msgCount:   nb._count.messages,
    // papers array keeps frontend NotebookCard working without changes
    papers: nb.files.map(f => ({
      id:       f.id,
      name:     f.name,
      size:     f.sizeBytes,
      chunks:   f.chunks,
    })),
  }));

  res.json(shaped);
}));

// ── GET /api/notebooks/:id ────────────────────────────────────────────────────
// Returns full notebook with all files + last 200 chat messages.
router.get("/:id", asyncHandler(async (req, res) => {
  const notebook = await db.notebook.findUnique({
    where: { id: req.params.id },
    include: {
      files: {
        orderBy: { createdAt: "asc" },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        take:    200,  // cap to avoid sending huge payloads
      },
    },
  });

  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  res.json({
    id:        notebook.id,
    name:      notebook.name,
    createdAt: notebook.createdAt,
    updatedAt: notebook.updatedAt,
    papers: notebook.files.map(f => ({
      id:       f.id,
      name:     f.name,
      s3Key:    f.s3Key,
      size:     f.sizeBytes,
      mimeType: f.mimeType,
      chunks:   f.chunks,
    })),
    messages: notebook.messages.map(m => ({
      id:        m.id,
      role:      m.role,
      content:   m.content,
      sources:   m.sources,
      createdAt: m.createdAt,
    })),
  });
}));

// ── PATCH /api/notebooks/:id ──────────────────────────────────────────────────
// Body: { name: string }
// Renames a notebook.
router.patch("/:id", asyncHandler(async (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name is required" });

  const notebook = await db.notebook.update({
    where: { id: req.params.id },
    data:  { name: name.trim() },
  });

  res.json(notebook);
}));

// ── DELETE /api/notebooks/:id ─────────────────────────────────────────────────
// Cascade order:
//   1. Delete all S3 objects under notebooks/<id>/
//   2. Prisma cascade deletes: notebook_files + chat_messages (via onDelete: Cascade)
//   3. Delete the notebook row itself
router.delete("/:id", asyncHandler(async (req, res) => {
  const { id } = req.params;

  // Check it exists first so we can return a clear 404
  const notebook = await db.notebook.findUnique({ where: { id } });
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  // 1. Purge S3 files (ignore errors — DB delete should still proceed)
  try {
    await deleteNotebookFiles(id);
  } catch (err) {
    console.error(`[S3] Failed to purge files for notebook ${id}:`, err.message);
  }

  // 2. Delete notebook row; Prisma cascade handles files + messages
  await db.notebook.delete({ where: { id } });

  res.json({ deleted: id });
}));

export default router;