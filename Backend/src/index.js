/**
 * FrameWork Backend
 * Express + LangChain RAG server
 *
 * Architecture:
 *  POST /api/ingest          — upload docs → parse → chunk → embed → store in MemoryVectorStore
 *  POST /api/query           — query → RAG chain → streamed answer
 *  POST /api/flow/run        — execute a saved flow graph node-by-node
 *  GET  /api/store/stats     — vector store stats
 *  DELETE /api/store/:name   — remove a paper
 *
 * Free embedding: HuggingFaceTransformersEmbeddings (runs locally via @xenova/transformers)
 * Falls back to a simple TF-IDF cosine if transformers aren't available.
 *
 * LLM: Anthropic Claude via @langchain/anthropic
 */

import "dotenv/config";
import express from "express";
import cors from "cors";
import multer from "multer";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";

// ── LangChain imports ────────────────────────────────────────────────────────
import { ChatOllama } from "@langchain/community/chat_models/ollama";
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { Document } from "@langchain/core/documents";
import { PromptTemplate, ChatPromptTemplate } from "@langchain/core/prompts";
import { StringOutputParser } from "@langchain/core/output_parsers";
import { RunnableSequence, RunnablePassthrough } from "@langchain/core/runnables";
import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/hf_transformers";

// ── PDF parser ───────────────────────────────────────────────────────────────
import pdfParse from "pdf-parse-debugging-disabled";

// ── Config ───────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;

// ── Embeddings (free, local) ─────────────────────────────────────────────────
// Uses Xenova/all-MiniLM-L6-v2 via @xenova/transformers — no API key needed.
// First call downloads the model (~22 MB) and caches it.
let embeddings;
try {
  embeddings = new HuggingFaceTransformersEmbeddings({
    modelName: "Xenova/all-MiniLM-L6-v2",
  });
  console.log("✓  HuggingFace local embeddings loaded (all-MiniLM-L6-v2)");
} catch (e) {
  console.warn("⚠  HuggingFace embeddings unavailable, using fallback TF-IDF embedder");
  embeddings = makeFallbackEmbedder();
}

// ── LLM ─────────────────────────────────────────────────────────────────────
const llm = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "llama3",
  temperature: 0.7,
});

// ── In-memory state ──────────────────────────────────────────────────────────
// Map of paperName → { chunks, docs }
const paperRegistry = new Map();
let vectorStore = null;   // MemoryVectorStore — rebuilt on each ingest

// ── Text splitter (LangChain) ────────────────────────────────────────────────
const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 600,
  chunkOverlap: 100,
  separators: ["\n\n", "\n", ". ", "! ", "? ", " ", ""],
});

// ── Express setup ────────────────────────────────────────────────────────────
const app = express();
app.use(cors({
  origin: "*",
  methods: ["GET", "POST", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
app.options(/.*/,cors());
app.use(express.json({ limit: "10mb" }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

// ════════════════════════════════════════════════════════════════════════════
// ROUTES
// ════════════════════════════════════════════════════════════════════════════

// ── Health check ─────────────────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    papers: paperRegistry.size,
    chunks: [...paperRegistry.values()].reduce((s, p) => s + p.chunks, 0),
    llmModel: "claude-haiku-4-5",
    embeddingModel: "all-MiniLM-L6-v2 (local)",
  });
});

// ── Ingest documents ─────────────────────────────────────────────────────────
app.post("/api/ingest", upload.array("files"), async (req, res) => {
  const files = req.files;
  if (!files?.length) return res.status(400).json({ error: "No files uploaded" });

  const results = [];

  for (const file of files) {
    try {
      const name = file.originalname;

      // Skip duplicates
      if (paperRegistry.has(name)) {
        results.push({ name, status: "skipped", reason: "already ingested" });
        continue;
      }

      // ── 1. Extract text ──────────────────────────────────────────────────
      let rawText = "";
      const ext = name.toLowerCase();

      if (ext.endsWith(".pdf")) {
        const parsed = await pdfParse(file.buffer);
        rawText = parsed.text;
      } else {
        // txt / md
        rawText = file.buffer.toString("utf-8");
      }

      if (!rawText.trim()) {
        results.push({ name, status: "error", reason: "no text extracted" });
        continue;
      }

      // ── 2. Split into chunks (LangChain RecursiveCharacterTextSplitter) ──
      const docs = await splitter.createDocuments(
        [rawText],
        [{ source: name, paperName: name, ingestedAt: new Date().toISOString() }]
      );

      // ── 3. Add to (or create) MemoryVectorStore ──────────────────────────
      if (!vectorStore) {
        vectorStore = await MemoryVectorStore.fromDocuments(docs, embeddings);
      } else {
        await vectorStore.addDocuments(docs);
      }

      paperRegistry.set(name, {
        name,
        chunks: docs.length,
        size: file.size,
        ingestedAt: new Date().toISOString(),
      });

      results.push({ name, status: "ok", chunks: docs.length, size: file.size });
      console.log(`✓  Ingested "${name}" → ${docs.length} chunks`);
    } catch (err) {
      console.error(`✗  Failed to ingest ${file.originalname}:`, err.message);
      results.push({ name: file.originalname, status: "error", reason: err.message });
    }
  }

  res.json({
    results,
    totalPapers: paperRegistry.size,
    totalChunks: [...paperRegistry.values()].reduce((s, p) => s + p.chunks, 0),
  });
});

// ── Query (RAG chain, streaming) ─────────────────────────────────────────────
app.post("/api/query", async (req, res) => {
  const { question, topK = 6, systemPrompt, userPromptTemplate } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: "question required" });

  // SSE headers for streaming
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    let context = "";
    let sources = [];

    // ── Retrieve ─────────────────────────────────────────────────────────
    if (vectorStore && paperRegistry.size > 0) {
      send({ type: "status", text: "Embedding query…" });
      const results = await vectorStore.similaritySearchWithScore(question, topK);

      send({ type: "status", text: `Retrieved ${results.length} chunks from vector store` });

      sources = [...new Set(results.map(([doc]) => doc.metadata.paperName))];
      context = results
        .map(([doc, score]) =>
          `[Source: ${doc.metadata.paperName} | relevance: ${(score * 100).toFixed(0)}%]\n${doc.pageContent}`
        )
        .join("\n\n---\n\n");

      send({ type: "sources", sources });
    } else {
      send({ type: "status", text: "No documents uploaded — answering from general knowledge" });
    }

    // ── Build LangChain RAG chain ─────────────────────────────────────────
    send({ type: "status", text: "Running LangChain RAG chain…" });

    const sysMsg = systemPrompt ||
      (context
        ? "You are a precise research assistant. Answer ONLY using the provided context. Always cite the paper name in brackets when referencing specific information. If the context doesn't contain enough information, say so clearly."
        : "You are a helpful research assistant. No documents have been uploaded yet, so answer from general knowledge.");

    const userTemplate = userPromptTemplate ||
      (context
        ? "Context:\n{context}\n\nQuestion: {question}"
        : "{question}");

    const prompt = ChatPromptTemplate.fromMessages([
      ["system", sysMsg],
      ["human", userTemplate],
    ]);

    const chain = RunnableSequence.from([
      RunnablePassthrough.assign({ context: () => context }),
      prompt,
      llm,
      new StringOutputParser(),
    ]);

    // ── Stream the answer ─────────────────────────────────────────────────
    send({ type: "status", text: "Generating answer…" });

    const stream = await chain.stream({ question, context });
    let fullText = "";

    for await (const chunk of stream) {
      fullText += chunk;
      send({ type: "token", token: chunk });
    }

    send({ type: "done", sources, fullText });
    res.end();
  } catch (err) {
    console.error("Query error:", err.message);
    send({ type: "error", error: err.message });
    res.end();
  }
});

// ── Flow run ─────────────────────────────────────────────────────────────────
// Executes a saved flow graph: walks edges in topological order,
// passes output of each node as input to the next.
app.post("/api/flow/run", async (req, res) => {
  const { nodes, edges } = req.body;
  if (!nodes?.length) return res.status(400).json({ error: "nodes required" });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // ── Topological sort ────────────────────────────────────────────────
    const order = topoSort(nodes, edges);
    send({ type: "status", text: `Running ${order.length} nodes in order…` });

    const nodeOutputs = {};   // nodeId → string output

    for (const node of order) {
      send({ type: "node_start", nodeId: node.id, label: node.label || node.type });

      if (node.type === "llm") {
        // Gather all upstream inputs
        const upstream = (edges || [])
          .filter(e => e.to === node.id)
          .map(e => nodeOutputs[e.from])
          .filter(Boolean)
          .join("\n\n");

        const fields = node.fields || [];
        const modelField = fields.find(f => f.type === "select" && f.options?.some(o => o.includes("claude")));
        const sysField   = fields.find(f => f.type === "textarea" && f.placeholder?.toLowerCase().includes("system"));
        const userField  = fields.find(f => f.type === "textarea" && f.placeholder?.toLowerCase().includes("user"));
        const tempField  = fields.find(f => f.type === "slider");

        const systemMsg = sysField?.value || "You are a helpful assistant.";
        const userMsg   = userField?.value
          ? `${userField.value}\n\n${upstream ? `Context:\n${upstream}` : ""}`
          : upstream || "Hello";

        const nodeLlm = new ChatOllama({
          baseUrl: "http://localhost:11434",
          model: "llama3",
          temperature: tempField?.value ?? 0.7,
        });

        const nodePrompt = ChatPromptTemplate.fromMessages([
          ["system", systemMsg],
          ["human", userMsg],
        ]);

        const chain = RunnableSequence.from([nodePrompt, nodeLlm, new StringOutputParser()]);
        const stream = await chain.stream({});

        let output = "";
        for await (const chunk of stream) {
          output += chunk;
          send({ type: "node_token", nodeId: node.id, token: chunk });
        }
        nodeOutputs[node.id] = output;
        send({ type: "node_done", nodeId: node.id, output });

      } else if (node.type === "rag") {
        // RAG retrieval node — retrieve from current vector store
        const upstream = (edges || [])
          .filter(e => e.to === node.id)
          .map(e => nodeOutputs[e.from])
          .filter(Boolean)
          .join(" ");

        const topKField = (node.fields || []).find(f => f.label?.includes("Top-K"));
        const topK = topKField?.value || 5;

        let output = "No documents in vector store.";
        if (vectorStore) {
          const results = await vectorStore.similaritySearch(upstream || "summary", topK);
          output = results
            .map(d => `[${d.metadata.paperName}]\n${d.pageContent}`)
            .join("\n\n---\n\n");
        }
        nodeOutputs[node.id] = output;
        send({ type: "node_done", nodeId: node.id, output: `Retrieved ${output.split("---").length} chunks` });

      } else if (node.type === "transform") {
        const upstream = (edges || [])
          .filter(e => e.to === node.id)
          .map(e => nodeOutputs[e.from])
          .filter(Boolean)
          .join("\n\n");

        const modeField = (node.fields || []).find(f => f.type === "select");
        const mode = modeField?.value || "Chunk";

        let output = upstream;
        if (mode === "Summarize" && upstream) {
          const chain = RunnableSequence.from([
            ChatPromptTemplate.fromMessages([
              ["system", "Summarize the following text concisely."],
              ["human", "{text}"],
            ]),
            llm,
            new StringOutputParser(),
          ]);
          output = await chain.invoke({ text: upstream });
        } else if (mode === "Chunk") {
          const docs = await splitter.createDocuments([upstream]);
          output = docs.map((d, i) => `[Chunk ${i+1}]\n${d.pageContent}`).join("\n\n");
        } else if (mode === "JSON → Text") {
          try { output = JSON.stringify(JSON.parse(upstream), null, 2); } catch { output = upstream; }
        }
        nodeOutputs[node.id] = output;
        send({ type: "node_done", nodeId: node.id, output: `Transform (${mode}) complete` });

      } else {
        // github / web / output — pass through with a status note
        const upstream = (edges || [])
          .filter(e => e.to === node.id)
          .map(e => nodeOutputs[e.from])
          .filter(Boolean)
          .join("\n\n");

        nodeOutputs[node.id] = upstream || `[${node.type} node output]`;
        send({ type: "node_done", nodeId: node.id, output: nodeOutputs[node.id].slice(0, 120) });
        await sleep(200); // small delay for UX
      }
    }

    // Final output = last node's output
    const lastNode = order[order.length - 1];
    const finalOutput = nodeOutputs[lastNode?.id] || "";
    send({ type: "flow_done", output: finalOutput });
    res.end();

  } catch (err) {
    console.error("Flow run error:", err.message);
    send({ type: "error", error: err.message });
    res.end();
  }
});

// ── Vector store stats ────────────────────────────────────────────────────────
app.get("/api/store/stats", (_req, res) => {
  const papers = [...paperRegistry.values()];
  res.json({
    papers,
    totalChunks: papers.reduce((s, p) => s + p.chunks, 0),
    vectorStoreReady: !!vectorStore,
  });
});

// ── Delete paper ──────────────────────────────────────────────────────────────
app.delete("/api/store/:name", async (req, res) => {
  const name = decodeURIComponent(req.params.name);
  if (!paperRegistry.has(name)) return res.status(404).json({ error: "not found" });

  paperRegistry.delete(name);

  // Rebuild vector store without this paper's docs
  if (paperRegistry.size === 0) {
    vectorStore = null;
  } else {
    // Filter out docs from this paper and rebuild
    // (MemoryVectorStore doesn't support delete, so we rebuild)
    const allDocs = [];
    for (const [pName] of paperRegistry) {
      // We'd need to re-ingest — for now just mark as deleted and note it
    }
    // Simple approach: invalidate store so next ingest rebuilds
    vectorStore = null;
    res.json({ ok: true, note: "Vector store cleared — please re-upload remaining papers to rebuild index" });
    return;
  }

  res.json({ ok: true });
});

// ── List saved prompts (server-side store) ───────────────────────────────────
const promptLibrary = new Map();

app.get("/api/prompts", (_req, res) => {
  res.json([...promptLibrary.values()]);
});

app.post("/api/prompts", (req, res) => {
  const { name, system, user } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: "name required" });
  const id = randomUUID();
  const entry = { id, name, system, user, createdAt: new Date().toISOString() };
  promptLibrary.set(id, entry);
  res.json(entry);
});

app.delete("/api/prompts/:id", (req, res) => {
  if (!promptLibrary.delete(req.params.id)) return res.status(404).json({ error: "not found" });
  res.json({ ok: true });
});

// ════════════════════════════════════════════════════════════════════════════
// HELPERS
// ════════════════════════════════════════════════════════════════════════════

function topoSort(nodes, edges) {
  const adj = new Map(nodes.map(n => [n.id, []]));
  const inDeg = new Map(nodes.map(n => [n.id, 0]));

  for (const e of (edges || [])) {
    if (adj.has(e.from) && adj.has(e.to)) {
      adj.get(e.from).push(e.to);
      inDeg.set(e.to, (inDeg.get(e.to) || 0) + 1);
    }
  }

  const queue = nodes.filter(n => (inDeg.get(n.id) || 0) === 0);
  const result = [];

  while (queue.length) {
    const node = queue.shift();
    result.push(node);
    for (const nextId of (adj.get(node.id) || [])) {
      const deg = inDeg.get(nextId) - 1;
      inDeg.set(nextId, deg);
      if (deg === 0) queue.push(nodes.find(n => n.id === nextId));
    }
  }

  return result.filter(Boolean);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function makeFallbackEmbedder() {
  // Simple character-frequency TF-IDF as emergency fallback
  return {
    embedDocuments: async (texts) => texts.map(naiveTFIDF),
    embedQuery: async (text) => naiveTFIDF(text),
  };
}
function naiveTFIDF(text) {
  const vec = new Array(128).fill(0);
  const t = text.toLowerCase();
  for (let i = 0; i < t.length; i++) vec[t.charCodeAt(i) % 128] += 1;
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) + 1e-9;
  return vec.map(v => v / norm);
}

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀  FrameWork backend running on http://localhost:${PORT}`);
  console.log(`   LLM      : claude-haiku-4-5 (Anthropic)`);
  console.log(`   Embedder : all-MiniLM-L6-v2 (local, free)`);
  console.log(`   RAG      : LangChain MemoryVectorStore\n`);
});