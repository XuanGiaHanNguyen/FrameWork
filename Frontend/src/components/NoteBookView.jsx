 // src/components/NotebookView.jsx
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Brain, Upload, File, X, Send, Loader2,
  ArrowLeft, FolderOpen, Download, Trash2, MessageSquareX,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PRESETS } from "../constant";
import { readSSE, uniqueStrings } from "../utils";
import {
  uploadFiles, listFiles, deleteFile, getFileDownloadUrl,
  listMessages, clearMessages,
  queryNotebook,
} from "../api";

// ─── NOTEBOOK VIEW ────────────────────────────────────────────────────────────
export function NotebookView({ notebook, onBack, theme: t, serverStatus }) {
  const [papers,    setPapers]    = useState([]);
  const [messages,  setMessages]  = useState([]);
  const [input,     setInput]     = useState("");
  const [loading,   setLoading]   = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const [pipeline,  setPipeline]  = useState(null);
  const [sources,   setSources]   = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const fileRef = useRef();
  const chatRef = useRef();

  // ── Load files + message history from DB on mount ──────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoadingData(true);
      try {
        const [files, msgs] = await Promise.all([
          listFiles(notebook.id),
          listMessages(notebook.id),
        ]);
        if (cancelled) return;
        setPapers(files);
        setMessages(msgs.length > 0 ? msgs : [{
          role: "assistant",
          content: `Welcome to **${notebook.name}**. Upload sources and start asking questions — I'll ground my answers in your documents.`,
        }]);
      } catch (err) {
        if (!cancelled) {
          setMessages([{ role: "assistant", content: `Failed to load notebook data: ${err.message}` }]);
        }
      } finally {
        if (!cancelled) setLoadingData(false);
      }
    })();
    return () => { cancelled = true; };
  }, [notebook.id, notebook.name]);

  // Auto-scroll on new messages
  useEffect(() => {
    setTimeout(() => chatRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 80);
  }, [messages.length]);

  // ── Upload + ingest files ──────────────────────────────────────────────────
  const ingest = useCallback(async (files) => {
    if (serverStatus !== "ok") {
      setMessages(m => [...m, { role: "assistant", content: "⚠ Backend not running. Please start the server first." }]);
      return;
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    const oversized = files.filter(f => f.size > MAX_SIZE);
    const allowed   = files.filter(f => f.size <= MAX_SIZE);

    if (oversized.length > 0) {
      const names = oversized.map(f => `"${f.name}" (${(f.size / (1024 * 1024)).toFixed(1)}MB)`).join(", ");
      setMessages(m => [...m, {
        role: "assistant",
        content: `⚠ ${oversized.length} file${oversized.length > 1 ? "s" : ""} exceed the 5MB limit and were skipped: ${names}.`,
      }]);
    }

    if (allowed.length === 0) return;

    setIngesting(true);
    try {
      const { results } = await uploadFiles(notebook.id, allowed);
      const ok   = results.filter(r => r.status === "ok");
      const fail = results.filter(r => r.status !== "ok");

      // Refresh file list from DB so IDs are correct
      const fresh = await listFiles(notebook.id);
      setPapers(fresh);

      const parts = [];
      if (ok.length)   parts.push(`✓ Ingested ${ok.map(r => `"${r.name}" (${r.chunks} chunks)`).join(", ")}.`);
      if (fail.length) parts.push(`✗ Failed: ${fail.map(r => `${r.name} — ${r.reason}`).join(", ")}.`);
      setMessages(m => [...m, { role: "assistant", content: parts.join(" ") }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Upload error: ${err.message}` }]);
    } finally {
      setIngesting(false);
    }
  }, [serverStatus, notebook.id]);

  // ── Delete a file ──────────────────────────────────────────────────────────
  const removePaper = useCallback(async (fileId, name) => {
    setPapers(p => p.filter(x => x.id !== fileId)); // optimistic
    try {
      await deleteFile(notebook.id, fileId);
    } catch (err) {
      // rollback
      const fresh = await listFiles(notebook.id);
      setPapers(fresh);
      alert(`Delete failed: ${err.message}`);
    }
  }, [notebook.id]);

  // ── Download a file ────────────────────────────────────────────────────────
  const downloadPaper = useCallback(async (fileId) => {
    try {
      const { url, name } = await getFileDownloadUrl(notebook.id, fileId);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.click();
    } catch (err) {
      alert(`Download failed: ${err.message}`);
    }
  }, [notebook.id]);

  // ── Clear chat history ─────────────────────────────────────────────────────
  const handleClearHistory = useCallback(async () => {
    if (!window.confirm("Clear all chat history for this notebook?")) return;
    try {
      await clearMessages(notebook.id);
      setMessages([{
        role: "assistant",
        content: "Chat history cleared. Ask me anything about your sources.",
      }]);
    } catch (err) {
      alert(`Clear failed: ${err.message}`);
    }
  }, [notebook.id]);

  // ── RAG Query ──────────────────────────────────────────────────────────────
  const query = useCallback(async (q) => {
    if (!q.trim()) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    setLoading(true); setSources([]);

    if (serverStatus !== "ok") {
      setMessages(m => [...m, { role: "assistant", content: "⚠ Backend not running." }]);
      setLoading(false); return;
    }

    setPipeline([]);
    try {
      const resp = await queryNotebook(notebook.id, q);
      let fullText = ""; let msgAdded = false;

      for await (const event of readSSE(resp)) {
        if (event.type === "status")  { setPipeline(p => [...(p || []), event.text]); }
        if (event.type === "sources") { setSources(uniqueStrings(event.sources || [])); }
        if (event.type === "token") {
          fullText += event.token;
          if (!msgAdded) {
            setMessages(m => [...m, { role: "assistant", content: fullText, streaming: true }]);
            msgAdded = true;
          } else {
            setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: fullText } : msg));
          }
        }
        if (event.type === "done") {
          setMessages(m => m.map((msg, i) =>
            i === m.length - 1 ? { ...msg, content: event.fullText || fullText, streaming: false } : msg
          ));
        }
        if (event.type === "error") {
          setMessages(m => [...m, { role: "assistant", content: `Error: ${event.error}` }]);
        }
      }
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Connection error: ${err.message}` }]);
    } finally {
      setLoading(false);
      setPipeline(null);
    }
  }, [serverStatus, notebook.id]);

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* ── Sources sidebar ── */}
      <aside style={{
        width: 264, flexShrink: 0, display: "flex", flexDirection: "column",
        background: t.surface, borderRight: `1px solid ${t.border}`,
      }}>
        {/* Back + notebook title */}
        <div style={{ padding: "12px 12px 10px", borderBottom: `1px solid ${t.border}` }}>
          <button
            onClick={onBack}
            style={{
              display: "flex", alignItems: "center", gap: 5, background: "none", border: "none",
              cursor: "pointer", color: t.textMuted, fontSize: 11, padding: "3px 0 8px", fontFamily: "inherit",
            }}
            onMouseEnter={e => e.currentTarget.style.color = t.text}
            onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
          >
            <ArrowLeft size={11} /> All notebooks
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <FolderOpen size={14} color={t.textMuted} strokeWidth={1.6} />
            <span style={{
              fontWeight: 600, fontSize: 13, color: t.text,
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {notebook.name}
            </span>
          </div>
          <p style={{ fontSize: 10, color: t.textDim, marginTop: 3 }}>
            {loadingData ? "Loading…" : `${papers.length} source${papers.length !== 1 ? "s" : ""} · ${papers.reduce((s, p) => s + (p.chunks || 0), 0)} vectors`}
          </p>
        </div>

        {/* Drop zone */}
        <DropZone
          ingesting={ingesting} dragOver={dragOver}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); ingest([...e.dataTransfer.files]); }}
          onClick={() => fileRef.current.click()}
          theme={t}
        />
        <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" style={{ display: "none" }}
          onChange={e => ingest([...e.target.files])} />

        {/* File list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          {loadingData
            ? <p style={{ fontSize: 11, color: t.textDim, textAlign: "center", marginTop: 18 }}>Loading files…</p>
            : papers.length === 0
            ? <p style={{ fontSize: 11, color: t.textDim, textAlign: "center", marginTop: 18 }}>No sources yet</p>
            : papers.map(p => (
              <div key={p.id} style={{
                display: "flex", alignItems: "flex-start", gap: 7,
                background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 8px",
              }}>
                <File size={11} color={t.textMuted} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: t.textMuted }}>{p.chunks} chunks · {((p.size || p.sizeBytes || 0) / 1024).toFixed(1)}KB</p>
                </div>
                <button onClick={() => downloadPaper(p.id)} title="Download"
                  style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex", padding: 2 }}
                  onMouseEnter={e => e.currentTarget.style.color = t.text}
                  onMouseLeave={e => e.currentTarget.style.color = t.textDim}
                >
                  <Download size={10} />
                </button>
                <button onClick={() => removePaper(p.id, p.name)} title="Delete"
                  style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex", padding: 2 }}
                  onMouseEnter={e => e.currentTarget.style.color = t.errColor}
                  onMouseLeave={e => e.currentTarget.style.color = t.textDim}
                >
                  <X size={10} />
                </button>
              </div>
            ))
          }
        </div>

        {/* Cited sources from last query */}
        {sources.length > 0 && (
          <div style={{ margin: "0 10px 10px", padding: "8px 10px", borderRadius: 7, background: t.surface2, border: `1px solid ${t.border}` }}>
            <p style={{ fontSize: 9, color: t.textDim, marginBottom: 5, letterSpacing: ".07em" }}>CITED IN LAST ANSWER</p>
            {sources.map(s => <p key={s} style={{ fontSize: 10.5, color: t.textMuted, padding: "2px 0" }}>• {s}</p>)}
          </div>
        )}
      </aside>

      {/* ── Chat area ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg }}>
        {/* Preset bar + clear history button */}
        <div style={{
          display: "flex", gap: 6, padding: "8px 14px",
          borderBottom: `1px solid ${t.border}`, flexWrap: "wrap",
          background: t.surface, alignItems: "center",
        }}>
          {PRESETS.map(({ Icon: PI, label, prompt }) => (
            <button key={label} onClick={() => query(prompt)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
              borderRadius: 6, fontSize: 11, border: `1px solid ${t.border}`,
              background: t.surface2, color: t.textMuted, cursor: "pointer",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.border2; e.currentTarget.style.color = t.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
            >
              <PI size={12} color={t.textMuted} />{label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={handleClearHistory} title="Clear chat history" style={{
            display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
            borderRadius: 6, fontSize: 11, border: `1px solid ${t.border}`,
            background: "none", color: t.textDim, cursor: "pointer",
          }}
            onMouseEnter={e => { e.currentTarget.style.color = t.errColor; e.currentTarget.style.borderColor = t.errColor; }}
            onMouseLeave={e => { e.currentTarget.style.color = t.textDim; e.currentTarget.style.borderColor = t.border; }}
          >
            <MessageSquareX size={12} /> Clear history
          </button>
        </div>

        {/* Messages */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {loadingData
            ? <div style={{ display: "flex", justifyContent: "center", marginTop: 40 }}>
                <Loader2 size={20} color={t.textDim} style={{ animation: "spin .8s linear infinite" }} />
              </div>
            : messages.map((m, i) => <ChatMessage key={m.id || i} message={m} theme={t} />)
          }
          {loading && !messages[messages.length - 1]?.streaming && (
            <ThinkingBubble pipeline={pipeline} theme={t} />
          )}
        </div>

        {/* Input */}
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}`, background: t.surface }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 10, background: t.inputBg,
            border: `1px solid ${t.border}`, borderRadius: 12, padding: "8px 10px 8px 14px",
          }}>
            <input
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: t.text, fontFamily: "inherit" }}
              placeholder={papers.length ? "Ask about your sources…" : "Upload sources first, then ask questions…"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && query(input)}
            />
            <button
              onClick={() => query(input)} disabled={loading || !input.trim()}
              style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center",
                justifyContent: "center",
                cursor: loading || !input.trim() ? "default" : "pointer",
                background: loading || !input.trim() ? t.surface2 : t.text,
                border: `1px solid ${t.border}`,
              }}
            >
              {loading
                ? <Loader2 size={14} color={t.textMuted} style={{ animation: "spin .7s linear infinite" }} />
                : <Send size={14} color={!input.trim() ? t.textMuted : t.bg} />
              }
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

// ─── DROP ZONE ────────────────────────────────────────────────────────────────
function DropZone({ ingesting, dragOver, onDragOver, onDragLeave, onDrop, onClick, theme: t }) {
  return (
    <div
      style={{
        margin: "10px 10px 6px", borderRadius: 8,
        border: `1.5px dashed ${dragOver ? t.text : t.border2}`,
        background: dragOver ? t.surface2 : "transparent",
        padding: "12px 8px", textAlign: "center", cursor: "pointer", transition: "all .2s",
      }}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop} onClick={onClick}
    >
      {ingesting
        ? <Loader2 size={16} color={t.textMuted} style={{ margin: "0 auto 5px", display: "block", animation: "spin .7s linear infinite" }} />
        : <Upload size={16} color={dragOver ? t.text : t.textDim} style={{ margin: "0 auto 5px", display: "block" }} />}
      <p style={{ fontSize: 11, color: ingesting ? t.text : t.textMuted }}>{ingesting ? "Processing…" : "Add sources"}</p>
      <p style={{ fontSize: 10, color: t.textDim, marginTop: 1 }}>PDF · TXT · MD · max 5MB</p>
    </div>
  );
}

// ─── CHAT MESSAGE ─────────────────────────────────────────────────────────────
function ChatMessage({ message: m, theme: t }) {
  return (
    <div style={{
      display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start",
      gap: 8, alignItems: "flex-start", animation: "fadeIn .2s ease forwards",
    }}>
      {m.role === "assistant" && (
        <div style={{
          width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
          justifyContent: "center", background: t.surface2, border: `1px solid ${t.border}`,
          flexShrink: 0, marginTop: 2,
        }}>
          <Brain size={13} color={t.textMuted} strokeWidth={1.8} />
        </div>
      )}
      <div style={{
        maxWidth: "70%", borderRadius: 12, padding: "10px 14px",
        fontSize: 13, lineHeight: 1.65,
        background: m.role === "user" ? t.msgUser : t.surface,
        color:      m.role === "user" ? t.msgUserTxt : t.text,
        border:     m.role === "assistant" ? `1px solid ${t.border}` : "none",
        whiteSpace: "pre-wrap",
      }}>
        <ReactMarkdown>{m.content}</ReactMarkdown>
        {m.streaming && (
          <span style={{
            display: "inline-block", width: 8, height: 14, background: t.text,
            marginLeft: 2, animation: "blink .8s step-end infinite", verticalAlign: "text-bottom",
          }} />
        )}
      </div>
    </div>
  );
}

// ─── THINKING BUBBLE ─────────────────────────────────────────────────────────
function ThinkingBubble({ pipeline, theme: t }) {
  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
      <div style={{
        width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center",
        justifyContent: "center", background: t.surface2, border: `1px solid ${t.border}`,
        flexShrink: 0, marginTop: 2,
      }}>
        <Brain size={13} color={t.textMuted} strokeWidth={1.8} />
      </div>
      <div style={{ borderRadius: 12, padding: "10px 14px", background: t.surface, border: `1px solid ${t.border}` }}>
        {pipeline?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {pipeline.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                <div style={{
                  width: 5, height: 5, borderRadius: "50%",
                  background: i === pipeline.length - 1 ? t.text : t.textMuted, flexShrink: 0,
                }} />
                <span style={{ color: i === pipeline.length - 1 ? t.text : t.textMuted, fontFamily: "monospace" }}>{s}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 7, height: 7, borderRadius: "50%", background: t.textMuted,
                animation: `dot 1.4s ease infinite`, animationDelay: `${i * .2}s`,
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotebookView;