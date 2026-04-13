// src/components/ServerStatus.jsx
import { AlertCircle, CheckCircle2, Loader2, Terminal, X } from "lucide-react";

// ─── SERVER STATUS BADGE ──────────────────────────────────────────────────────
export function ServerBadge({ status, theme: t }) {
  const color = status === "ok"
    ? "#137333"
    : status === "checking"
    ? "#E37400"
    : "#C5221F";

  const bgColor = status === "ok"
    ? "#E6F4EA"
    : status === "checking"
    ? "#FEF7E0"
    : "#FCE8E6";

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
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      fontSize: 12, color,
      background: bgColor,
      padding: "5px 12px",
      borderRadius: 20,
      fontWeight: 500,
    }}>
      <Icon
        size={13}
        style={status === "checking" ? { animation: "spin .8s linear infinite" } : {}}
      />
      {label}
    </div>
  );
}

// ─── SETUP MODAL ──────────────────────────────────────────────────────────────
export function SetupModal({ onDismiss, theme: t }) {
  const steps = [
    ["1. Install dependencies", "cd framework && npm install"],
    ["2. Set your API key",     "cp .env.example .env\n# edit .env → ANTHROPIC_API_KEY=sk-ant-..."],
    ["3. Start the backend",    "npm run dev"],
    ["4. Refresh this page",    "The status badge will turn green ✓"],
  ];

  return (
    <div style={{
      position: "fixed", inset: 0,
      background: "rgba(0,0,0,0.5)",
      zIndex: 200, display: "flex",
      alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 540,
        background: "#FFFFFF",
        borderRadius: 24,
        overflow: "hidden",
        boxShadow: "0 8px 40px rgba(0,0,0,0.2)",
        fontFamily: "'Google Sans', 'Segoe UI', sans-serif",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px 16px",
          borderBottom: "1px solid rgba(0,0,0,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: "#E8F0FE", display: "flex",
              alignItems: "center", justifyContent: "center",
            }}>
              <Terminal size={16} color="#1A73E8" />
            </div>
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: "#1F1F1F" }}>Backend Setup</p>
              <p style={{ fontSize: 12, color: "#80868B", marginTop: 1 }}>Get the server running locally</p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            style={{
              background: "none", border: "none", cursor: "pointer",
              color: "#80868B", display: "flex", padding: 8, borderRadius: 20,
              transition: "background .1s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#F0F4F9"}
            onMouseLeave={e => e.currentTarget.style.background = "none"}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          <p style={{ fontSize: 13, color: "#444746", lineHeight: 1.7 }}>
            The AI backend runs locally using{" "}
            <strong style={{ color: "#1F1F1F" }}>Express + LangChain</strong>. Free local embeddings via{" "}
            <strong style={{ color: "#1F1F1F" }}>all-MiniLM-L6-v2</strong>. Only an Anthropic key is needed for the LLM.
          </p>

          {steps.map(([label, cmd]) => (
            <div key={label}>
              <p style={{
                fontSize: 11, color: "#80868B",
                letterSpacing: ".07em", fontWeight: 600, marginBottom: 8,
                textTransform: "uppercase",
              }}>
                {label}
              </p>
              <pre style={{
                background: "#F0F4F9",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 12, padding: "12px 16px",
                fontSize: 12.5, color: "#1F1F1F",
                whiteSpace: "pre-wrap", lineHeight: 1.65,
                fontFamily: "'Google Sans Mono', 'Fira Code', monospace",
              }}>
                {cmd}
              </pre>
            </div>
          ))}

          <div style={{
            padding: "10px 14px", borderRadius: 10,
            background: "#F0F4F9", border: "1px solid rgba(0,0,0,0.06)",
          }}>
            <p style={{ fontSize: 11, color: "#80868B", lineHeight: 1.65 }}>
              <strong style={{ color: "#444746" }}>Stack:</strong>{" "}
              LangChain.js · @langchain/anthropic · MemoryVectorStore ·
              HuggingFaceTransformersEmbeddings · RecursiveCharacterTextSplitter ·
              pdf-parse · Express SSE
            </p>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: "14px 24px",
          borderTop: "1px solid rgba(0,0,0,0.08)",
          display: "flex", justifyContent: "flex-end", gap: 10,
        }}>
          <button
            onClick={onDismiss}
            style={{
              padding: "10px 28px", borderRadius: 24,
              fontSize: 14, fontWeight: 500,
              background: "#1F1F1F", color: "#FFFFFF",
              border: "none", cursor: "pointer",
              fontFamily: "inherit", transition: "background .15s",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#333"}
            onMouseLeave={e => e.currentTarget.style.background = "#1F1F1F"}
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}