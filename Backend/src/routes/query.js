import { Router } from "express";
import db from "../lib/db.js";
import { openSSE, asyncHandler } from "../lib/helpers.js";
import { retrieveChunks } from "../lib/ingest.js";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const router = Router({ mergeParams: true });

// ── System prompts ────────────────────────────────────────────────────────────
const RAG_SYSTEM_PROMPT =
  "You are a research assistant specialized in academic papers. " +
  "Answer questions based strictly on the provided context. " +
  "If the answer is not in the context, say so clearly. " +
  "Use precise, academic language.";

const SUMMARY_SYSTEM =
  "You are a research assistant that writes concise academic summaries. " +
  "Write exactly 2-3 sentences. State the main finding, mention the method, end cleanly. " +
  "Do not ask questions. Do not repeat yourself. Stop after the summary.";

// ── Output cleaners ───────────────────────────────────────────────────────────
function cleanSummaryOutput(text) {
  const cutPatterns = [
    /INPUT\s*:/i,
    /OUTPUT\s*:/i,
    /\{text\}/i,
    /\{Text\}/i,
    /Given an? .{0,40} and its corresponding/i,
    /Please write your complete response/i,
    /answer this question/i,
  ];

  let result = text;
  for (const pattern of cutPatterns) {
    const match = result.search(pattern);
    if (match !== -1) {
      result = result.slice(0, match).trim();
    }
  }

  // Trim to 3 sentences max
  const sentences = result.split(/(?<=[.!?])\s+/);
  return sentences.slice(0, 3).join(" ").trim();
}

function trimRepetition(text) {
  const sentences = text.split(/(?<=[.!?])\s+/);
  const seen = new Set();
  const result = [];
  for (const s of sentences) {
    const key = s.trim().slice(0, 60).toLowerCase();
    if (seen.has(key)) break;
    seen.add(key);
    result.push(s);
  }
  return result.join(" ").trim();
}

// ── Models ────────────────────────────────────────────────────────────────────
const ragLLM = new ChatOllama({
  model: process.env.OLLAMA_MODEL || "llama32-research",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0.0,
  stop: ["Question:", "Answer:", "Human:", "User:", "\n\nContext:", "[1]"],
  numPredict: 512,
});

const summaryLLM = new ChatOllama({
  model: process.env.SUMMARY_MODEL || "llama32-summarizer",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0.1,
  numPredict: 150,
});

function isSummaryQuery(question) {
  return /summarize|summary|summarise|overview|brief|what is this paper|what does this paper/i.test(question);
}

// ── POST /api/notebooks/:id/query ─────────────────────────────────────────────
router.post(
  "/",
  asyncHandler(async (req, res) => {
    const notebookId = req.params.id;
    const { question, topK = 6 } = req.body;

    if (!question?.trim())
      return res.status(400).json({ error: "question is required" });

    const notebook = await db.notebook.findUnique({
      where: { id: notebookId },
    });
    if (!notebook) return res.status(404).json({ error: "Notebook not found" });

    const send = openSSE(res);

    try {
      send({ type: "status", text: "Searching knowledge base..." });

      const { chunks, sources = [] } = await retrieveChunks({
        notebookId,
        question,
        topK,
      });

      if (chunks.length === 0) {
        send({ type: "status", text: "No relevant chunks found - answering from general knowledge." });
      } else {
        send({ type: "sources", sources });
      }

      const context = chunks.map((c, i) => `[${i + 1}] ${c.pageContent}`).join("\n\n");

      const userContent =
        chunks.length > 0
          ? `Context from uploaded documents:\n\n${context}\n\n---\n\nQuestion: ${question}`
          : question;

      // FIX: RAG_SYSTEM_PROMPT was undefined before
      const useSummary = isSummaryQuery(question);
      const llm          = useSummary ? summaryLLM    : ragLLM;
      const systemPrompt = useSummary ? SUMMARY_SYSTEM : RAG_SYSTEM_PROMPT;

      const messages = [
        new SystemMessage(systemPrompt),
        new HumanMessage(userContent),
      ];

      send({ type: "status", text: "Generating answer..." });
      let fullText = "";

      try {
        const stream = await llm.stream(messages);
        for await (const chunk of stream) {
          const token = typeof chunk === "string" ? chunk : (chunk.content ?? "");
          fullText += token;
          send({ type: "token", token });
        }
      } catch (modelErr) {
        console.error("[query] model error, falling back to ragLLM:", modelErr.message);
        // fallback to RAG model
        const fallbackStream = await ragLLM.stream(messages);
        for await (const chunk of fallbackStream) {
          const token = typeof chunk === "string" ? chunk : (chunk.content ?? "");
          fullText += token;
          send({ type: "token", token });
        }
      }

      const stream = await llm.stream(messages);

      for await (const chunk of stream) {
        const token = typeof chunk === "string" ? chunk : (chunk.content ?? "");
        fullText += token;
        send({ type: "token", token });
      }

      // FIX: apply both cleaners, use finalText everywhere (was sending trimmed but saving fullText)
      const finalText = useSummary
        ? cleanSummaryOutput(trimRepetition(fullText))
        : trimRepetition(fullText);

      send({ type: "done", fullText: finalText });

      db.chatMessage
        .createMany({
          data: [
            { notebookId, role: "user",      content: question,   sources: "" },
            { notebookId, role: "assistant", content: finalText,  sources: sources.join(",") },
          ],
        })
        .catch((err) => console.error("[DB] Failed to persist messages:", err.message));

    } catch (err) {
      console.error("[query]", err);
      send({ type: "error", error: err.message });
    }

    res.end();
  }),
);

export default router;