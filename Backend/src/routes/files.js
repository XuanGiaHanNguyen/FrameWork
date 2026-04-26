// backend/src/routes/files.js
// ─── FILE ROUTES ──────────────────────────────────────────────────────────────
//
//  POST   /api/notebooks/:id/files          → upload one or more files to S3 + ingest
//  GET    /api/notebooks/:id/files          → list files in a notebook
//  GET    /api/notebooks/:id/files/:fileId/url  → get presigned download URL
//  DELETE /api/notebooks/:id/files/:fileId  → delete file from S3 + DB
//
import { Router } from "express";
import db                            from "../lib/db.js";
import { uploadFile, deleteFile, presignedGetUrl } from "../lib/s3.js";
import { upload, asyncHandler, mimeFromName }      from "../lib/helpers.js";
import { ingestBuffer, generateDocTitle  }              from "../lib/ingest.js";

const router = Router({ mergeParams: true }); // gives access to :id from parent


// ── POST /api/notebooks/:id/files ─────────────────────────────────────────────
// Accepts multipart/form-data with field name "files" (multiple allowed).
// For each file:
//   1. Upload raw bytes to S3
//   2. Ingest into vector store (chunk + embed)
//   3. Save metadata row in DB
router.post("/", upload.array("files", 20), asyncHandler(async (req, res) => {
  const { id: notebookId } = req.params;

  const notebook = await db.notebook.findUnique({ where: { id: notebookId } });
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  if (!req.files?.length) return res.status(400).json({ error: "No files received" });

  const results = await Promise.all(req.files.map(async (file) => {
    const filename = file.originalname;
    const mimeType = file.mimetype || mimeFromName(filename);

    try {
      // 1. Upload to S3
      const s3Key = await uploadFile({
        notebookId,
        filename,
        buffer:   file.buffer,
        mimeType,
      });

      // 2. Ingest into vector store; returns chunk count
      const chunks = await ingestBuffer({
        buffer:     file.buffer,
        filename,
        mimeType,
        notebookId,
      });

      // 3. Generate auto-title using summarizer model (non-blocking)
      const extractedText = file.buffer.toString("utf-8").split(" ").slice(0, 300).join(" ");
      const autoTitle = await generateDocTitle(extractedText).catch(() => null);

      // 4. Upsert DB record (re-upload of same filename updates it)
      const dbFile = await db.notebookFile.upsert({
        where:  { notebookId_name: { notebookId, name: filename } },
        update: { s3Key, sizeBytes: file.size, mimeType, chunks, autoTitle },
        create: { notebookId, name: filename, s3Key, sizeBytes: file.size, mimeType, chunks, autoTitle },
      });

      return { status: "ok", id: dbFile.id, name: filename, chunks, size: file.size, autoTitle };

    } catch (err) {
      console.error(`[ingest] ${filename}:`, err.message);
      return { status: "error", name: filename, reason: err.message };
    }
  }));

  res.json({ results });
}));

// ── GET /api/notebooks/:id/files ──────────────────────────────────────────────
router.get("/", asyncHandler(async (req, res) => {
  const files = await db.notebookFile.findMany({
    where:   { notebookId: req.params.id },
    orderBy: { createdAt: "asc" },
  });

  res.json(files.map(f => ({
    id:        f.id,
    name:      f.name,
    size:      f.sizeBytes,
    mimeType:  f.mimeType,
    chunks:    f.chunks,
    createdAt: f.createdAt,
  })));
}));

// ── GET /api/notebooks/:id/files/:fileId/url ──────────────────────────────────
// Returns a short-lived presigned S3 URL so the frontend can download the file.
router.get("/:fileId/url", asyncHandler(async (req, res) => {
  const file = await db.notebookFile.findFirst({
    where: { id: req.params.fileId, notebookId: req.params.id },
  });
  if (!file) return res.status(404).json({ error: "File not found" });

  const url = await presignedGetUrl(file.s3Key);
  res.json({ url, name: file.name, expiresIn: 3600 });
}));

// ── DELETE /api/notebooks/:id/files/:fileId ───────────────────────────────────
// Removes from S3 and from DB.
router.delete("/:fileId", asyncHandler(async (req, res) => {
  const file = await db.notebookFile.findFirst({
    where: { id: req.params.fileId, notebookId: req.params.id },
  });
  if (!file) return res.status(404).json({ error: "File not found" });

  // 1. Delete from S3
  try { await deleteFile(file.s3Key); } catch (err) {
    console.error(`[S3] delete failed for ${file.s3Key}:`, err.message);
  }

  // 2. Delete DB row
  await db.notebookFile.delete({ where: { id: file.id } });

  res.json({ deleted: file.id, name: file.name });
}));

export default router;