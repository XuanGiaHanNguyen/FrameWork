// src/components/RAGAssistant.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import {
  FolderOpen, MoreHorizontal, Trash2, FileText, Hash,
  Clock, ChevronRight, Plus, Search, Check, X, Database,
  Loader2, AlertCircle, Edit2,
} from "lucide-react";
import {
  listNotebooks, createNotebook, deleteNotebook, renameNotebook,
} from "../api";
import { formatDate } from "../utils";
import { NotebookView } from "./NotebookView";

// ─── NOTEBOOK CARD ────────────────────────────────────────────────────────────
function NotebookCard({ notebook, onOpen, onDelete, onRename, theme: t }) {
  const [hover,    setHover]    = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [nameVal,  setNameVal]  = useState(notebook.name);
  const [saving,   setSaving]   = useState(false);
  const renameRef = useRef();

  useEffect(() => {
    if (renaming) setTimeout(() => renameRef.current?.focus(), 30);
  }, [renaming]);

  const totalChunks = (notebook.papers || []).reduce((s, p) => s + (p.chunks || 0), 0);
  const date = formatDate(notebook.createdAt);

  const submitRename = async () => {
    const trimmed = nameVal.trim();
    if (!trimmed || trimmed === notebook.name) { setRenaming(false); return; }
    setSaving(true);
    await onRename(notebook.id, trimmed);
    setSaving(false);
    setRenaming(false);
  };

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setMenuOpen(false); }}
      onClick={() => !renaming && onOpen(notebook.id)}
      style={{
        background: hover ? t.surface2 : t.surface,
        border: `1px solid ${hover ? t.border2 : t.border}`,
        borderRadius: 12, padding: "18px 18px 14px",
        cursor: renaming ? "default" : "pointer",
        transition: "all .15s ease", position: "relative",
        boxShadow: hover ? t.shadow : "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center",
          justifyContent: "center", background: t.surface3, border: `1px solid ${t.border}`, flexShrink: 0,
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
        >
          <MoreHorizontal size={14} />
        </button>

        {menuOpen && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 44, right: 12,
              background: t.surface, border: `1px solid ${t.border2}`,
              borderRadius: 8, padding: 4, zIndex: 20, boxShadow: t.shadow, minWidth: 150,
            }}
          >
            {[
              { label: "Rename", Icon: Edit2, color: t.text,     action: () => { setRenaming(true); setMenuOpen(false); } },
              { label: "Delete", Icon: Trash2, color: t.errColor, action: () => { onDelete(notebook.id); setMenuOpen(false); } },
            ].map(({ label, Icon, color, action }) => (
              <button key={label} onClick={action} style={{
                display: "flex", alignItems: "center", gap: 7, width: "100%",
                padding: "7px 10px", borderRadius: 5, background: "none",
                border: "none", cursor: "pointer", color, fontSize: 12, fontFamily: "inherit",
              }}
                onMouseEnter={e => e.currentTarget.style.background = t.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Inline rename or title */}
      {renaming ? (
        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 4 }}>
          <input
            ref={renameRef}
            value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter")  submitRename();
              if (e.key === "Escape") { setRenaming(false); setNameVal(notebook.name); }
            }}
            onBlur={submitRename}
            style={{
              width: "100%", background: t.inputBg, border: `1px solid ${t.border2}`,
              borderRadius: 6, padding: "3px 7px", fontSize: 13, fontWeight: 600,
              color: t.text, fontFamily: "inherit", outline: "none",
            }}
          />
          {saving && <Loader2 size={10} color={t.textDim} style={{ animation: "spin .7s linear infinite", marginTop: 3 }} />}
        </div>
      ) : (
        <p style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4, lineHeight: 1.3 }}>
          {notebook.name}
        </p>
      )}

      <p style={{
        fontSize: 11, color: t.textMuted, lineHeight: 1.5, marginBottom: 10, minHeight: 32,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {(notebook.papers || []).length === 0
          ? "No sources yet — add PDFs, TXT or MD files."
          : (notebook.papers || []).map(p => p.name).join(", ")}
      </p>

      <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: t.textDim }}>
          <FileText size={10} />{(notebook.papers || []).length} source{(notebook.papers || []).length !== 1 ? "s" : ""}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: t.textDim }}>
          <Hash size={10} />{totalChunks} chunks
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10, color: t.textDim }}>
          <Clock size={10} />{date}
        </span>
      </div>

      <div style={{
        position: "absolute", right: 14, bottom: 14,
        opacity: hover && !renaming ? 1 : 0, transition: "opacity .15s",
        display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: t.textMuted,
      }}>
        Open <ChevronRight size={10} />
      </div>
    </div>
  );
}

// ─── RAG ASSISTANT HOME ───────────────────────────────────────────────────────
export function RAGAssistant({ theme: t, serverStatus }) {
  const [notebooks,   setNotebooks]   = useState([]);
  const [activeId,    setActiveId]    = useState(null);
  const [creating,    setCreating]    = useState(false);
  const [newName,     setNewName]     = useState("");
  const [search,      setSearch]      = useState("");
  const [loadingList, setLoadingList] = useState(true);
  const [listError,   setListError]   = useState(null);
  const [submitting,  setSubmitting]  = useState(false);
  const nameInputRef = useRef();

  const fetchNotebooks = useCallback(async () => {
    setLoadingList(true); setListError(null);
    try {
      setNotebooks(await listNotebooks());
    } catch (err) {
      setListError(err.message);
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => { fetchNotebooks(); }, [fetchNotebooks]);
  useEffect(() => {
    if (creating) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [creating]);

  const handleCreate = async () => {
    const name = newName.trim() || `Notebook ${notebooks.length + 1}`;
    setSubmitting(true);
    try {
      const nb = await createNotebook(name);
      setNotebooks(prev => [{ ...nb, papers: [], fileCount: 0, msgCount: 0 }, ...prev]);
      setNewName(""); setCreating(false);
      setActiveId(nb.id);
    } catch (err) {
      alert(`Create failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id) => {
    setNotebooks(prev => prev.filter(nb => nb.id !== id)); // optimistic
    try {
      await deleteNotebook(id);
    } catch (err) {
      fetchNotebooks();
      alert(`Delete failed: ${err.message}`);
    }
  };

  const handleRename = async (id, name) => {
    setNotebooks(prev => prev.map(nb => nb.id === id ? { ...nb, name } : nb)); // optimistic
    try {
      await renameNotebook(id, name);
    } catch (err) {
      fetchNotebooks();
      alert(`Rename failed: ${err.message}`);
    }
  };

  const activeNotebook = notebooks.find(nb => nb.id === activeId);

  if (activeNotebook) {
    return (
      <NotebookView
        notebook={activeNotebook}
        onBack={() => { setActiveId(null); fetchNotebooks(); }}
        theme={t}
        serverStatus={serverStatus}
      />
    );
  }

  const filtered = notebooks.filter(nb =>
    nb.name.toLowerCase().includes(search.toLowerCase())
  );

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

        {creating ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input
              ref={nameInputRef} value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleCreate(); if (e.key === "Escape") setCreating(false); }}
              placeholder="Notebook name…"
              style={{
                background: t.inputBg, border: `1px solid ${t.border2}`, borderRadius: 7,
                padding: "5px 10px", fontSize: 12, color: t.text, fontFamily: "inherit", outline: "none", width: 160,
              }}
            />
            <button onClick={handleCreate} disabled={submitting} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 12px", borderRadius: 7,
              fontSize: 12, background: t.text, color: t.bg, border: "none",
              cursor: submitting ? "default" : "pointer", opacity: submitting ? .7 : 1, fontFamily: "inherit",
            }}>
              {submitting
                ? <Loader2 size={11} style={{ animation: "spin .7s linear infinite" }} />
                : <Check size={11} />
              } Create
            </button>
            <button onClick={() => setCreating(false)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex" }}>
              <X size={13} />
            </button>
          </div>
        ) : (
          <button onClick={() => setCreating(true)} style={{
            display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 8,
            fontSize: 12, fontWeight: 500, background: t.text, color: t.bg, border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}
          >
            <Plus size={13} /> New notebook
          </button>
        )}
      </div>

      {/* Grid body */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        {loadingList ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <Loader2 size={24} color={t.textDim} style={{ margin: "0 auto 12px", display: "block", animation: "spin .8s linear infinite" }} />
            <p style={{ fontSize: 13, color: t.textDim }}>Loading notebooks…</p>
          </div>
        ) : listError ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <AlertCircle size={28} color={t.errColor} style={{ margin: "0 auto 10px", display: "block" }} />
            <p style={{ fontSize: 13, color: t.errColor, marginBottom: 10 }}>{listError}</p>
            <button onClick={fetchNotebooks} style={{
              padding: "6px 16px", borderRadius: 7, fontSize: 12,
              background: t.surface2, color: t.text, border: `1px solid ${t.border}`, cursor: "pointer", fontFamily: "inherit",
            }}>Retry</button>
          </div>
        ) : filtered.length === 0 ? (
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
              <NotebookCard
                key={nb.id} notebook={nb}
                onOpen={setActiveId}
                onDelete={handleDelete}
                onRename={handleRename}
                theme={t}
              />
            ))}
            <div
              onClick={() => setCreating(true)}
              style={{
                border: `1.5px dashed ${t.border2}`, borderRadius: 12, padding: "18px 18px 14px",
                cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 8, minHeight: 140, transition: "all .15s",
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