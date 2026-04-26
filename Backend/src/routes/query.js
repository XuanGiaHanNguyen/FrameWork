import { Router } from "express";
import db from "../lib/db.js";
import { openSSE, asyncHandler } from "../lib/helpers.js";
import { retrieveChunks } from "../lib/ingest.js";
import { ChatOllama } from "@langchain/ollama";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

const router = Router({ mergeParams: true });


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

const SYSTEM_PROMPT =
  "You are a research assistant specialized in academic papers. " +
  "Answer questions based strictly on the provided context. " +
  "If the answer is not in the context, say so clearly. " +
  "Use precise, academic language.";

const llm = new ChatOllama({
  model: process.env.OLLAMA_MODEL || "llama32-research",
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  temperature: 0.0,
  stop: ["Question:", "Answer:", "Human:", "User:", "\n\nContext:", "[1]"],
  numPredict: 512,
});

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

      const messages = [
        new SystemMessage(SYSTEM_PROMPT),
        new HumanMessage(userContent),
      ];

      send({ type: "status", text: "Generating answer..." });
      let fullText = "";

      const stream = await llm.stream(messages);

      for await (const chunk of stream) {
        const token = typeof chunk === "string" ? chunk : (chunk.content ?? "");
        fullText += token;
        send({ type: "token", token });
      }

      const trimmed = trimRepetition(fullText);
      send({ type: "done", fullText: trimmed });

      db.chatMessage
        .createMany({
          data: [
            { notebookId, role: "user", content: question, sources: "" },
            { notebookId, role: "assistant", content: fullText, sources: sources.join(",") },
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
