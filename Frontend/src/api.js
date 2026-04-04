// src/api.js
// ─── FRONTEND API CLIENT ──────────────────────────────────────────────────────
// All fetch() calls live here. Components import these functions instead of
// constructing URLs directly. Makes it trivial to swap the base URL or add
// auth headers later.

export const BASE = "http://localhost:3001/api";

// ─── NOTEBOOKS ────────────────────────────────────────────────────────────────

/** Create a new empty notebook (folder). */
export async function createNotebook(name) {
  const r = await fetch(`${BASE}/notebooks`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json(); // { id, name, createdAt, updatedAt }
}

/** List all notebooks with file/message counts. */
export async function listNotebooks() {
  const r = await fetch(`${BASE}/notebooks`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json(); // array of { id, name, createdAt, papers[], fileCount, msgCount }
}

/** Get a single notebook including all files and last 200 messages. */
export async function getNotebook(id) {
  const r = await fetch(`${BASE}/notebooks/${id}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

/** Rename a notebook. */
export async function renameNotebook(id, name) {
  const r = await fetch(`${BASE}/notebooks/${id}`, {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ name }),
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

/**
 * Delete a notebook.
 * Cascades: deletes all S3 files, all DB file rows, all chat messages.
 */
export async function deleteNotebook(id) {
  const r = await fetch(`${BASE}/notebooks/${id}`, { method: "DELETE" });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json(); // { deleted: id }
}

// ─── FILES ────────────────────────────────────────────────────────────────────

/**
 * Upload one or more files into a notebook.
 * @param {string}   notebookId
 * @param {File[]}   files  — array of browser File objects
 * @returns {{ results: Array<{status, name, chunks, size}> }}
 */
export async function uploadFiles(notebookId, files) {
  const form = new FormData();
  for (const f of files) form.append("files", f);

  const r = await fetch(`${BASE}/notebooks/${notebookId}/files`, {
    method: "POST",
    body:   form,
    // Do NOT set Content-Type — browser sets it with the correct boundary
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json(); // { results: [...] }
}

/** List files in a notebook. */
export async function listFiles(notebookId) {
  const r = await fetch(`${BASE}/notebooks/${notebookId}/files`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

/** Get a presigned S3 download URL for a file. */
export async function getFileDownloadUrl(notebookId, fileId) {
  const r = await fetch(`${BASE}/notebooks/${notebookId}/files/${fileId}/url`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json(); // { url, name, expiresIn }
}

/** Delete a file from S3 and the database. */
export async function deleteFile(notebookId, fileId) {
  const r = await fetch(`${BASE}/notebooks/${notebookId}/files/${fileId}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json(); // { deleted: fileId, name }
}

// ─── CHAT HISTORY ─────────────────────────────────────────────────────────────

/**
 * Fetch chat history for a notebook.
 * @param {string}  notebookId
 * @param {object}  opts
 * @param {number}  opts.limit   max messages to return (default 100)
 * @param {string}  opts.before  ISO date string for pagination cursor
 */
export async function listMessages(notebookId, { limit = 100, before } = {}) {
  const params = new URLSearchParams({ limit });
  if (before) params.set("before", before);

  const r = await fetch(`${BASE}/notebooks/${notebookId}/messages?${params}`);
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

/** Clear all chat messages in a notebook (keeps files). */
export async function clearMessages(notebookId) {
  const r = await fetch(`${BASE}/notebooks/${notebookId}/messages`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json(); // { deleted: count }
}

/** Delete a single chat message. */
export async function deleteMessage(notebookId, msgId) {
  const r = await fetch(`${BASE}/notebooks/${notebookId}/messages/${msgId}`, {
    method: "DELETE",
  });
  if (!r.ok) throw new Error((await r.json()).error);
  return r.json();
}

// ─── RAG QUERY (SSE) ──────────────────────────────────────────────────────────

/**
 * Send a question to the RAG pipeline. Returns the raw Response so the caller
 * can pipe it through readSSE() from utils.js.
 *
 * Usage:
 *   const resp = await queryNotebook(notebookId, question);
 *   for await (const event of readSSE(resp)) { ... }
 *
 * SSE event types:
 *   { type: "status",  text: string }
 *   { type: "sources", sources: string[] }
 *   { type: "token",   token: string }
 *   { type: "done",    fullText: string }
 *   { type: "error",   error: string }
 */
export async function queryNotebook(notebookId, question, topK = 6) {
  const r = await fetch(`${BASE}/notebooks/${notebookId}/query`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ question, topK }),
  });
  if (!r.ok) throw new Error(`Query failed: ${r.status}`);
  return r; // raw Response — caller reads the SSE stream
}

// ─── HEALTH ───────────────────────────────────────────────────────────────────

export async function checkHealth() {
  const r = await fetch(`${BASE}/health`, {
    signal: AbortSignal.timeout(3000),
  });
  return r.ok;
}