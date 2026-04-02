import { useState, useCallback, useRef, useEffect } from "react";
import { Loader2, Play, Save, Trash2, X } from "lucide-react";
import { FlowNode } from "./FlowNode";
import { PromptEditorPanel } from "./PromptEditorPanel";
import {
  INITIAL_NODES, INITIAL_EDGES, NODE_META,
  DEFAULT_NODE_FIELDS, DEFAULT_SAVED_PROMPTS, API,
} from "../constant";
import { readSSE, makePath, getRightHandle, getLeftHandle } from "../utils";

let nodeIdCounter = 20;

// ─── FLOW CANVAS ──────────────────────────────────────────────────────────────
export function FlowCanvas({ theme: t, serverStatus }) {
  const [nodes,         setNodes]         = useState(INITIAL_NODES);
  const [edges,         setEdges]         = useState(INITIAL_EDGES);
  const [selected,      setSelected]      = useState(null);
  const [running,       setRunning]       = useState(false);
  const [runLog,        setRunLog]        = useState([]);
  const [showLog,       setShowLog]       = useState(false);
  const [flowOutput,    setFlowOutput]    = useState("");
  const [pan,           setPan]           = useState({ x: 0, y: 0 });
  const [editorNodeId,  setEditorNodeId]  = useState(null);
  const [nodeRunStatus, setNodeRunStatus] = useState({});
  const [savedPrompts,  setSavedPrompts]  = useState(DEFAULT_SAVED_PROMPTS);
  const [connectingFrom, setConnectingFrom] = useState(null);
  const [dragPos,       setDragPos]       = useState({ x: 0, y: 0 });

  const dragging  = useRef(null);
  const panning   = useRef(null);
  const canvasRef = useRef();
  const nodeRefs  = useRef({});
  const edgeIdCtr = useRef(10);
  const spCtr     = useRef(10);

  // ── Listen for header Run button (global event) ────────────────────────────
  const runPipelineRef = useRef(null);
  useEffect(() => {
    const handler = () => runPipelineRef.current?.();
    document.addEventListener("fw:run-flow", handler);
    return () => document.removeEventListener("fw:run-flow", handler);
  }, []);

  // ── Drag & pan handlers ────────────────────────────────────────────────────
  const onNodeMouseDown = useCallback((nodeId, e) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    setSelected(nodeId);
    dragging.current = { nodeId, startX: e.clientX - node.x, startY: e.clientY - node.y };
  }, [nodes]);

  const onCanvasMouseDown = useCallback((e) => {
    const tag = e.target.tagName.toLowerCase();
    if (e.target === canvasRef.current || ["svg", "path", "rect", "circle"].includes(tag)) {
      setSelected(null);
      panning.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y };
    }
  }, [pan]);

  const onMouseMove = useCallback((e) => {
    if (dragging.current) {
      const { nodeId, startX, startY } = dragging.current;
      setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, x: e.clientX - startX, y: e.clientY - startY } : n));
    } else if (panning.current) {
      setPan({ x: e.clientX - panning.current.startX, y: e.clientY - panning.current.startY });
    }
    if (connectingFrom) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragPos({ x: e.clientX - rect.left - pan.x, y: e.clientY - rect.top - pan.y });
    }
  }, [connectingFrom, pan]);

  const onMouseUp = useCallback(() => {
    dragging.current = null;
    panning.current  = null;
    if (connectingFrom) setConnectingFrom(null);
  }, [connectingFrom]);

  // ── Edge connection ────────────────────────────────────────────────────────
  const onStartConnect = useCallback((nodeId, e) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setConnectingFrom(nodeId);
    setDragPos({ x: e.clientX - rect.left - pan.x, y: e.clientY - rect.top - pan.y });
  }, [pan]);

  const onCompleteConnect = useCallback((targetId) => {
    if (!connectingFrom || connectingFrom === targetId) { setConnectingFrom(null); return; }
    setEdges(es => {
      if (es.some(e => e.from === connectingFrom && e.to === targetId)) return es;
      return [...es, { id: `e${++edgeIdCtr.current}`, from: connectingFrom, to: targetId }];
    });
    setConnectingFrom(null);
  }, [connectingFrom]);

  const deleteEdge = useCallback((edgeId) => setEdges(es => es.filter(e => e.id !== edgeId)), []);

  // ── Node CRUD ──────────────────────────────────────────────────────────────
  const onDelete = useCallback((id) => {
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.from !== id && e.to !== id));
    if (selected === id)      setSelected(null);
    if (editorNodeId === id)  setEditorNodeId(null);
  }, [selected, editorNodeId]);

  const onFieldChange = useCallback((nodeId, fi, value) => {
    setNodes(ns => ns.map(n => n.id === nodeId
      ? { ...n, fields: n.fields.map((f, i) => i === fi ? { ...f, value } : f) }
      : n));
  }, []);

  const addNode = useCallback((type) => {
    const id = String(++nodeIdCounter);
    setNodes(ns => [...ns, {
      id, type, label: NODE_META[type].label,
      x: 80 + Math.random() * 300, y: 100 + Math.random() * 200,
      fields: DEFAULT_NODE_FIELDS[type] || [],
    }]);
    if (type === "llm") setTimeout(() => setEditorNodeId(id), 50);
  }, []);

  // ── Prompt editor callbacks ────────────────────────────────────────────────
  const handleEditorSave = useCallback(async (nodeId, sysVal, userVal, saveName) => {
    setNodes(ns => ns.map(n => {
      if (n.id !== nodeId) return n;
      return {
        ...n, fields: n.fields.map(f => {
          if (f.type === "textarea" && f.placeholder?.toLowerCase().includes("system")) return { ...f, value: sysVal };
          if (f.type === "textarea" && f.placeholder?.toLowerCase().includes("user"))   return { ...f, value: userVal };
          return f;
        }),
      };
    }));
    if (saveName) {
      const entry = { id: `sp${++spCtr.current}`, name: saveName, system: sysVal, user: userVal };
      setSavedPrompts(sp => [...sp, entry]);
      try {
        await fetch(`${API}/prompts`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: saveName, system: sysVal, user: userVal }),
        });
      } catch {}
    }
  }, []);

  const handleApplySaved = useCallback((nodeId, sp) => {
    setNodes(ns => ns.map(n => {
      if (n.id !== nodeId) return n;
      return {
        ...n, fields: n.fields.map(f => {
          if (f.type === "textarea" && f.placeholder?.toLowerCase().includes("system")) return { ...f, value: sp.system || f.value };
          if (f.type === "textarea" && f.placeholder?.toLowerCase().includes("user"))   return { ...f, value: sp.user   || f.value };
          return f;
        }),
      };
    }));
  }, []);

  const handleDeleteSaved = useCallback((id) => setSavedPrompts(sp => sp.filter(p => p.id !== id)), []);

  // ── Pipeline run ───────────────────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (serverStatus !== "ok") {
      setRunLog([{ text: "⚠  Backend not connected. Start the server first.", color: "warn" }]);
      setShowLog(true);
      return;
    }
    setRunning(true); setShowLog(true); setFlowOutput(""); setNodeRunStatus({});
    setRunLog([{ text: "▶  Sending flow to backend…" }]);

    try {
      const resp = await fetch(`${API}/flow/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nodes, edges }),
      });
      if (!resp.ok) throw new Error(`Server error ${resp.status}`);

      let currentOutput = "";
      for await (const event of readSSE(resp)) {
        if (event.type === "status")     { setRunLog(l => [...l, { text: `   ${event.text}`, dim: true }]); }
        if (event.type === "node_start") { setNodeRunStatus(s => ({ ...s, [event.nodeId]: "running" })); setRunLog(l => [...l, { text: `→  Running: ${event.label}` }]); }
        if (event.type === "node_token") { currentOutput += event.token; setFlowOutput(currentOutput); }
        if (event.type === "node_done")  { setNodeRunStatus(s => ({ ...s, [event.nodeId]: "done" })); setRunLog(l => [...l, { text: `✓  Done: ${(event.output || "").slice(0, 80)}`, dim: true }]); }
        if (event.type === "flow_done")  { setFlowOutput(event.output || currentOutput); setRunLog(l => [...l, { text: "✓  Flow complete" }]); }
        if (event.type === "error")      { setNodeRunStatus(s => ({ ...s, [event.nodeId]: "error" })); setRunLog(l => [...l, { text: `✗  ${event.error}`, color: "err" }]); }
      }
    } catch (err) {
      setRunLog(l => [...l, { text: `✗  ${err.message}`, color: "err" }]);
    } finally {
      setRunning(false);
    }
  }, [nodes, edges, serverStatus]);

  // Keep ref in sync for the event-listener callback
  runPipelineRef.current = runPipeline;

  const editorNode = editorNodeId ? nodes.find(n => n.id === editorNodeId) : null;

  // ── Edge SVG paths ─────────────────────────────────────────────────────────
  const edgePaths = edges.map(e => {
    const fn = nodes.find(n => n.id === e.from), tn = nodes.find(n => n.id === e.to);
    if (!fn || !tn) return null;
    const from = getRightHandle(fn, nodeRefs), to = getLeftHandle(tn, nodeRefs);
    const d = makePath(from.x, from.y, to.x, to.y);
    const mx = (from.x + to.x) / 2, my = (from.y + to.y) / 2;
    return (
      <g key={e.id}>
        <path d={d} fill="none" stroke="transparent" strokeWidth="12" style={{ cursor: "pointer" }} onClick={() => deleteEdge(e.id)} />
        <path d={d} fill="none" stroke={t.edgeColor} strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#arr)" style={{ animation: "edgeDash 1.2s linear infinite", pointerEvents: "none" }} />
        <g transform={`translate(${mx},${my})`} style={{ cursor: "pointer" }} onClick={() => deleteEdge(e.id)}>
          <circle r="8" fill={t.surface} stroke={t.border2} strokeWidth="1" />
          <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    );
  });

  let pendingPath = null;
  if (connectingFrom) {
    const fn = nodes.find(n => n.id === connectingFrom);
    if (fn) {
      const from = getRightHandle(fn, nodeRefs);
      pendingPath = <path d={makePath(from.x, from.y, dragPos.x, dragPos.y)} fill="none" stroke={t.text} strokeWidth="1.5" strokeDasharray="6 4" opacity=".6" style={{ pointerEvents: "none" }} />;
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg }}>
      {/* ── Node palette ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderBottom: `1px solid ${t.border}`, background: t.surface, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: t.textMuted, marginRight: 4, fontFamily: "monospace", letterSpacing: ".08em" }}>ADD NODE</span>
        {Object.entries(NODE_META).map(([type, meta]) => {
          const NI = meta.Icon;
          return (
            <button key={type} onClick={() => addNode(type)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 6,
              fontSize: 11, border: `1px solid ${t.border2}`, background: t.surface2, color: t.textMuted, cursor: "pointer", fontFamily: "inherit",
            }}
              onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.text; }}
              onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border2; }}
            >
              <NI size={11} />{meta.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: t.textDim, fontFamily: "monospace" }}>drag right handle → left to connect · click × on edge to remove</span>
      </div>

      {/* ── Canvas + editor panel ── */}
      <div style={{ flex: 1, position: "relative", display: "flex", overflow: "hidden" }}>
        <div
          ref={canvasRef}
          style={{ flex: 1, position: "relative", overflow: "hidden", cursor: connectingFrom ? "crosshair" : "default" }}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          {/* SVG layer: grid + edges */}
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse" x={pan.x % 24} y={pan.y % 24}>
                <circle cx="12" cy="12" r=".8" fill={t.gridDot} />
              </pattern>
              <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L6,3.5 z" fill={t.edgeColor} />
              </marker>
            </defs>
            <style>{`@keyframes edgeDash{to{stroke-dashoffset:-36;}}`}</style>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <g transform={`translate(${pan.x},${pan.y})`}>{edgePaths}{pendingPath}</g>
          </svg>

          {/* Node layer */}
          <div style={{ position: "absolute", inset: 0 }}>
            {nodes.map(n => (
              <div key={n.id} ref={el => { if (el) nodeRefs.current[n.id] = el; }}
                style={{ position: "absolute", left: n.x + pan.x, top: n.y + pan.y }}>
                <FlowNode
                  node={n} selected={selected === n.id}
                  onDelete={onDelete} onFieldChange={onFieldChange}
                  onMouseDown={e => onNodeMouseDown(n.id, e)}
                  onStartConnect={onStartConnect} onCompleteConnect={onCompleteConnect}
                  connectingFrom={connectingFrom} onOpenEditor={setEditorNodeId}
                  runStatus={nodeRunStatus[n.id] || null} theme={t}
                />
              </div>
            ))}
          </div>

          {/* Run log overlay */}
          <RunLog
            show={showLog} log={runLog} running={running} output={flowOutput}
            onClose={() => setShowLog(false)}
            right={editorNode ? 416 : 16} theme={t}
          />
        </div>

        {/* Prompt editor panel */}
        {editorNode && (
          <PromptEditorPanel
            node={editorNode} savedPrompts={savedPrompts}
            onSave={handleEditorSave} onClose={() => setEditorNodeId(null)}
            onApplySaved={handleApplySaved} onDeleteSaved={handleDeleteSaved}
            theme={t}
          />
        )}
      </div>
    </div>
  );
}

// ─── RUN LOG OVERLAY ──────────────────────────────────────────────────────────
function RunLog({ show, log, running, output, onClose, right, theme: t }) {
  if (!show) return null;
  return (
    <div style={{
      position: "absolute", bottom: 16, right, width: 320,
      background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: 10, overflow: "hidden", boxShadow: t.shadow,
      transition: "right .2s ease",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${t.border}` }}>
        <span style={{ fontSize: 10, color: t.textMuted, fontFamily: "monospace", letterSpacing: ".08em" }}>RUN LOG</span>
        <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex" }}><X size={11} /></button>
      </div>
      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, maxHeight: 180, overflowY: "auto" }}>
        {log.map((l, i) => (
          <span key={i} style={{
            fontFamily: "monospace", fontSize: 11,
            color: l.color === "err" ? t.errColor : l.color === "warn" ? t.warnColor : l.dim ? t.textMuted : t.text,
          }}>{l.text}</span>
        ))}
        {running && (
          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: t.textMuted, animation: `dot 1.4s ease infinite`, animationDelay: `${i * .2}s` }} />
            ))}
          </div>
        )}
      </div>
      {output && (
        <div style={{ borderTop: `1px solid ${t.border}`, padding: "10px 12px", maxHeight: 200, overflowY: "auto" }}>
          <span style={{ fontSize: 9, color: t.textDim, letterSpacing: ".08em", display: "block", marginBottom: 6 }}>OUTPUT</span>
          <pre style={{ fontSize: 11, color: t.text, fontFamily: "inherit", lineHeight: 1.55, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{output}</pre>
        </div>
      )}
    </div>
  );
}

// ─── WRAPPER + HEADER RUN BUTTON ──────────────────────────────────────────────
export function FlowCanvasWrapper({ theme, serverStatus }) {
  return <FlowCanvas theme={theme} serverStatus={serverStatus} />;
}

export function FlowRunButton({ serverStatus, theme: t }) {
  return (
    <button
      onClick={() => document.dispatchEvent(new CustomEvent("fw:run-flow"))}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "6px 14px", borderRadius: 7, fontSize: 12, fontWeight: 600,
        background: t.text, color: t.bg, border: "none", cursor: "pointer",
      }}
      onMouseEnter={e => e.currentTarget.style.opacity = ".8"}
      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
    >
      <Play size={12} />Run
    </button>
  );
}