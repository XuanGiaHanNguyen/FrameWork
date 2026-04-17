import { useState, useEffect } from "react";
import { Workflow, Zap } from "lucide-react";
import { Brain } from "lucide-react";
import { themes, buildGlobalCSS } from "./theme";
import { checkHealth } from "./api";
import { RAGAssistant } from "./components/RAGAssistant";
import { FlowCanvasWrapper } from "./components/FlowCanvas";
import PipelineDemo from "./components/table/pipeline";

export default function App() {
  const [page, setPage] = useState("rag");
  const [serverStatus, setServerStatus] = useState("checking");
  const [notebooks, setNotebooks] = useState([]);
  const [flowCanvasVisible, setFlowCanvasVisible] = useState(false);
  const [flowOpenEditorNodeId, setFlowOpenEditorNodeId] = useState(null);

  const t = themes.light;

  // Poll backend health every 8 s
  useEffect(() => {
    const check = async () => {
      try {
        setServerStatus((await checkHealth()) ? "ok" : "error");
      } catch {
        setServerStatus("error");
      }
    };
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  const NAV_TABS = [
    { id: "rag", Icon: Brain, label: "Research" },
    { id: "flow", Icon: Workflow, label: "Automate" },
  ];

  return (
    <>
      <style>{buildGlobalCSS(t)}</style>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          overflow: "hidden",
          background: t.bg,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            height: 60,
            padding: "28px 24px",
            gap: 5,
            borderBottom: `1px solid ${t.border}`,
            background: t.surface,
            flexShrink: 0,
          }}
        >
          {/* Logo */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginRight: 4,
            }}
          >
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: t.surface2,
                border: `1px solid ${t.border}`,
              }}
            >
              <Zap size={14} color={t.textMuted} />
            </div>
            <span
              style={{
                fontWeight: 700,
                fontSize: 15,
                color: t.text,
                letterSpacing: "-.03em",
              }}
            >
              FrameWork
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              width: 1,
              height: 18,
              background: t.border,
              margin: "0 3px",
            }}
          />

          {/* Nav tabs */}
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setPage(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 6,
                fontSize: 12,
                cursor: "pointer",
                background: page === tab.id ? t.surface2 : "transparent",
                color: page === tab.id ? t.text : t.textMuted,
                border: `1px solid ${page === tab.id ? t.border2 : "transparent"}`,
                fontWeight: page === tab.id ? 500 : 400,
              }}
            >
              <tab.Icon size={14} strokeWidth={1.8} />
              {tab.label}
            </button>
          ))}

          <div style={{ flex: 1 }} />
        </header>
        {/* ─── PAGE CONTENT ───────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {page === "rag" && (
            <RAGAssistant
              theme={t}
              serverStatus={serverStatus}
              notebooks={notebooks}
              setNotebooks={setNotebooks}
            />
          )}
          {page === "flow" && (
            <div
              style={{
                display: "flex",
                width: "100%",
                overflow: "hidden",
                flexDirection: "column",
              }}
            >
              <PipelineDemo
                theme={t}
                onStartBuilding={() => {
                  setFlowCanvasVisible(true);
                  setFlowOpenEditorNodeId("2");
                }}
              />
              {flowCanvasVisible && (
                <div style={{ flex: 1, minHeight: 0, marginTop: 16 }}>
                  <FlowCanvasWrapper
                    theme={t}
                    serverStatus={serverStatus}
                    openEditorNodeId={flowOpenEditorNodeId}
                    onOpenEditorHandled={() => setFlowOpenEditorNodeId(null)}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
