// backend/src/lib/ingest.js
// ─── INGEST & RETRIEVAL ───────────────────────────────────────────────────────
// Parses uploaded file buffers, chunks them, embeds with HuggingFace
// (all-MiniLM-L6-v2 — free, runs locally), and stores in an in-memory
// MemoryVectorStore namespaced by notebookId.
//
// NOTE: The vector store is in-process memory. On server restart embeddings are
// lost and must be re-ingested. For production, swap MemoryVectorStore for
// PGVector (pgvector Postgres extension) or Pinecone.

import { RecursiveCharacterTextSplitter }         from "langchain/text_splitter";
import { MemoryVectorStore }                      from "langchain/vectorstores/memory";
import { HuggingFaceTransformersEmbeddings }      from "@langchain/community/embeddings/huggingface_transformers";
import { Document }                               from "langchain/document";
import pdfParse                                   from "pdf-parse/lib/pdf-parse.js";

// ── Singleton embeddings model ─────────────────────────────────────────────────
const embeddings = new HuggingFaceTransformersEmbeddings({
  modelName: "Xenova/all-MiniLM-L6-v2",
});

// ── Per-notebook vector stores ─────────────────────────────────────────────────
// Map<notebookId, MemoryVectorStore>
const stores = new Map();

async function getOrCreateStore(notebookId) {
  if (!stores.has(notebookId)) {
    stores.set(notebookId, new MemoryVectorStore(embeddings));
  }
  return stores.get(notebookId);
}

// ── Text extraction ────────────────────────────────────────────────────────────
async function extractText(buffer, mimeType, filename) {
  const ext = filename.split(".").pop().toLowerCase();

  if (mimeType === "application/pdf" || ext === "pdf") {
    const parsed = await pdfParse(buffer);
    return parsed.text;
  }

  // .txt and .md
  return buffer.toString("utf-8");
}

// ── Ingest a buffer into the notebook's vector store ──────────────────────────
// Returns the number of chunks created.
export async function ingestBuffer({ buffer, filename, mimeType, notebookId }) {
  const text = await extractText(buffer, mimeType, filename);

  if (!text?.trim()) throw new Error("Could not extract any text from the file");

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize:    1000,
    chunkOverlap: 150,
  });

  const docs = await splitter.createDocuments(
    [text],
    [{ source: filename, notebookId }],
  );

  const store = await getOrCreateStore(notebookId);

  // Remove old chunks for this filename before re-adding (handles re-uploads)
  // MemoryVectorStore doesn't support delete by metadata, so we rebuild the store
  // from all existing docs minus those from this filename, then add the new ones.
  const existing = store.memoryVectors || [];
  const kept = existing.filter(v => v.metadata?.source !== filename);

  // Rebuild store with kept docs
  const rebuiltStore = new MemoryVectorStore(embeddings);
  if (kept.length > 0) {
    // Re-add kept vectors directly (avoid re-embedding)
    rebuiltStore.memoryVectors = kept;
  }

  // Add new docs
  await rebuiltStore.addDocuments(docs);
  stores.set(notebookId, rebuiltStore);

  return docs.length;
}

// ── Retrieve top-K relevant chunks ────────────────────────────────────────────
// Returns { chunks: Document[], sources: string[] }
export async function retrieveChunks({ notebookId, question, topK = 6 }) {
  const store = stores.get(notebookId);

  if (!store) return { chunks: [], sources: [] };

  const results = await store.similaritySearch(question, topK);

  const sources = [...new Set(results.map(r => r.metadata?.source).filter(Boolean))];

  return { chunks: results, sources };
}

// ── Drop all vectors for a notebook (called on file delete) ───────────────────
export function dropNotebookStore(notebookId) {
  stores.delete(notebookId);
}

// ── Drop vectors for a specific file within a notebook ────────────────────────
export function dropFileVectors(notebookId, filename) {
  const store = stores.get(notebookId);
  if (!store) return;

  const kept = (store.memoryVectors || []).filter(
    v => v.metadata?.source !== filename,
  );
  store.memoryVectors = kept;
}