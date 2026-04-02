import { useState, useEffect } from "react";
import { Workflow, Zap, Save, Trash2, Sun, Moon } from "lucide-react";
import { Brain } from "lucide-react";
import { themes, buildGlobalCSS } from "./theme";
import { API } from "./constant";
import { ServerBadge, SetupModal } from "./components/SharedUI";
import { RAGAssistant } from "./components/RAGAssistant";
import { FlowCanvasWrapper, FlowRunButton } from "./components/FlowCanvas";

// ─── APP ROOT ──────────────────────────────────────────────────────────────────
export default function App() {
  const [page,        setPage]        = useState("rag");
  const [dark,        setDark]        = useState(false);
  const [flowName,    setFlowName]    = useState("README Generator");
  const [editingName, setEditingName] = useState(false);
  const [serverStatus, setServerStatus] = useState("checking"); // "checking" | "ok" | "error"
  const [showSetup,   setShowSetup]   = useState(false);

  const t = dark ? themes.dark : themes.light;

  // ── Poll backend health every 8 s ──────────────────────────────────────────
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
        setServerStatus(r.ok ? "ok" : "error");
      } catch {
        setServerStatus("error");
      }
    };
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  const NAV_TABS = [
    { id: "rag",  Icon: Brain,    label: "RAG Research" },
    { id: "flow", Icon: Workflow, label: "Flow Builder" },
  ];

  return (
    <>
      <style>{buildGlobalCSS(t)}</style>

      {showSetup && <SetupModal onDismiss={() => setShowSetup(false)} theme={t} />}

      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: t.bg }}>
        {/* ── Topbar ── */}
        <header style={{
          display: "flex", alignItems: "center", height: 46, padding: "0 14px", gap: 10,
          borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0,
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginRight: 4 }}>
            <div style={{
              width: 20, height: 20, borderRadius: 7, display: "flex", alignItems: "center",
              justifyContent: "center", background: t.surface2, border: `1px solid ${t.border}`,
            }}>
              <Zap size={12} color={t.textMuted} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: t.text, letterSpacing: "-.03em" }}>FrameWork</span>
          </div>

          <div style={{ width: 1, height: 20, background: t.border, marginRight: 2 }} />

          {/* Navigation tabs */}
          {NAV_TABS.map(({ id, Icon: TI, label }) => (
            <button key={id} onClick={() => setPage(id)} style={{
              display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 7,
              fontSize: 12, cursor: "pointer",
              background: page === id ? t.surface2 : "transparent",
              color: page === id ? t.text : t.textMuted,
              border: `1px solid ${page === id ? t.border2 : "transparent"}`,
              fontWeight: page === id ? 500 : 400,
            }}>
              <TI size={13} strokeWidth={1.8} />{label}
            </button>
          ))}

          {/* Flow name (only on Flow tab) */}
          {page === "flow" && (
            <>
              <div style={{ width: 1, height: 20, background: t.border }} />
              {editingName ? (
                <input
                  autoFocus value={flowName}
                  onChange={e => setFlowName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                  style={{
                    background: "transparent", border: "none", outline: "none",
                    fontSize: 12, color: t.text, fontFamily: "'DM Mono',monospace", minWidth: 180,
                  }}
                />
              ) : (
                <span
                  onClick={() => setEditingName(true)}
                  style={{
                    fontSize: 12, color: t.text, fontFamily: "'DM Mono',monospace",
                    cursor: "text", padding: "4px 8px", borderRadius: 6,
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = t.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {flowName}
                </span>
              )}
            </>
          )}

          <div style={{ flex: 1 }} />

          {/* Server status badge */}
          <button
            onClick={() => setShowSetup(true)}
            style={{
              background: "none", border: `1px solid ${t.border}`, borderRadius: 7,
              padding: "5px 10px", cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
            }}
            onMouseEnter={e => e.currentTarget.style.borderColor = t.border2}
            onMouseLeave={e => e.currentTarget.style.borderColor = t.border}
          >
            <ServerBadge status={serverStatus} theme={t} />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setDark(d => !d)}
            style={{
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 7,
              cursor: "pointer", color: t.textMuted,
            }}
            onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.border2; }}
            onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border; }}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {/* Flow toolbar (only on Flow tab) */}
          {page === "flow" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              {[Save, Trash2].map((BI, i) => (
                <button key={i} style={{
                  width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                  background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 7,
                  cursor: "pointer", color: t.textMuted,
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.border2; }}
                  onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border; }}
                >
                  <BI size={13} />
                </button>
              ))}
              <FlowRunButton serverStatus={serverStatus} theme={t} />
            </div>
          )}
        </header>

        {/* ── Page content ── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {page === "rag"  && <RAGAssistant    theme={t} serverStatus={serverStatus} />}
          {page === "flow" && <FlowCanvasWrapper theme={t} serverStatus={serverStatus} />}
        </div>
      </div>
    </>
  );
}