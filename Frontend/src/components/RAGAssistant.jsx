import { useState, useRef, useEffect } from "react";
import {
  FolderOpen, MoreHorizontal, Trash2, FileText, Hash,
  Clock, ChevronRight, Plus, Search, Check, X, Database,
} from "lucide-react";
import { DEFAULT_NOTEBOOKS } from "../constant";
import { formatDate } from "../utils";
import { NotebookView } from "./NotebookView"; // named export — NOT default

// ─── NOTEBOOK CARD ────────────────────────────────────────────────────────────
/**
 * A single card in the notebook grid. Shows name, source list, chunk count,
 * creation date, and a hover menu with a delete action.
 */
export function NotebookCard({ notebook, onOpen, onDelete, theme: t }) {
  const [hover,    setHover]    = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const totalChunks = notebook.papers.reduce((s, p) => s + (p.chunks || 0), 0);
  const date        = formatDate(notebook.createdAt);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setMenuOpen(false); }}
      onClick={() => onOpen(notebook.id)}
      style={{
        background: hover ? t.surface2 : t.surface,
        border: `1px solid ${hover ? t.border2 : t.border}`,
        borderRadius: 12, padding: "18px 18px 14px",
        cursor: "pointer", transition: "all .15s ease",
        position: "relative",
        boxShadow: hover ? t.shadow : "none",
      }}
    >
      {/* Icon + menu button */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center",
          justifyContent: "center", background: t.surface3, border: `1px solid ${t.border}`,
          flexShrink: 0,
        }}>
          <FolderOpen size={16} color={t.textMuted} strokeWidth={1.6} />
        </div>

        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
          style={{
            background: "none", border: "none", cursor: "pointer", color: t.textDim,
            display: "flex", padding: 4, borderRadius: 5,
            opacity: hover ? 1 : 0, transition: "opacity .1s",
          }}
          onMouseEnter={e => e.currentTarget.style.color = t.textMuted}
          onMouseLeave={e => e.currentTarget.style.color = t.textDim}
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div style={{
            position: "absolute", top: 44, right: 12,
            background: t.surface, border: `1px solid ${t.border2}`,
            borderRadius: 8, padding: "4px", zIndex: 20,
            boxShadow: t.shadow, minWidth: 130,
          }} onClick={e => e.stopPropagation()}>
            <button
              onClick={() => { onDelete(notebook.id); setMenuOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: 7, width: "100%",
                padding: "7px 10px", borderRadius: 5, background: "none",
                border: "none", cursor: "pointer", color: t.errColor,
                fontSize: 12, fontFamily: "inherit",
              }}
              onMouseEnter={e => e.currentTarget.style.background = t.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "none"}
            >
              <Trash2 size={11} /> Delete notebook
            </button>
          </div>
        )}
      </div>

      {/* Title + source list */}
      <p style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4, lineHeight: 1.3 }}>
        {notebook.name}
      </p>
      <p style={{
        fontSize: 11, color: t.textMuted, lineHeight: 1.5, marginBottom: 10, minHeight: 32,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {notebook.papers.length === 0
          ? "No sources yet — add PDFs, TXT or MD files."
          : notebook.papers.map(p => p.name).join(", ")}
      </p>

      {/* Stats bar */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: t.textDim }}>
          <FileText size={10} />{notebook.papers.length} source{notebook.papers.length !== 1 ? "s" : ""}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: t.textDim }}>
          <Hash size={10} />{totalChunks} chunks
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: t.textDim }}>
          <Clock size={10} />{date}
        </span>
      </div>

      {/* Open hint */}
      <div style={{
        position: "absolute", right: 14, bottom: 14,
        opacity: hover ? 1 : 0, transition: "opacity .15s",
        display: "flex", alignItems: "center", gap: 3,
        fontSize: 10, color: t.textMuted,
      }}>
        Open <ChevronRight size={10} />
      </div>
    </div>
  );
}

// ─── RAG ASSISTANT (home screen + notebook router) ────────────────────────────
let nbCtr = 3;

export function RAGAssistant({ theme: t, serverStatus }) {
  const [notebooks, setNotebooks] = useState(DEFAULT_NOTEBOOKS);
  const [activeId,  setActiveId]  = useState(null);
  const [creating,  setCreating]  = useState(false);
  const [newName,   setNewName]   = useState("");
  const [search,    setSearch]    = useState("");
  const nameInputRef = useRef();

  useEffect(() => {
    if (creating) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [creating]);

  const createNotebook = () => {
    const name = newName.trim() || `Notebook ${nbCtr + 1}`;
    const nb = {
      id: `nb${++nbCtr}`, name, createdAt: Date.now(), papers: [],
      messages: [{ role: "assistant", content: `Welcome to **${name}**. Upload sources and start asking questions.` }],
    };
    setNotebooks(n => [...n, nb]);
    setNewName(""); setCreating(false); setActiveId(nb.id);
  };

  const deleteNotebook = (id) => setNotebooks(n => n.filter(nb => nb.id !== id));
  const updateNotebook = (id, patch) => setNotebooks(n => n.map(nb => nb.id === id ? { ...nb, ...patch } : nb));

  const activeNotebook = notebooks.find(nb => nb.id === activeId);

  // ── Open notebook view ─────────────────────────────────────────────────────
  if (activeNotebook) {
    return (
      <NotebookView
        notebook={activeNotebook}
        onBack={() => setActiveId(null)}
        onUpdateNotebook={updateNotebook}
        theme={t}
        serverStatus={serverStatus}
      />
    );
  }

  const filtered = notebooks.filter(nb => nb.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: t.bg, overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", gap: 10, padding: "12px 20px",
        borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0,
      }}>
        <Database size={14} color={t.textMuted} strokeWidth={1.6} />
        <span style={{ fontWeight: 600, fontSize: 14, color: t.text }}>RAG Research</span>
        <div style={{ flex: 1 }} />

        {/* Search */}
        <div style={{
          display: "flex", alignItems: "center", gap: 7, background: t.inputBg,
          border: `1px solid ${t.border}`, borderRadius: 8, padding: "5px 10px",
        }}>
          <Search size={12} color={t.textDim} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search notebooks…"
            style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: t.text, width: 160, fontFamily: "inherit" }}
          />
        </div>

        {/* New notebook */}
        {creating ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              ref={nameInputRef} value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") createNotebook(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Notebook name…"
              style={{
                background: t.inputBg, border: `1px solid ${t.border2}`, borderRadius: 7,
                padding: "5px 10px", fontSize: 12, color: t.text, fontFamily: "inherit", outline: "none", width: 160,
              }}
            />
            <button onClick={createNotebook} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7,
              fontSize: 12, background: t.text, color: t.bg, border: "none", cursor: "pointer", fontFamily: "inherit",
            }}>
              <Check size={11} /> Create
            </button>
            <button onClick={() => setCreating(false)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex" }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8,
            fontSize: 12, fontWeight: 500, background: t.text, color: t.bg,
            border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            <Plus size={13} /> New notebook
          </button>
        )}
      </div>

      {/* Notebook grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <FolderOpen size={32} color={t.textDim} style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 6 }}>
              {search ? "No notebooks match your search." : "No notebooks yet."}
            </p>
            {!search && <p style={{ fontSize: 12, color: t.textDim }}>Create one to get started.</p>}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
            {filtered.map(nb => (
              <NotebookCard key={nb.id} notebook={nb} onOpen={setActiveId} onDelete={deleteNotebook} theme={t} />
            ))}

            {/* Ghost "new" card */}
            <div
              onClick={() => setCreating(true)}
              style={{
                border: `1.5px dashed ${t.border2}`, borderRadius: 12,
                padding: "18px 18px 14px", cursor: "pointer",
                display: "flex", flexDirection: "column", alignItems: "center",
                justifyContent: "center", gap: 8, minHeight: 140, transition: "all .15s",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.textDim; e.currentTarget.style.background = t.surface2; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border2; e.currentTarget.style.background = "transparent"; }}
            >
              <Plus size={20} color={t.textDim} />
              <p style={{ fontSize: 12, color: t.textDim }}>New notebook</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}