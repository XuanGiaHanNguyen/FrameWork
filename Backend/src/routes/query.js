// backend/src/routes/query.js
// ─── RAG QUERY ROUTE ──────────────────────────────────────────────────────────
//
//  POST /api/notebooks/:id/query  (SSE stream)
//
// Flow:
//   1. Validate notebook exists
//   2. Retrieve top-K chunks from vector store for this notebook
//   3. Stream LLM answer token-by-token via SSE
//   4. Persist both the user question and assistant answer to chat_messages
//
import { Router }                from "express";
import db                        from "../lib/db.js";
import { openSSE, asyncHandler } from "../lib/helpers.js";
import { retrieveChunks }        from "../lib/ingest.js";
import { Ollama }                from "@langchain/ollama";

const router = Router({ mergeParams: true });

const llm = new Ollama({
  model:       process.env.OLLAMA_MODEL || "llama3.2",
  baseUrl:     process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0.2,
});

// ── POST /api/notebooks/:id/query ─────────────────────────────────────────────
// Body: { question: string, topK?: number }
router.post("/", asyncHandler(async (req, res) => {
  const notebookId = req.params.id;
  const { question, topK = 6 } = req.body;

  if (!question?.trim()) return res.status(400).json({ error: "question is required" });

  const notebook = await db.notebook.findUnique({ where: { id: notebookId } });
  if (!notebook) return res.status(404).json({ error: "Notebook not found" });

  const send = openSSE(res);

  try {
    // 1. Retrieve relevant chunks from the in-memory vector store
    send({ type: "status", text: "Searching knowledge base…" });
    const { chunks, sources } = await retrieveChunks({ notebookId, question, topK });

    if (chunks.length === 0) {
      send({ type: "status", text: "No relevant chunks found — answering from general knowledge." });
    } else {
      send({ type: "sources", sources });
    }

    // 2. Build prompt
    const context = chunks.map((c, i) => `[${i + 1}] ${c.pageContent}`).join("\n\n");

    const prompt = chunks.length > 0
      ? [
          "You are a helpful research assistant. Answer questions based on the provided document excerpts.",
          "Cite the source document names when relevant. If the context does not contain the answer, say so clearly.",
          "",
          "Context from uploaded documents:",
          "",
          context,
          "",
          "---",
          "",
          `Question: ${question}`,
        ].join("\n")
      : question;

    // 3. Stream LLM response token-by-token
    send({ type: "status", text: "Generating answer…" });
    let fullText = "";

    const stream = await llm.stream(prompt);

    for await (const chunk of stream) {
      const token = typeof chunk === "string" ? chunk : (chunk.content ?? "");
      fullText += token;
      send({ type: "token", token });
    }

    send({ type: "done", fullText });

    // 4. Persist both turns to DB (fire-and-forget)
    db.chatMessage.createMany({
      data: [
        { notebookId, role: "user",      content: question, sources: [] },
        { notebookId, role: "assistant", content: fullText,  sources },
      ],
    }).catch(err => console.error("[DB] Failed to persist messages:", err.message));

  } catch (err) {
    console.error("[query]", err);
    send({ type: "error", error: err.message });
  }

  res.end();
}));

export default router;