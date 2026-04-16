// src/components/NotebookView.jsx
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Brain, X, Send, Loader2,
  Download, MessageSquareX,
  ArrowLeft, ChevronDown, Globe, Sparkles, Search,
  Plus, MoreVertical, SlidersHorizontal,
  FileText, Map, FileQuestion, Table,
  PanelLeftClose, PanelRightClose, Check,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import { PRESETS } from "../constant";
import { readSSE, uniqueStrings } from "../utils";
import {
  uploadFiles, listFiles, deleteFile, getFileDownloadUrl,
  listMessages, clearMessages, queryNotebook,
} from "../api";

// ─── STUDIO CARDS DATA ────────────────────────────────────────────────────────
const STUDIO_CARDS = [
  { icon: Map,      label: "Mind Map",   beta: false },
  { icon: FileText, label: "Reports",    beta: false },
  { icon: Table,    label: "Data Table", beta: false },
];

// ─── REUSABLE MINI COMPONENTS ─────────────────────────────────────────────────

function IconBtn({ onClick, title, children, size = 32 }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{ width: size, height: size }}
      className="rounded-full border-none bg-transparent hover:bg-gray-100 cursor-pointer flex items-center justify-center text-gray-500 transition-colors duration-150 shrink-0"
    >
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children, fullWidth }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center justify-center gap-1.5 ${fullWidth ? "w-full" : ""} px-4 py-2 rounded-full text-[13px] font-medium border border-gray-200 bg-white hover:bg-gray-50 text-gray-900 cursor-pointer transition-colors duration-150`}
    >
      {children}
    </button>
  );
}

function Chip({ onClick, children }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-3 py-1 rounded-2xl text-xs border border-gray-200 bg-white hover:bg-gray-100 text-gray-500 cursor-pointer transition-colors duration-150"
    >
      {children}
    </button>
  );
}

function CollapseStrip({ onClick, title, side }) {
  return (
    <div
      className={`w-[38px] shrink-0 flex flex-col items-center pt-3 bg-white ${
        side === "left" ? "border-r" : "border-l"
      } border-gray-200`}
    >
      <button
        onClick={onClick}
        title={title}
        className="w-[30px] h-[30px] rounded-full border-none bg-transparent hover:bg-gray-100 cursor-pointer flex items-center justify-center text-gray-500 transition-colors duration-150"
      >
        {side === "left" ? <PanelRightClose size={15} /> : <PanelLeftClose size={15} />}
      </button>
    </div>
  );
}

function SourceRow({ paper: p, onDownload, onRemove }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors duration-150">
      <div className="w-[26px] h-[34px] rounded shrink-0 bg-gray-100 border border-gray-200 flex items-center justify-center">
        <span className="text-[7px] font-extrabold text-gray-500 tracking-wide">PDF</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-900 font-medium truncate">{p.name}</p>
        <p className="text-[11px] text-gray-400 mt-px">
          {p.chunks} chunks · {((p.size || p.sizeBytes || 0) / 1024).toFixed(1)} KB
        </p>
      </div>
      <div className="w-[18px] h-[18px] rounded-[3px] bg-gray-700 flex items-center justify-center shrink-0">
        <Check size={11} color="white" strokeWidth={3} />
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDownload(); }}
        title="Download"
        className="bg-transparent border-none cursor-pointer text-gray-400 flex p-0.5 hover:text-gray-600"
      >
        <Download size={12} />
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
        title="Remove"
        className="bg-transparent border-none cursor-pointer text-gray-400 flex p-0.5 hover:text-gray-600"
      >
        <X size={12} />
      </button>
    </div>
  );
}

function StudioCard({ icon: Icon, label, beta }) {
  return (
    <button className="relative flex items-center gap-2 px-3 py-[11px] rounded-xl bg-gray-100 hover:bg-[#EBEBEB] border-none cursor-pointer text-left transition-colors duration-150">
      <Icon size={16} className="text-gray-500" strokeWidth={1.8} />
      <span className="text-xs font-medium text-gray-900">{label}</span>
      {beta && (
        <span className="absolute top-1 right-1.5 text-[8px] font-bold text-gray-400 bg-gray-200 rounded-[3px] px-1 py-px tracking-wider">
          BETA
        </span>
      )}
    </button>
  );
}

function NoteRow({ note }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-[9px] cursor-pointer hover:bg-gray-50 mb-0.5 transition-colors duration-150">
      <div className="w-[34px] h-[34px] rounded-[7px] bg-gray-100 shrink-0 flex items-center justify-center">
        <note.icon size={15} className="text-gray-500" strokeWidth={1.8} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-gray-900 font-medium">{note.label}</p>
        <p className="text-[11px] text-gray-400">2 sources · {note.time}</p>
      </div>
      <IconBtn size={28}><MoreVertical size={13} /></IconBtn>
    </div>
  );
}

// ─── CHAT MESSAGE ─────────────────────────────────────────────────────────────
function ChatMessage({ message: m }) {
  const isUser = m.role === "user";
  return (
    <div
      className={`flex gap-2.5 items-start animate-[fadeIn_.2s_ease] ${isUser ? "flex-row-reverse" : "flex-row"}`}
    >
      {!isUser && (
        <div className="w-[30px] h-[30px] rounded-full shrink-0 mt-0.5 bg-gray-200 border border-gray-200 flex items-center justify-center">
          <Brain size={13} className="text-gray-500" strokeWidth={1.8} />
        </div>
      )}
      <div className={isUser ? "max-w-[460px]" : "max-w-[560px]"}>
        <div
          className={`text-sm leading-relaxed ${
            isUser
              ? "bg-gray-700 text-white rounded-[18px_18px_5px_18px] px-4 py-2.5"
              : "bg-white text-gray-900 border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-[5px_18px_18px_18px] px-4 py-[11px]"
          }`}
        >
          <div className="prose-sm prose-p:mb-[0.45em] prose-p:last:mb-0 prose-ul:pl-5 prose-ul:mb-[0.45em] prose-li:mb-[0.2em] prose-strong:font-semibold prose-headings:font-semibold prose-code:bg-gray-100 prose-code:px-1 prose-code:rounded prose-code:text-[0.84em] prose-pre:bg-gray-100 prose-pre:p-3 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:text-[0.82em] prose-pre:mb-[0.45em] prose-a:text-gray-400 prose-a:no-underline hover:prose-a:underline">
            <ReactMarkdown>{m.content}</ReactMarkdown>
          </div>
          {m.streaming && (
            <span className="inline-block w-0.5 h-3.5 bg-current ml-0.5 align-text-bottom animate-[blink_.8s_step-end_infinite]" />
          )}
        </div>
        {!isUser && !m.streaming && (
          <div className="flex items-center gap-1 mt-1.5 pl-0.5">
            <Chip onClick={() => {}}>✎ Save to notes</Chip>
            <IconBtn size={28} title="Copy">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2"/>
                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
              </svg>
            </IconBtn>
            <IconBtn size={28} title="Good">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 9V5a3 3 0 00-3-3l-4 9v11h11.28a2 2 0 002-1.7l1.38-9a2 2 0 00-2-2.3H14z"/>
                <path d="M7 22H4a2 2 0 01-2-2v-7a2 2 0 012-2h3"/>
              </svg>
            </IconBtn>
            <IconBtn size={28} title="Bad">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10 15v4a3 3 0 003 3l4-9V2H5.72a2 2 0 00-2 1.7l-1.38 9a2 2 0 002 2.3H10z"/>
                <path d="M17 2h2.67A2.31 2.31 0 0122 4v7a2.31 2.31 0 01-2.33 2H17"/>
              </svg>
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
    <div className="flex gap-2.5 items-start animate-[fadeIn_.2s_ease]">
      <div className="w-[30px] h-[30px] rounded-full shrink-0 mt-0.5 bg-gray-200 border border-gray-200 flex items-center justify-center">
        <Brain size={13} className="text-gray-500" strokeWidth={1.8} />
      </div>
      <div className="bg-white border border-gray-200 shadow-[0_1px_2px_rgba(0,0,0,0.04)] rounded-[5px_18px_18px_18px] px-4 py-[11px]">
        {pipeline?.length ? (
          <div className="flex flex-col gap-1">
            {pipeline.map((s, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <div
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    i === pipeline.length - 1
                      ? "bg-gray-700 animate-[pulse_1s_ease_infinite]"
                      : "bg-gray-300"
                  }`}
                />
                <span className={`font-mono ${i === pipeline.length - 1 ? "text-gray-900" : "text-gray-400"}`}>
                  {s}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex gap-1 items-center">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-[7px] h-[7px] rounded-full bg-gray-400 animate-[dot_1.4s_ease_infinite]"
                style={{ animationDelay: `${i * 0.2}s` }}
              />
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
    if (serverStatus !== "ok") {
      setMessages((m) => [...m, { role: "assistant", content: "⚠ Backend not running." }]);
      return;
    }
    const MAX = 5 * 1024 * 1024;
    const oversized = files.filter((f) => f.size > MAX);
    const allowed   = files.filter((f) => f.size <= MAX);
    if (oversized.length)
      setMessages((m) => [...m, { role: "assistant", content: `⚠ Skipped (>5 MB): ${oversized.map((f) => f.name).join(", ")}.` }]);
    if (!allowed.length) return;
    setIngesting(true);
    try {
      const { results } = await uploadFiles(notebook.id, allowed);
      const ok   = results.filter((r) => r.status === "ok");
      const fail = results.filter((r) => r.status !== "ok");
      setPapers(await listFiles(notebook.id));
      const parts = [];
      if (ok.length)   parts.push(`✓ Ingested ${ok.map((r) => `"${r.name}"`).join(", ")}.`);
      if (fail.length) parts.push(`✗ Failed: ${fail.map((r) => r.name).join(", ")}.`);
      setMessages((m) => [...m, { role: "assistant", content: parts.join(" ") }]);
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `Upload error: ${err.message}` }]);
    } finally {
      setIngesting(false);
    }
  }, [serverStatus, notebook.id]);

  const removePaper = useCallback(async (fileId) => {
    setPapers((p) => p.filter((x) => x.id !== fileId));
    try { await deleteFile(notebook.id, fileId); }
    catch (err) { setPapers(await listFiles(notebook.id)); alert(`Delete failed: ${err.message}`); }
  }, [notebook.id]);

  const downloadPaper = useCallback(async (fileId) => {
    try {
      const { url, name } = await getFileDownloadUrl(notebook.id, fileId);
      Object.assign(document.createElement("a"), { href: url, download: name }).click();
    } catch (err) { alert(`Download failed: ${err.message}`); }
  }, [notebook.id]);

  const handleClearHistory = useCallback(async () => {
    if (!window.confirm("Clear all chat history?")) return;
    try {
      await clearMessages(notebook.id);
      setMessages([{ role: "assistant", content: "Chat history cleared." }]);
    } catch (err) { alert(`Clear failed: ${err.message}`); }
  }, [notebook.id]);

  const query = useCallback(async (q) => {
    if (!q.trim()) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }]);
    setLoading(true);
    setSources([]);
    if (serverStatus !== "ok") {
      setMessages((m) => [...m, { role: "assistant", content: "⚠ Backend not running." }]);
      setLoading(false);
      return;
    }
    setPipeline([]);
    try {
      const resp = await queryNotebook(notebook.id, q);
      let fullText = ""; let msgAdded = false;
      for await (const event of readSSE(resp)) {
        if (event.type === "status")  setPipeline((p) => [...(p || []), event.text]);
        if (event.type === "sources") setSources(uniqueStrings(event.sources || []));
        if (event.type === "token") {
          fullText += event.token;
          if (!msgAdded) { setMessages((m) => [...m, { role: "assistant", content: fullText, streaming: true }]); msgAdded = true; }
          else setMessages((m) => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: fullText } : msg));
        }
        if (event.type === "done")  setMessages((m) => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: event.fullText || fullText, streaming: false } : msg));
        if (event.type === "error") setMessages((m) => [...m, { role: "assistant", content: `Error: ${event.error}` }]);
      }
    } catch (err) {
      setMessages((m) => [...m, { role: "assistant", content: `Connection error: ${err.message}` }]);
    } finally { setLoading(false); setPipeline(null); }
  }, [serverStatus, notebook.id]);

  return (
    <div className="flex flex-col w-full h-full bg-gray-100 font-sans">
      {/* Custom keyframes — kept minimal since Tailwind doesn't ship these by default */}
      <style>{`
        @keyframes blink  { 0%,100%{opacity:1;}50%{opacity:0;} }
        @keyframes dot    { 0%,80%,100%{transform:scale(0.6);opacity:0.4;}40%{transform:scale(1);opacity:1;} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(4px);}to{opacity:1;transform:translateY(0);} }
      `}</style>

      <div className="flex-1 flex overflow-hidden">

        {/* ── LEFT: Sources ──────────────────────────────────────────── */}
        {leftOpen ? (
          <aside className="w-[300px] shrink-0 flex flex-col bg-white border-r border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="h-[52px] px-4 flex items-center justify-between border-b border-gray-200 shrink-0">
              <span className="text-[13px] font-semibold text-gray-900">Sources</span>
              <IconBtn onClick={() => setLeftOpen(false)} title="Collapse">
                <PanelLeftClose size={15} />
              </IconBtn>
            </div>

            {/* Add sources button */}
            <div className="px-3.5 pt-3 pb-2 shrink-0">
              <GhostBtn onClick={() => fileRef.current.click()} fullWidth>
                {ingesting
                  ? <Loader2 size={13} className="animate-spin" />
                  : <Plus size={13} />}
                {ingesting ? "Processing…" : "Add sources"}
              </GhostBtn>
            </div>

            {/* Web search bar */}
            <div className="px-3.5 pb-2.5 shrink-0">
              <div className="border border-gray-200 rounded-xl bg-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-[7px]">
                  <Search size={13} className="text-gray-400" />
                  <input
                    readOnly
                    placeholder="Search the web for sources"
                    className="flex-1 border-none outline-none bg-transparent text-xs text-gray-400"
                  />
                </div>
                <div className="flex items-center gap-1 px-2 py-[5px] border-t border-gray-100">
                  {["web", "ai"].map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setWebMode(mode)}
                      className={`flex items-center gap-1 px-2 py-0.5 rounded-xl border-none text-[11px] font-medium cursor-pointer ${
                        webMode === mode ? "bg-gray-200 text-gray-900" : "bg-transparent text-gray-400"
                      }`}
                    >
                      {mode === "web" ? <><Globe size={10} /> Web</> : <Sparkles size={10} />}
                      <ChevronDown size={9} />
                    </button>
                  ))}
                  <div className="flex-1" />
                  <button className="w-[22px] h-[22px] rounded-full bg-gray-200 border-none cursor-pointer flex items-center justify-center">
                    <ArrowLeft size={11} className="text-gray-500 rotate-180" />
                  </button>
                </div>
              </div>
            </div>

            {/* Select all */}
            <div className="px-3.5 pb-2 flex items-center justify-between shrink-0">
              <span className="text-xs text-gray-500">Select all sources</span>
              <div
                onClick={() => setAllSelected((a) => !a)}
                className={`w-[18px] h-[18px] rounded cursor-pointer flex items-center justify-center ${
                  allSelected ? "bg-gray-700" : "border-2 border-gray-400 bg-transparent"
                }`}
              >
                {allSelected && <Check size={11} color="white" strokeWidth={3} />}
              </div>
            </div>

            {dragOver && (
              <div className="mx-3.5 mb-2 rounded-lg border-[1.5px] border-dashed border-gray-500 bg-gray-50 p-2.5 text-center shrink-0">
                <p className="text-xs text-gray-500">Drop files here</p>
              </div>
            )}

            {/* Drop zone overlay */}
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); ingest([...e.dataTransfer.files]); }}
              className={`absolute inset-0 ${dragOver ? "z-[5]" : "-z-[1]"}`}
            />

            {/* Source list */}
            <div className="flex-1 overflow-y-auto px-1.5 pb-2">
              {loadingData ? (
                <div className="flex justify-center pt-6">
                  <Loader2 size={17} className="text-gray-400 animate-spin" />
                </div>
              ) : papers.length === 0 ? (
                <p className="text-xs text-gray-400 text-center mt-6">
                  No sources yet — add a PDF or text file
                </p>
              ) : (
                papers.map((p) => (
                  <SourceRow
                    key={p.id}
                    paper={p}
                    onDownload={() => downloadPaper(p.id)}
                    onRemove={() => removePaper(p.id)}
                  />
                ))
              )}
            </div>

            {/* Cited sources */}
            {sources.length > 0 && (
              <div className="mx-2.5 mb-2.5 p-2.5 rounded-[9px] bg-gray-100 shrink-0">
                <p className="text-[10px] text-gray-500 tracking-widest font-bold mb-1 uppercase">
                  Cited in last answer
                </p>
                {sources.map((s) => (
                  <p key={s} className="text-[11px] text-gray-500 py-px">• {s}</p>
                ))}
              </div>
            )}
          </aside>
        ) : (
          <CollapseStrip onClick={() => setLeftOpen(true)} title="Show sources" side="left" />
        )}

        {/* ── CENTER: Chat ───────────────────────────────────────────── */}
        <main className="flex-1 flex flex-col overflow-hidden bg-gray-100 border-r border-gray-200 min-w-0">
          {/* Chat header */}
          <div className="h-[52px] px-4 flex items-center justify-between bg-white border-b border-gray-200 shrink-0">
            <span className="text-[13px] font-semibold text-gray-900">Chat</span>
            <div className="flex gap-0.5">
              <IconBtn><SlidersHorizontal size={15} /></IconBtn>
              <IconBtn onClick={handleClearHistory} title="Clear history">
                <MessageSquareX size={15} />
              </IconBtn>
              <IconBtn><MoreVertical size={15} /></IconBtn>
            </div>
          </div>
        

          {/* Messages */}
          <div
            ref={chatRef}
            className="flex-1 overflow-y-auto px-3.5 py-5 flex flex-col gap-5"
          >
            {loadingData ? (
              <div className="flex justify-center mt-16">
                <Loader2 size={20} className="text-gray-400 animate-spin" />
              </div>
            ) : (
              messages.map((m, i) => <ChatMessage key={m.id || i} message={m} />)
            )}
            {loading && !messages[messages.length - 1]?.streaming && (
              <ThinkingBubble pipeline={pipeline} />
            )}
          </div>

          {/* Input bar */}
          <div className="p-2.5 bg-gray-100 shrink-0">
            <div className="flex items-center gap-2.5 bg-white border border-gray-200 rounded-[26px] py-[9px] pl-4 pr-[9px] shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
              <input
                className="flex-1 bg-transparent border-none outline-none text-sm text-gray-900 placeholder:text-gray-400"
                placeholder={papers.length ? "Start typing..." : "Upload sources first, then ask questions..."}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && query(input)}
              />
              {papers.length > 0 && (
                <span className="text-[11px] text-gray-500 bg-gray-100 rounded-xl px-2.5 py-0.5 whitespace-nowrap border border-gray-200">
                  {papers.length} source{papers.length !== 1 ? "s" : ""}
                </span>
              )}
              <button
                onClick={() => query(input)}
                disabled={loading || !input.trim()}
                className={`w-[34px] h-[34px] rounded-full flex items-center justify-center border-none shrink-0 transition-colors duration-150 ${
                  loading || !input.trim()
                    ? "bg-gray-200 cursor-default"
                    : "bg-gray-700 cursor-pointer"
                }`}
              >
                {loading
                  ? <Loader2 size={14} className="text-gray-400 animate-spin" />
                  : <Send size={14} color={!input.trim() ? "#9CA3AF" : "#fff"} />}
              </button>
            </div>
            <p className="text-center text-[11px] text-gray-400 mt-1.5">
              Responses may be inaccurate — please verify against your sources.
            </p>
          </div>
        </main>

        {/* ── RIGHT: Studio ──────────────────────────────────────────── */}
        {rightOpen ? (
          <aside className="w-[300px] shrink-0 flex flex-col bg-white overflow-hidden">
            <div className="h-[52px] px-4 flex items-center justify-between border-b border-gray-200 shrink-0">
              <span className="text-[13px] font-semibold text-gray-900">Studio</span>
              <IconBtn onClick={() => setRightOpen(false)} title="Collapse">
                <PanelRightClose size={15} />
              </IconBtn>
            </div>
            <div className="flex-1 overflow-y-auto px-2.5 pt-3 pb-2">
              <div className="grid grid-cols-1 gap-[7px] mb-4">
                {STUDIO_CARDS.map((c) => <StudioCard key={c.label} {...c} />)}
              </div>
              {/* Preset chips */}
              <div className=" border-gray-200 border-t py-3 bg-white shrink-0">
                <span className="text-xs text-gray-500 pl-1 block mb-2">
                  Prompts 
                </span>

                {PRESETS.map(({ Icon, label, prompt }, i) => (
                  <button
                    key={i}
                    onClick={() => query(prompt)}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-gray-50 transition"
                  >
                    {/* Left side */}
                    <div className="flex items-center gap-2">
                      <Icon size={14} className="text-gray-400" />
                      <span className="text-sm text-gray-700">{label}</span>
                    </div>
                  </button>
                ))}
                {/* Add sources button */}
              <div className="px-4 pt-3 pb-2 shrink-0">
                <GhostBtn fullWidth>
                  <Plus size={13} />
                  Add prompts 
                </GhostBtn>
              </div>
              </div>
              
            </div>
          </aside>
        ) : (
          <CollapseStrip onClick={() => setRightOpen(true)} title="Show studio" side="right" />
        )}

      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md"
        className="hidden"
        onChange={(e) => ingest([...e.target.files])}
      />
    </div>
  );
}

export function DropZone() { return null; }
export default NotebookView;