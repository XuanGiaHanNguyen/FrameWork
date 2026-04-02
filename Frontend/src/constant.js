import { Brain, AlignLeft, Layers, HelpCircle, BookOpen, Database, FileText, Globe, SlidersHorizontal } from "lucide-react";

// ─── BACKEND ──────────────────────────────────────────────────────────────────
export const API = "http://localhost:3001/api";

// ─── PRESET RAG QUESTIONS ─────────────────────────────────────────────────────
export const PRESETS = [
  { Icon: AlignLeft,  label: "Summarize all",   prompt: "Summarize each uploaded paper in 2–3 sentences. Do not repeat summaries." },
  { Icon: Layers,     label: "Compare methods", prompt: "What are the main methodological differences between these papers?" },
  { Icon: HelpCircle, label: "Limitations",     prompt: "What limitations are mentioned across the papers?" },
  { Icon: BookOpen,   label: "Common themes",   prompt: "What themes or topics recur across all the papers?" },
];

// ─── NODE META ────────────────────────────────────────────────────────────────
export const NODE_META = {
  github:    { label: "GitHub Repo",    Icon: Brain },
  llm:       { label: "LLM",           Icon: Brain },
  rag:       { label: "RAG Retriever", Icon: Database },
  output:    { label: "Output",        Icon: FileText },
  web:       { label: "Web Scraper",   Icon: Globe },
  transform: { label: "Transform",     Icon: SlidersHorizontal },
};

export const NODE_WIDTH = 220;

// ─── DEFAULT NODE FIELDS BY TYPE ──────────────────────────────────────────────
export const DEFAULT_NODE_FIELDS = {
  github:    [
    { type: "text",   placeholder: "Enter GitHub URL", value: "" },
    { type: "tags",   value: ["README"] },
  ],
  llm:       [
    { type: "select", value: "claude-haiku-4-5", options: ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"] },
    { type: "textarea", placeholder: "System prompt…", value: "" },
    { type: "textarea", placeholder: "User prompt…",   value: "" },
    { type: "slider", label: "Temp:", min: 0, max: 1, step: 0.1, value: 0.7 },
  ],
  rag:       [
    { type: "select", value: "cosine", options: ["cosine", "dot_product", "euclidean"] },
    { type: "slider", label: "Top-K:", min: 1, max: 20, step: 1, value: 5 },
  ],
  output:    [{ type: "select", value: "Markdown", options: ["README.md", "JSON", "Markdown", "HTML"] }],
  web:       [{ type: "text", placeholder: "Enter URL…", value: "" }],
  transform: [{ type: "select", value: "Chunk", options: ["Chunk", "Embed", "Summarize", "JSON → Text"] }],
};

// ─── INITIAL FLOW NODES ───────────────────────────────────────────────────────
export const INITIAL_NODES = [
  {
    id: "1", type: "github", x: 60, y: 160, label: "GitHub Repo",
    fields: [
      { type: "text",  placeholder: "Enter GitHub URL", value: "" },
      { type: "tags",  value: ["README", "Structure", "Files"] },
    ],
  },
  {
    id: "2", type: "llm", x: 340, y: 140, label: "Generate README",
    fields: [
      { type: "select",   value: "claude-haiku-4-5", options: ["claude-haiku-4-5", "claude-sonnet-4-5", "claude-opus-4-5"] },
      { type: "textarea", placeholder: "System prompt…", value: "You are a technical documentation expert." },
      { type: "textarea", placeholder: "User prompt…",   value: "Based on the repo context, generate a comprehensive README.md with Overview, Features, Installation, Usage sections." },
      { type: "slider",   label: "Temp:", min: 0, max: 1, step: 0.1, value: 0.7 },
    ],
  },
  {
    id: "3", type: "output", x: 640, y: 160, label: "README Output",
    fields: [
      { type: "select", value: "README.md", options: ["README.md", "JSON", "Markdown", "HTML"] },
      { type: "tags",   value: ["Output: readme.md"] },
    ],
  },
];

export const INITIAL_EDGES = [
  { id: "e1", from: "1", to: "2" },
  { id: "e2", from: "2", to: "3" },
];

// ─── DEFAULT SAVED PROMPTS ────────────────────────────────────────────────────
export const DEFAULT_SAVED_PROMPTS = [
  { id: "sp1", name: "README Generator",    system: "You are a technical documentation expert.", user: "Based on the repo context, generate a comprehensive README.md with Overview, Features, Installation, Usage sections." },
  { id: "sp2", name: "Code Reviewer",       system: "You are a senior software engineer.",       user: "Review the provided code and give specific, actionable feedback on improvements." },
  { id: "sp3", name: "Research Summarizer", system: "You are a research analyst.",               user: "Summarize the key findings, methodology, and implications of the provided research." },
];

// ─── DEFAULT NOTEBOOKS ────────────────────────────────────────────────────────
export const DEFAULT_NOTEBOOKS = [
  {
    id: "nb1",
    name: "Literature Review",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    papers: [],
    messages: [{ role: "assistant", content: "Welcome to **Literature Review**. Upload your papers and I'll help you analyze them." }],
  },
  {
    id: "nb2",
    name: "Research Notes",
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    papers: [],
    messages: [{ role: "assistant", content: "Welcome to **Research Notes**. Upload your sources and start asking questions." }],
  },
];