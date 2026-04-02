import { AlertCircle, CheckCircle2, Loader2, Terminal, X } from "lucide-react";

// ─── SERVER STATUS BADGE ──────────────────────────────────────────────────────
/**
 * Displays a coloured pill showing whether the backend is reachable.
 * status: "ok" | "checking" | "error"
 */
export function ServerBadge({ status, theme: t }) {
  const color = status === "ok"
    ? t.okColor
    : status === "checking"
    ? t.warnColor
    : t.errColor;

  const label = status === "ok"
    ? "Backend live"
    : status === "checking"
    ? "Connecting…"
    : "Backend offline";

  const Icon = status === "ok"
    ? CheckCircle2
    : status === "checking"
    ? Loader2
    : AlertCircle;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color }}>
      <Icon
        size={12}
        style={status === "checking" ? { animation: "spin .8s linear infinite" } : {}}
      />
      {label}
    </div>
  );
}

// ─── SETUP MODAL ──────────────────────────────────────────────────────────────
/**
 * Full-screen overlay modal with step-by-step backend setup instructions.
 */
export function SetupModal({ onDismiss, theme: t }) {
  const steps = [
    ["1. Install dependencies", "cd framework && npm install"],
    ["2. Set your API key",     "cp .env.example .env\n# edit .env → ANTHROPIC_API_KEY=sk-ant-..."],
    ["3. Start the backend",    "npm run dev"],
    ["4. Refresh this page",    "The status badge will turn green ✓"],
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,.7)",
      zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 520, background: t.surface, border: `1px solid ${t.border2}`,
        borderRadius: 14, overflow: "hidden", boxShadow: t.shadow,
        fontFamily: "'DM Mono', monospace",
      }}>
        {/* Header */}
        <div style={{
          padding: "16px 20px", borderBottom: `1px solid ${t.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Terminal size={15} color={t.textMuted} />
            <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Backend Setup</span>
          </div>
          <button
            onClick={onDismiss}
            style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted }}
          >
            <X size={13} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}>
          <p style={{ fontSize: 12, color: t.textMuted, lineHeight: 1.7 }}>
            The AI backend runs locally using{" "}
            <strong style={{ color: t.text }}>Express + LangChain</strong>. Free local embeddings via{" "}
            <strong style={{ color: t.text }}>all-MiniLM-L6-v2</strong>. Only an Anthropic key is needed for the LLM.
          </p>

          {steps.map(([label, cmd]) => (
            <div key={label}>
              <p style={{ fontSize: 10, color: t.textDim, letterSpacing: ".07em", marginBottom: 6 }}>
                {label.toUpperCase()}
              </p>
              <pre style={{
                background: t.inputBg, border: `1px solid ${t.border}`,
                borderRadius: 7, padding: "9px 12px", fontSize: 11.5,
                color: t.text, whiteSpace: "pre-wrap", lineHeight: 1.6,
              }}>
                {cmd}
              </pre>
            </div>
          ))}

          <p style={{ fontSize: 11, color: t.textDim, lineHeight: 1.6 }}>
            Stack:{" "}
            <span style={{ color: t.textMuted }}>
              LangChain.js · @langchain/anthropic · MemoryVectorStore ·
              HuggingFaceTransformersEmbeddings · RecursiveCharacterTextSplitter ·
              pdf-parse · Express SSE
            </span>
          </p>
        </div>

        {/* Footer */}
        <div style={{
          padding: "12px 20px", borderTop: `1px solid ${t.border}`,
          display: "flex", justifyContent: "flex-end",
        }}>
          <button
            onClick={onDismiss}
            style={{
              padding: "7px 18px", borderRadius: 7, fontSize: 12, fontWeight: 600,
              background: t.text, color: t.bg, border: "none", cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}