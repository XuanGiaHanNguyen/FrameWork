// src/components/NotebookView.jsx
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Brain, X, Send, Loader2,
  Download, MessageSquareX,
  ArrowLeft, ChevronDown, Globe, Sparkles, Search,
  Plus, MoreVertical, SlidersHorizontal,
  Mic, Volume2, LayoutTemplate, FileText,
  Map, BookOpen, FileQuestion, BarChart3, Table,
  PanelLeftClose, PanelRightClose, Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PRESETS } from "../constant";
import { readSSE, uniqueStrings } from "../utils";
import {
  uploadFiles, listFiles, deleteFile, getFileDownloadUrl,
  listMessages, clearMessages, queryNotebook,
} from "../api";

// ─── GLOBAL KEYFRAMES (injected once) ────────────────────────────────────────
const GLOBAL_CSS = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes spin   { to { transform: rotate(360deg); } }
  @keyframes blink  { 0%,100%{opacity:1;}50%{opacity:0;} }
  @keyframes dot    { 0%,80%,100%{transform:scale(0.6);opacity:0.4;}40%{transform:scale(1);opacity:1;} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);} }
  @keyframes pulse  { 0%,100%{opacity:1;}50%{opacity:0.4;} }
  .nb-prose p{margin-bottom:.45em;}
  .nb-prose p:last-child{margin-bottom:0;}
  .nb-prose ul,.nb-prose ol{padding-left:1.3em;margin-bottom:.45em;}
  .nb-prose li{margin-bottom:.2em;}
  .nb-prose strong{font-weight:600;}
  .nb-prose h1,.nb-prose h2,.nb-prose h3{font-weight:600;margin:.7em 0 .35em;}
  .nb-prose code{background:#F3F4F6;padding:1px 5px;border-radius:4px;font-size:.84em;}
  .nb-prose pre{background:#F3F4F6;padding:10px 14px;border-radius:8px;overflow-x:auto;font-size:.82em;margin-bottom:.45em;}
  .nb-prose a{color:#9CA3AF;text-decoration:none;}
  .nb-prose a:hover{text-decoration:underline;}
`;

function GlobalStyle() {
  useEffect(() => {
    const el = document.createElement("style");
    el.textContent = GLOBAL_CSS;
    document.head.appendChild(el);
    return () => document.head.removeChild(el);
  }, []);
  return null;
}

// ─── COLOUR TOKENS ────────────────────────────────────────────────────────────
const C = {
  bg:         "#F3F4F6",
  surface:    "#FFFFFF",
  border:     "#E5E7EB",
  borderSoft: "#F3F4F6",
  text:       "#111827",
  textSub:    "#6B7280",
  textMuted:  "#9CA3AF",
  accent:     "#374151",
  userBubble: "#374151",
};

// ─── STUDIO CARDS DATA ────────────────────────────────────────────────────────
const STUDIO_CARDS = [
  { icon: Mic,            label: "Audio...",    beta: false },
  { icon: LayoutTemplate, label: "Slide Deck",  beta: true  },
  { icon: Volume2,        label: "Video...",    beta: false },
  { icon: Map,            label: "Mind Map",    beta: false },
  { icon: FileText,       label: "Reports",     beta: false },
  { icon: BookOpen,       label: "Flashcards",  beta: false },
  { icon: FileQuestion,   label: "Quiz",        beta: false },
  { icon: BarChart3,      label: "Infograp...", beta: true  },
  { icon: Table,          label: "Data Table",  beta: false },
];

// ─── REUSABLE MINI COMPONENTS ─────────────────────────────────────────────────

function IconBtn({ onClick, title, children, size = 32 }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick} title={title}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ width: size, height: size, borderRadius: "50%", border: "none", background: hov ? "#F3F4F6" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textSub, transition: "background .15s", flexShrink: 0 }}>
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children, fullWidth }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: fullWidth ? "100%" : undefined, padding: "8px 16px", borderRadius: 20, fontSize: 13, fontWeight: 500, border: `1px solid ${C.border}`, background: hov ? "#F9FAFB" : C.surface, color: C.text, cursor: "pointer", transition: "background .15s" }}>
      {children}
    </button>
  );
}

function Chip({ onClick, children }) {
  const [hov, setHov] = useState(false);
  return (
    <button onClick={onClick}
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 16, fontSize: 12, border: `1px solid ${C.border}`, background: hov ? "#F3F4F6" : "#fff", color: C.textSub, cursor: "pointer", transition: "background .15s" }}>
      {children}
    </button>
  );
}

function CollapseStrip({ onClick, title, side }) {
  const [hov, setHov] = useState(false);
  return (
    <div style={{ width: 38, flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 12, background: C.surface, [side === "left" ? "borderRight" : "borderLeft"]: `1px solid ${C.border}` }}>
      <button onClick={onClick} title={title}
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: hov ? "#F3F4F6" : "transparent", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", color: C.textSub, transition: "background .15s" }}>
        {side === "left" ? <PanelRightClose size={15} /> : <PanelLeftClose size={15} />}
      </button>
    </div>
  );
}

function SourceRow({ paper: p, onDownload, onRemove }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 8, background: hov ? "#F9FAFB" : "transparent", cursor: "pointer", transition: "background .15s" }}>
      <div style={{ width: 26, height: 34, borderRadius: 4, flexShrink: 0, background: "#F3F4F6", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontSize: 7, fontWeight: 800, color: C.textSub, letterSpacing: ".02em" }}>PDF</span>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: C.text, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
        <p style={{ fontSize: 11, color: C.textMuted, marginTop: 1 }}>{p.chunks} chunks · {((p.size || p.sizeBytes || 0) / 1024).toFixed(1)} KB</p>
      </div>
      <div style={{ width: 18, height: 18, borderRadius: 3, background: C.accent, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Check size={11} color="white" strokeWidth={3} />
      </div>
      <button onClick={e => { e.stopPropagation(); onDownload(); }} title="Download" style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 3 }}>
        <Download size={12} />
      </button>
      <button onClick={e => { e.stopPropagation(); onRemove(); }} title="Remove" style={{ background: "none", border: "none", cursor: "pointer", color: C.textMuted, display: "flex", padding: 3 }}>
        <X size={12} />
      </button>
    </div>
  );
}

function StudioCard({ icon: Icon, label, beta }) {
  const [hov, setHov] = useState(false);
  return (
    <button onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 8, padding: "11px 12px", borderRadius: 10, background: hov ? "#EBEBEB" : "#F3F4F6", border: "none", cursor: "pointer", textAlign: "left", position: "relative", transition: "background .15s" }}>
      <Icon size={16} color={C.textSub} strokeWidth={1.8} />
      <span style={{ fontSize: 12, fontWeight: 500, color: C.text }}>{label}</span>
      {beta && (
        <span style={{ position: "absolute", top: 5, right: 6, fontSize: 8, fontWeight: 700, color: C.textMuted, background: "#E5E7EB", borderRadius: 3, padding: "1px 4px", letterSpacing: ".04em" }}>BETA</span>
      )}
    </button>
  );
}

function NoteRow({ note }) {
  const [hov, setHov] = useState(false);
  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ display: "flex", alignItems: "center", gap: 9, padding: "7px 8px", borderRadius: 9, cursor: "pointer", background: hov ? "#F9FAFB" : "transparent", marginBottom: 2, transition: "background .15s" }}>
      <div style={{ width: 34, height: 34, borderRadius: 7, background: "#F3F4F6", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <note.icon size={15} color={C.textSub} strokeWidth={1.8} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, color: C.text, fontWeight: 500 }}>{note.label}</p>
        <p style={{ fontSize: 11, color: C.textMuted }}>2 sources · {note.time}</p>
      </div>
      <IconBtn size={28}><MoreVertical size={13} /></IconBtn>
    </div>
  );
}

// ─── CHAT MESSAGE ─────────────────────────────────────────────────────────────
function ChatMessage({ message: m }) {
  const isUser = m.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 10, alignItems: "flex-start", animation: "fadeIn .2s ease" }}>
      {!isUser && (
        <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: "#E5E7EB", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Brain size={13} color={C.textSub} strokeWidth={1.8} />
        </div>
      )}
      <div style={{ maxWidth: isUser ? 460 : 560 }}>
        <div style={{ borderRadius: isUser ? "18px 18px 5px 18px" : "5px 18px 18px 18px", padding: isUser ? "9px 16px" : "11px 16px", fontSize: 14, lineHeight: 1.65, background: isUser ? C.userBubble : C.surface, color: isUser ? "#fff" : C.text, border: !isUser ? `1px solid ${C.border}` : "none", boxShadow: !isUser ? "0 1px 2px rgba(0,0,0,0.04)" : "none" }}>
          <div className="nb-prose"><ReactMarkdown>{m.content}</ReactMarkdown></div>
          {m.streaming && (
            <span style={{ display: "inline-block", width: 2, height: 14, background: isUser ? "#fff" : C.textSub, marginLeft: 2, animation: "blink .8s step-end infinite", verticalAlign: "text-bottom" }} />
          )}
        </div>
        {!isUser && !m.streaming && (
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 5, paddingLeft: 2 }}>
            <Chip onClick={() => {}}>✎ Save to notes</Chip>
            <IconBtn size={28} title="Copy">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
            </IconBtn>
            <IconBtn size={28} title="Good">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/><path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/></svg>
            </IconBtn>
            <IconBtn size={28} title="Bad">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/><path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/></svg>
            </IconBtn>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── THINKING BUBBLE ─────────────────────────────────────────────────────────
function ThinkingBubble({ pipeline }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start", animation: "fadeIn .2s ease" }}>
      <div style={{ width: 30, height: 30, borderRadius: "50%", flexShrink: 0, marginTop: 2, background: "#E5E7EB", border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Brain size={13} color={C.textSub} strokeWidth={1.8} />
      </div>
      <div style={{ borderRadius: "5px 18px 18px 18px", padding: "11px 16px", background: C.surface, border: `1px solid ${C.border}`, boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        {pipeline?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {pipeline.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: i === pipeline.length - 1 ? C.accent : "#D1D5DB", flexShrink: 0, animation: i === pipeline.length - 1 ? "pulse 1s ease infinite" : "none" }} />
                <span style={{ color: i === pipeline.length - 1 ? C.text : C.textMuted, fontFamily: "monospace" }}>{s}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#9CA3AF", animation: "dot 1.4s ease infinite", animationDelay: `${i * 0.2}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── NOTEBOOK VIEW ────────────────────────────────────────────────────────────
export function NotebookView({ notebook, onBack, serverStatus }) {
  const [papers,      setPapers]      = useState([]);
  const [messages,    setMessages]    = useState([]);
  const [input,       setInput]       = useState("");
  const [loading,     setLoading]     = useState(false);
  const [ingesting,   setIngesting]   = useState(false);
  const [dragOver,    setDragOver]    = useState(false);
  const [pipeline,    setPipeline]    = useState(null);
  const [sources,     setSources]     = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [leftOpen,    setLeftOpen]    = useState(true);
  const [rightOpen,   setRightOpen]   = useState(true);
  const [allSelected, setAllSelected] = useState(true);
  const [webMode,     setWebMode]     = useState("web");

  const fileRef = useRef();
  const chatRef = useRef();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      try {
        const [files, msgs] = await Promise.all([listFiles(notebook.id), listMessages(notebook.id)]);
        if (cancelled) return;
        setPapers(files);
        setMessages(msgs.length > 0 ? msgs : [{ role: "assistant", content: `Welcome to **${notebook.name}**. Upload sources and start asking questions.` }]);
      } catch (err) {
        if (!cancelled) setMessages([{ role: "assistant", content: `Failed to load: ${err.message}` }]);
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [notebook.id, notebook.name]);

  useEffect(() => {
    setTimeout(() => chatRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 80);
  }, [messages.length]);

  const ingest = useCallback(async (files) => {
    if (serverStatus !== "ok") { setMessages(m => [...m, { role: "assistant", content: "⚠ Backend not running." }]); return; }
    const MAX = 5 * 1024 * 1024;
    const oversized = files.filter(f => f.size > MAX);
    const allowed   = files.filter(f => f.size <= MAX);
    if (oversized.length) setMessages(m => [...m, { role: "assistant", content: `⚠ Skipped (>5 MB): ${oversized.map(f => f.name).join(", ")}.` }]);
    if (!allowed.length) return;
    setIngesting(true);
    try {
      const { results } = await uploadFiles(notebook.id, allowed);
      const ok   = results.filter(r => r.status === "ok");
      const fail = results.filter(r => r.status !== "ok");
      setPapers(await listFiles(notebook.id));
      const parts = [];
      if (ok.length)   parts.push(`✓ Ingested ${ok.map(r => `"${r.name}"`).join(", ")}.`);
      if (fail.length) parts.push(`✗ Failed: ${fail.map(r => r.name).join(", ")}.`);
      setMessages(m => [...m, { role: "assistant", content: parts.join(" ") }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Upload error: ${err.message}` }]);
    } finally { setIngesting(false); }
  }, [serverStatus, notebook.id]);

  const removePaper = useCallback(async (fileId) => {
    setPapers(p => p.filter(x => x.id !== fileId));
    try { await deleteFile(notebook.id, fileId); }
    catch (err) { setPapers(await listFiles(notebook.id)); alert(`Delete failed: ${err.message}`); }
  }, [notebook.id]);

  const downloadPaper = useCallback(async (fileId) => {
    try { const { url, name } = await getFileDownloadUrl(notebook.id, fileId); Object.assign(document.createElement("a"), { href: url, download: name }).click(); }
    catch (err) { alert(`Download failed: ${err.message}`); }
  }, [notebook.id]);

  const handleClearHistory = useCallback(async () => {
    if (!window.confirm("Clear all chat history?")) return;
    try { await clearMessages(notebook.id); setMessages([{ role: "assistant", content: "Chat history cleared." }]); }
    catch (err) { alert(`Clear failed: ${err.message}`); }
  }, [notebook.id]);

  const query = useCallback(async (q) => {
    if (!q.trim()) return;
    setInput(""); setMessages(m => [...m, { role: "user", content: q }]); setLoading(true); setSources([]);
    if (serverStatus !== "ok") { setMessages(m => [...m, { role: "assistant", content: "⚠ Backend not running." }]); setLoading(false); return; }
    setPipeline([]);
    try {
      const resp = await queryNotebook(notebook.id, q);
      let fullText = ""; let msgAdded = false;
      for await (const event of readSSE(resp)) {
        if (event.type === "status")  setPipeline(p => [...(p || []), event.text]);
        if (event.type === "sources") setSources(uniqueStrings(event.sources || []));
        if (event.type === "token") {
          fullText += event.token;
          if (!msgAdded) { setMessages(m => [...m, { role: "assistant", content: fullText, streaming: true }]); msgAdded = true; }
          else setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: fullText } : msg));
        }
        if (event.type === "done")  setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: event.fullText || fullText, streaming: false } : msg));
        if (event.type === "error") setMessages(m => [...m, { role: "assistant", content: `Error: ${event.error}` }]);
      }
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Connection error: ${err.message}` }]);
    } finally { setLoading(false); setPipeline(null); }
  }, [serverStatus, notebook.id]);

  return (
    <>
      <GlobalStyle />
      <div style={{ display: "flex", flexDirection: "column", width: "100%", height: "100%", background: C.bg, fontFamily: "system-ui,-apple-system,sans-serif" }}>
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── LEFT: Sources ──────────────────────────────────────────── */}
          {leftOpen ? (
            <aside style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: C.surface, borderRight: `1px solid ${C.border}`, overflow: "hidden" }}>
              <div style={{ height: 52, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Sources</span>
                <IconBtn onClick={() => setLeftOpen(false)} title="Collapse"><PanelLeftClose size={15} /></IconBtn>
              </div>

              <div style={{ padding: "12px 14px 8px", flexShrink: 0 }}>
                <GhostBtn onClick={() => fileRef.current.click()} fullWidth>
                  {ingesting ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} /> : <Plus size={13} />}
                  {ingesting ? "Processing…" : "Add sources"}
                </GhostBtn>
              </div>

              {/* web search bar */}
              <div style={{ padding: "0 14px 10px", flexShrink: 0 }}>
                <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, background: C.bg, overflow: "hidden" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 11px" }}>
                    <Search size={13} color={C.textMuted} />
                    <input readOnly placeholder="Search the web for sources" style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 12, color: C.textMuted }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 9px", borderTop: `1px solid ${C.borderSoft}` }}>
                    {["web", "ai"].map(mode => (
                      <button key={mode} onClick={() => setWebMode(mode)} style={{ display: "flex", alignItems: "center", gap: 4, padding: "2px 9px", borderRadius: 12, border: "none", background: webMode === mode ? "#E5E7EB" : "transparent", color: webMode === mode ? C.text : C.textMuted, cursor: "pointer", fontSize: 11, fontWeight: 500 }}>
                        {mode === "web" ? <><Globe size={10} /> Web</> : <Sparkles size={10} />} <ChevronDown size={9} />
                      </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <button style={{ width: 22, height: 22, borderRadius: "50%", background: "#E5E7EB", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <ArrowLeft size={11} color={C.textSub} style={{ transform: "rotate(180deg)" }} />
                    </button>
                  </div>
                </div>
              </div>

              {/* select all */}
              <div style={{ padding: "0 14px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
                <span style={{ fontSize: 12, color: C.textSub }}>Select all sources</span>
                <div onClick={() => setAllSelected(a => !a)} style={{ width: 18, height: 18, borderRadius: 4, background: allSelected ? C.accent : "transparent", border: allSelected ? "none" : `2px solid ${C.textMuted}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                  {allSelected && <Check size={11} color="white" strokeWidth={3} />}
                </div>
              </div>

              {dragOver && (
                <div style={{ margin: "0 14px 8px", borderRadius: 8, border: `1.5px dashed ${C.textSub}`, background: "#F9FAFB", padding: 10, textAlign: "center", flexShrink: 0 }}>
                  <p style={{ fontSize: 12, color: C.textSub }}>Drop files here</p>
                </div>
              )}
              <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={e => { e.preventDefault(); setDragOver(false); ingest([...e.dataTransfer.files]); }} style={{ position: "absolute", inset: 0, zIndex: dragOver ? 5 : -1 }} />

              <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 8px" }}>
                {loadingData ? (
                  <div style={{ display: "flex", justifyContent: "center", padding: 24 }}><Loader2 size={17} color={C.textMuted} style={{ animation: "spin .8s linear infinite" }} /></div>
                ) : papers.length === 0 ? (
                  <p style={{ fontSize: 12, color: C.textMuted, textAlign: "center", marginTop: 24 }}>No sources yet — add a PDF or text file</p>
                ) : papers.map(p => (
                  <SourceRow key={p.id} paper={p} onDownload={() => downloadPaper(p.id)} onRemove={() => removePaper(p.id)} />
                ))}
              </div>

              {sources.length > 0 && (
                <div style={{ margin: "0 10px 10px", padding: "9px 11px", borderRadius: 9, background: "#F3F4F6", flexShrink: 0 }}>
                  <p style={{ fontSize: 10, color: C.textSub, letterSpacing: ".07em", fontWeight: 700, marginBottom: 5, textTransform: "uppercase" }}>Cited in last answer</p>
                  {sources.map(s => <p key={s} style={{ fontSize: 11, color: C.textSub, padding: "1px 0" }}>• {s}</p>)}
                </div>
              )}
            </aside>
          ) : <CollapseStrip onClick={() => setLeftOpen(true)} title="Show sources" side="left" />}

          {/* ── CENTER: Chat ───────────────────────────────────────────── */}
          <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: C.bg, borderRight: `1px solid ${C.border}`, minWidth: 0 }}>
            <div style={{ height: 52, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Chat</span>
              <div style={{ display: "flex", gap: 2 }}>
                <IconBtn><SlidersHorizontal size={15} /></IconBtn>
                <IconBtn onClick={handleClearHistory} title="Clear history"><MessageSquareX size={15} /></IconBtn>
                <IconBtn><MoreVertical size={15} /></IconBtn>
              </div>
            </div>

            <div style={{ padding: "8px 14px", display: "flex", gap: 6, flexWrap: "wrap", background: C.surface, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
              {PRESETS.map(({ Icon: PI, label, prompt }) => (
                <Chip key={label} onClick={() => query(prompt)}><PI size={11} color={C.textMuted} /> {label}</Chip>
              ))}
            </div>

            <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "20px 14px", display: "flex", flexDirection: "column", gap: 20 }}>
              {loadingData ? (
                <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}><Loader2 size={20} color={C.textMuted} style={{ animation: "spin .8s linear infinite" }} /></div>
              ) : messages.map((m, i) => <ChatMessage key={m.id || i} message={m} />)}
              {loading && !messages[messages.length - 1]?.streaming && <ThinkingBubble pipeline={pipeline} />}
            </div>

            <div style={{ padding: "10px", background: C.bg, flexShrink: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 26, padding: "9px 9px 9px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
                <input style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: C.text }} placeholder={papers.length ? "Start typing..." : "Upload sources first, then ask questions..."}
                  value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && !e.shiftKey && query(input)} />
                {papers.length > 0 && (
                  <span style={{ fontSize: 11, color: C.textSub, background: C.bg, borderRadius: 10, padding: "2px 9px", whiteSpace: "nowrap", border: `1px solid ${C.border}` }}>
                    {papers.length} source{papers.length !== 1 ? "s" : ""}
                  </span>
                )}
                <button onClick={() => query(input)} disabled={loading || !input.trim()}
                  style={{ width: 34, height: 34, borderRadius: 17, display: "flex", alignItems: "center", justifyContent: "center", background: loading || !input.trim() ? "#E5E7EB" : C.accent, border: "none", cursor: loading || !input.trim() ? "default" : "pointer", flexShrink: 0, transition: "background .15s" }}>
                  {loading ? <Loader2 size={14} color={C.textMuted} style={{ animation: "spin .7s linear infinite" }} /> : <Send size={14} color={!input.trim() ? C.textMuted : "#fff"} />}
                </button>
              </div>
              <p style={{ textAlign: "center", fontSize: 11, color: C.textMuted, marginTop: 7 }}>Responses may be inaccurate — please verify against your sources.</p>
            </div>
          </main>

          {/* ── RIGHT: Studio ──────────────────────────────────────────── */}
          {rightOpen ? (
            <aside style={{ width: 300, flexShrink: 0, display: "flex", flexDirection: "column", background: C.surface, overflow: "hidden" }}>
              <div style={{ height: 52, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.text }}>Studio</span>
                <IconBtn onClick={() => setRightOpen(false)} title="Collapse"><PanelRightClose size={15} /></IconBtn>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 10px 8px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 7, marginBottom: 16 }}>
                  {STUDIO_CARDS.map(c => <StudioCard key={c.label} {...c} />)}
                </div>
                <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                  <span style={{ fontSize: 12, color: C.textSub, paddingLeft: 4, display: "block", marginBottom: 8 }}>Saved notes</span>
                  {[{ label: "Tree Quiz", icon: FileQuestion, time: "20d ago" }, { label: "Tree Quiz", icon: FileQuestion, time: "20d ago" }].map((n, i) => <NoteRow key={i} note={n} />)}
                  <GhostBtn onClick={() => {}} fullWidth><Plus size={13} /> Add note</GhostBtn>
                </div>
              </div>
            </aside>
          ) : <CollapseStrip onClick={() => setRightOpen(true)} title="Show studio" side="right" />}

        </div>
      </div>
      <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" style={{ display: "none" }} onChange={e => ingest([...e.target.files])} />
    </>
  );
}

export function DropZone() { return null; }
export default NotebookView;