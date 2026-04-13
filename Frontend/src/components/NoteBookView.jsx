// src/components/NotebookView.jsx
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Brain, X, Send, Loader2,
  ArrowLeft, FolderOpen, Download, MessageSquareX,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PRESETS } from "../constant";
import { readSSE, uniqueStrings } from "../utils";
import {
  uploadFiles, listFiles, deleteFile, getFileDownloadUrl,
  listMessages, clearMessages, queryNotebook,
} from "../api";

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

  const fileRef = useRef();
  const chatRef = useRef();

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
        if (!cancelled)
          setMessages([{ role: "assistant", content: `Failed to load notebook data: ${err.message}` }]);
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
    if (serverStatus !== "ok") {
      setMessages(m => [...m, { role: "assistant", content: "⚠ Backend not running. Please start the server first." }]);
      return;
    }
    const MAX_SIZE = 5 * 1024 * 1024;
    const oversized = files.filter(f => f.size > MAX_SIZE);
    const allowed   = files.filter(f => f.size <= MAX_SIZE);
    if (oversized.length) {
      const names = oversized.map(f => `"${f.name}" (${(f.size / (1024 * 1024)).toFixed(1)} MB)`).join(", ");
      setMessages(m => [...m, { role: "assistant", content: `⚠ ${oversized.length} file${oversized.length > 1 ? "s" : ""} exceed the 5 MB limit and were skipped: ${names}.` }]);
    }
    if (!allowed.length) return;
    setIngesting(true);
    try {
      const { results } = await uploadFiles(notebook.id, allowed);
      const ok   = results.filter(r => r.status === "ok");
      const fail = results.filter(r => r.status !== "ok");
      setPapers(await listFiles(notebook.id));
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

  const removePaper = useCallback(async (fileId) => {
    setPapers(p => p.filter(x => x.id !== fileId));
    try { await deleteFile(notebook.id, fileId); }
    catch (err) {
      setPapers(await listFiles(notebook.id));
      alert(`Delete failed: ${err.message}`);
    }
  }, [notebook.id]);

  const downloadPaper = useCallback(async (fileId) => {
    try {
      const { url, name } = await getFileDownloadUrl(notebook.id, fileId);
      Object.assign(document.createElement("a"), { href: url, download: name }).click();
    } catch (err) { alert(`Download failed: ${err.message}`); }
  }, [notebook.id]);

  const handleClearHistory = useCallback(async () => {
    if (!window.confirm("Clear all chat history for this notebook?")) return;
    try {
      await clearMessages(notebook.id);
      setMessages([{ role: "assistant", content: "Chat history cleared. Ask me anything about your sources." }]);
    } catch (err) { alert(`Clear failed: ${err.message}`); }
  }, [notebook.id]);

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
        if (event.type === "status")  setPipeline(p => [...(p || []), event.text]);
        if (event.type === "sources") setSources(uniqueStrings(event.sources || []));
        if (event.type === "token") {
          fullText += event.token;
          if (!msgAdded) {
            setMessages(m => [...m, { role: "assistant", content: fullText, streaming: true }]);
            msgAdded = true;
          } else {
            setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: fullText } : msg));
          }
        }
        if (event.type === "done")
          setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: event.fullText || fullText, streaming: false } : msg));
        if (event.type === "error")
          setMessages(m => [...m, { role: "assistant", content: `Error: ${event.error}` }]);
      }
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Connection error: ${err.message}` }]);
    } finally {
      setLoading(false);
      setPipeline(null);
    }
  }, [serverStatus, notebook.id]);

  return (
    <div style={{ display: "flex", width: "100%", height: "100%", overflow: "hidden", background: "#F0F4F9" }}>

      {/* ══════════════════════════════════════
          COLUMN 1 — Sources
      ══════════════════════════════════════ */}
      <aside style={{
        width: 340, flexShrink: 0,
        display: "flex", flexDirection: "column",
        background: "#FFFFFF", borderRight: "1px solid #E0E0E0",
        position: "relative", overflow: "hidden",
      }}>

        {/* Header */}
        <div style={{
          height: 52, padding: "0 14px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          borderBottom: "1px solid #E0E0E0", flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>Sources</span>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#5F6368", display: "flex", padding: 4, borderRadius: 4 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="9" y1="3" x2="9" y2="21"/>
            </svg>
          </button>
        </div>

        {/* Back + notebook name */}
        <div style={{ padding: "10px 12px 8px", flexShrink: 0 }}>
          <button
            onClick={onBack}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              background: "none", border: "none", cursor: "pointer",
              color: "#5F6368", fontSize: 12, padding: "3px 6px",
              borderRadius: 20, fontFamily: "inherit", marginBottom: 8,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "#F1F3F4"; e.currentTarget.style.color = "#1F1F1F"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = "#5F6368"; }}
          >
            <ArrowLeft size={12} /> All notebooks
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "#E8F0FE", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <FolderOpen size={13} color="#1A73E8" strokeWidth={1.7} />
            </div>
            <div style={{ minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: "#1F1F1F", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {notebook.name}
              </p>
            </div>
          </div>
        </div>

        {/* Add source button */}
        <div style={{ padding: "0 12px 8px", flexShrink: 0 }}>
          <button
            onClick={() => fileRef.current.click()}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
              width: "100%", padding: "8px 0", borderRadius: 24,
              fontSize: 13, fontWeight: 500, border: "1px solid #DADCE0",
              background: "#FFFFFF", color: "#1F1F1F", cursor: "pointer", fontFamily: "inherit",
            }}
            onMouseEnter={e => e.currentTarget.style.background = "#F1F3F4"}
            onMouseLeave={e => e.currentTarget.style.background = "#FFFFFF"}
          >
            {ingesting
              ? <Loader2 size={13} style={{ animation: "spin .7s linear infinite" }} />
              : <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>}
            {ingesting ? "Processing…" : "Add source"}
          </button>
        </div>
        <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" style={{ display: "none" }}
          onChange={e => ingest([...e.target.files])} />

        {/* Web search pill */}
        <div style={{
          margin: "0 12px 6px", display: "flex", alignItems: "center", gap: 8,
          background: "#F1F3F4", borderRadius: 24, padding: "6px 14px", flexShrink: 0,
        }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#5F6368" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <span style={{ fontSize: 12, color: "#5F6368" }}>Search for new sources on the web</span>
        </div>

        {/* Select all */}
        <div style={{ padding: "4px 16px 8px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: "#3C4043" }}>Select all sources</span>
          <div style={{ width: 18, height: 18, borderRadius: 4, background: "#1A73E8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
        </div>

        {/* Drag-over hint */}
        {dragOver && (
          <div style={{ margin: "0 12px 6px", borderRadius: 10, border: "1.5px dashed #1A73E8", background: "#E8F0FE", padding: 8, textAlign: "center", flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: "#1A73E8" }}>Drop files here</p>
          </div>
        )}

        {/* Full-column drag target */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); ingest([...e.dataTransfer.files]); }}
          style={{ position: "absolute", inset: 0, zIndex: dragOver ? 5 : -1 }}
        />

        {/* File list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 6px 8px", display: "flex", flexDirection: "column", gap: 1 }}>
          {loadingData ? (
            <p style={{ fontSize: 12, color: "#80868B", textAlign: "center", marginTop: 20 }}>Loading files…</p>
          ) : papers.length === 0 ? (
            <p style={{ fontSize: 12, color: "#80868B", textAlign: "center", marginTop: 20 }}>No sources yet</p>
          ) : papers.map(p => (
            <div key={p.id}
              style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 8 }}
              onMouseEnter={e => e.currentTarget.style.background = "#F1F3F4"}
              onMouseLeave={e => e.currentTarget.style.background = "transparent"}
            >
              <div style={{ width: 26, height: 32, borderRadius: 4, flexShrink: 0, background: "#FDECEA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 8, fontWeight: 800, color: "#C5221F" }}>PDF</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 12, color: "#1F1F1F", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                <p style={{ fontSize: 10, color: "#80868B", marginTop: 1 }}>{p.chunks} chunks · {((p.size || p.sizeBytes || 0) / 1024).toFixed(1)} KB</p>
              </div>
              <button onClick={() => downloadPaper(p.id)} title="Download"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#80868B", display: "flex", padding: 3, borderRadius: 20, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = "#1F1F1F"}
                onMouseLeave={e => e.currentTarget.style.color = "#80868B"}
              ><Download size={11} /></button>
              <button onClick={() => removePaper(p.id)} title="Remove"
                style={{ background: "none", border: "none", cursor: "pointer", color: "#80868B", display: "flex", padding: 3, borderRadius: 20, flexShrink: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = "#C5221F"}
                onMouseLeave={e => e.currentTarget.style.color = "#80868B"}
              ><X size={11} /></button>
            </div>
          ))}
        </div>

        {/* Cited sources */}
        {sources.length > 0 && (
          <div style={{ margin: "0 10px 10px", padding: "9px 11px", borderRadius: 8, background: "#E8F0FE", flexShrink: 0 }}>
            <p style={{ fontSize: 10, color: "#1A73E8", letterSpacing: ".07em", fontWeight: 600, marginBottom: 5 }}>CITED IN LAST ANSWER</p>
            {sources.map(s => <p key={s} style={{ fontSize: 11, color: "#1558B0", padding: "2px 0" }}>• {s}</p>)}
          </div>
        )}
      </aside>

      {/* ══════════════════════════════════════
          COLUMN 2 — Conversation
      ══════════════════════════════════════ */}
      <main style={{
        flex: 1, display: "flex", flexDirection: "column",
        overflow: "hidden", background: "#F0F4F9",
        borderRight: "1px solid #E0E0E0",
      }}>

        {/* Header */}
        <div style={{
          height: 52, padding: "0 16px",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#FFFFFF", borderBottom: "1px solid #E0E0E0", flexShrink: 0,
        }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#1F1F1F" }}>Conversation</span>
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#5F6368", display: "flex", padding: 6, borderRadius: 20 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="4" y1="6" x2="20" y2="6" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="18" x2="20" y2="18" />
                <circle cx="8" cy="6" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
                <circle cx="16" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
                <circle cx="8" cy="18" r="2" fill="white" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#5F6368", display: "flex", padding: 6, borderRadius: 20 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
              </svg>
            </button>
          </div>
        </div>

        {/* Preset chips */}
        <div style={{
          padding: "8px 14px", display: "flex", gap: 6, flexWrap: "wrap",
          background: "#F0F4F9", borderBottom: "1px solid #E0E0E0", flexShrink: 0, alignItems: "center",
        }}>
          {PRESETS.map(({ Icon: PI, label, prompt }) => (
            <button key={label} onClick={() => query(prompt)} style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "5px 14px", borderRadius: 20, fontSize: 12,
              border: "1px solid #DADCE0", background: "#FFFFFF", color: "#3C4043",
              cursor: "pointer", fontFamily: "inherit",
            }}
              onMouseEnter={e => e.currentTarget.style.background = "#F1F3F4"}
              onMouseLeave={e => e.currentTarget.style.background = "#FFFFFF"}
            >
              <PI size={12} color="#5F6368" />{label}
            </button>
          ))}
          <div style={{ flex: 1 }} />
          <button onClick={handleClearHistory} style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "5px 12px", borderRadius: 20, fontSize: 12,
            border: "1px solid #DADCE0", background: "#FFFFFF", color: "#5F6368",
            cursor: "pointer", fontFamily: "inherit",
          }}
            onMouseEnter={e => { e.currentTarget.style.color = "#C5221F"; e.currentTarget.style.borderColor = "#C5221F"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#5F6368"; e.currentTarget.style.borderColor = "#DADCE0"; }}
          >
            <MessageSquareX size={12} /> Clear history
          </button>
        </div>

        {/* Messages */}
        <div ref={chatRef} style={{
          flex: 1, overflowY: "auto", padding: "10px 72px",
          display: "flex", flexDirection: "column", gap: 20,
        }}>
          {loadingData ? (
            <div style={{ display: "flex", justifyContent: "center", marginTop: 60 }}>
              <Loader2 size={22} color="#80868B" style={{ animation: "spin .8s linear infinite" }} />
            </div>
          ) : messages.map((m, i) => (
            <ChatMessage key={m.id || i} message={m} />
          ))}
          {loading && !messages[messages.length - 1]?.streaming && (
            <ThinkingBubble pipeline={pipeline} />
          )}
        </div>

        {/* Input area */}
        <div style={{ padding: "10px 72px 16px", background: "#F0F4F9", flexShrink: 0 }}>
          <p style={{ textAlign: "center", fontSize: 11, color: "#80868B", marginBottom: 10 }}>
            {new Date().toLocaleDateString(undefined, { weekday: "long" })} •{" "}
            {new Date().toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
          </p>

          <div style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "#FFFFFF", border: "1px solid #DADCE0",
            borderRadius: 28, padding: "10px 10px 10px 20px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          }}>
            <input
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 14, color: "#1F1F1F", fontFamily: "inherit" }}
              placeholder={papers.length ? "Start typing…" : "Upload sources first, then ask questions…"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && query(input)}
            />
            {papers.length > 0 && (
              <span style={{ fontSize: 12, color: "#5F6368", background: "#F1F3F4", borderRadius: 12, padding: "2px 10px", whiteSpace: "nowrap", border: "1px solid #DADCE0" }}>
                {papers.length} source{papers.length !== 1 ? "s" : ""}
              </span>
            )}
            <button
              onClick={() => query(input)}
              disabled={loading || !input.trim()}
              style={{
                width: 36, height: 36, borderRadius: 18,
                display: "flex", alignItems: "center", justifyContent: "center",
                background: loading || !input.trim() ? "#E8EAED" : "#1F1F1F",
                border: "none", cursor: loading || !input.trim() ? "default" : "pointer", flexShrink: 0,
              }}
            >
              {loading
                ? <Loader2 size={15} color="#80868B" style={{ animation: "spin .7s linear infinite" }} />
                : <Send size={15} color={!input.trim() ? "#80868B" : "#FFFFFF"} />}
            </button>
          </div>

          <p style={{ textAlign: "center", fontSize: 11, color: "#80868B", marginTop: 8 }}>
            Responses are grounded in your sources but may not always be accurate — verify important answers.
          </p>
        </div>
      </main>
    </div>
  );
}

// ─── CHAT MESSAGE ─────────────────────────────────────────────────────────────
function ChatMessage({ message: m }) {
  const isUser = m.role === "user";
  return (
    <div style={{ display: "flex", flexDirection: isUser ? "row-reverse" : "row", gap: 10, alignItems: "flex-start" }}>
      {!isUser && (
        <div style={{
          width: 30, height: 30, borderRadius: "50%", flexShrink: 0, marginTop: 2,
          background: "#E8F0FE", border: "1px solid rgba(26,115,232,0.2)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Brain size={14} color="#1A73E8" strokeWidth={1.8} />
        </div>
      )}
      <div>
        <div style={{
          maxWidth: 560,
          borderRadius: isUser ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
          padding: "10px 16px", fontSize: 14, lineHeight: 1.65,
          background: isUser ? "#1A73E8" : "#FFFFFF",
          color:      isUser ? "#FFFFFF"  : "#1F1F1F",
          border:     !isUser ? "1px solid #E0E0E0" : "none",
          boxShadow:  !isUser ? "0 1px 2px rgba(0,0,0,0.05)" : "none",
        }}>
          <ReactMarkdown>{m.content}</ReactMarkdown>
          {m.streaming && (
            <span style={{
              display: "inline-block", width: 2, height: 14,
              background: isUser ? "#FFFFFF" : "#1A73E8",
              marginLeft: 2, animation: "blink .8s step-end infinite", verticalAlign: "text-bottom",
            }} />
          )}
        </div>

        {/* Assistant action row */}
        {!isUser && !m.streaming && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 6, paddingLeft: 4 }}>
            <button style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 20, fontSize: 11,
              border: "1px solid #DADCE0", background: "transparent",
              color: "#5F6368", cursor: "pointer", fontFamily: "inherit",
            }}>
              ✎ Save to notes
            </button>
            {/* Copy */}
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#80868B", display: "flex", padding: 4, borderRadius: 20 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
              </svg>
            </button>
            {/* Thumbs up */}
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#80868B", display: "flex", padding: 4, borderRadius: 20 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z" />
                <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3" />
              </svg>
            </button>
            {/* Thumbs down */}
            <button style={{ background: "none", border: "none", cursor: "pointer", color: "#80868B", display: "flex", padding: 4, borderRadius: 20 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z" />
                <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17" />
              </svg>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── THINKING BUBBLE ─────────────────────────────────────────────────────────
function ThinkingBubble({ pipeline }) {
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
      <div style={{
        width: 30, height: 30, borderRadius: "50%", flexShrink: 0, marginTop: 2,
        background: "#E8F0FE", border: "1px solid rgba(26,115,232,0.2)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Brain size={14} color="#1A73E8" strokeWidth={1.8} />
      </div>
      <div style={{
        borderRadius: "4px 18px 18px 18px", padding: "10px 16px",
        background: "#FFFFFF", border: "1px solid #E0E0E0",
        boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
      }}>
        {pipeline?.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {pipeline.map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: i === pipeline.length - 1 ? "#1A73E8" : "#80868B", flexShrink: 0 }} />
                <span style={{ color: i === pipeline.length - 1 ? "#1F1F1F" : "#80868B", fontFamily: "monospace" }}>{s}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: "flex", gap: 5 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#80868B", animation: "dot 1.4s ease infinite", animationDelay: `${i * .2}s` }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function DropZone() { return null; }
export default NotebookView;