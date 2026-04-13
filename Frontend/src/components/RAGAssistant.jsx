// src/components/RAGAssistant.jsx
import { useState, useRef, useEffect, useCallback } from "react";
import {
  FolderOpen, MoreHorizontal, Trash2, FileText, Hash,
  Clock, ChevronRight, Plus, Loader2, AlertCircle, Edit2,
} from "lucide-react";
import { listNotebooks, createNotebook, deleteNotebook, renameNotebook } from "../api";
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
        background: t.surface,
        border: `1px solid ${hover ? t.border2 : t.border}`,
        borderRadius: 16, padding: "20px 20px 16px",
        cursor: renaming ? "default" : "pointer",
        transition: "box-shadow .15s, border-color .15s",
        position: "relative",
        boxShadow: hover ? "0 2px 2px rgba(0,0,0,0.12)" : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* Icon + menu */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 12,
          display: "flex", alignItems: "center", justifyContent: "center",
          background: "#e9e9e9", flexShrink: 0,
        }}>
          <FolderOpen size={18} color="#585858" strokeWidth={1.6} />
        </div>

        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
          style={{
            background: menuOpen ? t.surface2 : "none", border: "none",
            cursor: "pointer", color: t.textDim,
            display: "flex", padding: 6, borderRadius: 20,
            opacity: hover ? 1 : 0, transition: "opacity .1s",
          }}
        >
          <MoreHorizontal size={16} />
        </button>

        {menuOpen && (
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: "absolute", top: 52, right: 12,
              background: t.surface, border: `1px solid ${t.border2}`,
              borderRadius: 12, padding: 6, zIndex: 20,
              boxShadow: "0 4px 16px rgba(0,0,0,0.15)", minWidth: 160,
            }}
          >
            {[
              { label: "Rename", Icon: Edit2,  color: t.text,     action: () => { setRenaming(true); setMenuOpen(false); } },
              { label: "Delete", Icon: Trash2, color: t.errColor, action: () => { onDelete(notebook.id); setMenuOpen(false); } },
            ].map(({ label, Icon, color, action }) => (
              <button key={label} onClick={action} style={{
                display: "flex", alignItems: "center", gap: 8, width: "100%",
                padding: "8px 12px", borderRadius: 8, background: "none",
                border: "none", cursor: "pointer", color, fontSize: 13, fontFamily: "inherit",
              }}
                onMouseEnter={e => e.currentTarget.style.background = t.surface2}
                onMouseLeave={e => e.currentTarget.style.background = "none"}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Title / rename */}
      {renaming ? (
        <div onClick={e => e.stopPropagation()} style={{ marginBottom: 6 }}>
          <input
            ref={renameRef} value={nameVal}
            onChange={e => setNameVal(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter")  submitRename();
              if (e.key === "Escape") { setRenaming(false); setNameVal(notebook.name); }
            }}
            onBlur={submitRename}
            style={{
              width: "100%", background: t.surface2,
              border: "1.5px solid #9b9b9b", borderRadius: 8,
              padding: "4px 8px", fontSize: 14, fontWeight: 600,
              color: t.text, fontFamily: "inherit", outline: "none",
            }}
          />
          {saving && <Loader2 size={10} color={t.textDim} style={{ animation: "spin .7s linear infinite", marginTop: 3 }} />}
        </div>
      ) : (
        <p style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 6, lineHeight: 1.3 }}>
          {notebook.name}
        </p>
      )}

      <p style={{
        fontSize: 12, color: t.textMuted, lineHeight: 1.5, marginBottom: 12, minHeight: 34,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {(notebook.papers || []).length === 0
          ? "No sources yet — add PDFs, TXT or MD files."
          : (notebook.papers || []).map(p => p.name).join(", ")}
      </p>

      {/* Footer stats */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 10, borderTop: `1px solid ${t.border}` }}>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.textDim }}>
          <FileText size={11} />{(notebook.papers || []).length} source{(notebook.papers || []).length !== 1 ? "s" : ""}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.textDim }}>
          <Hash size={11} />{totalChunks} chunks
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: t.textDim }}>
          <Clock size={11} />{date}
        </span>
      </div>
    </div>
  );
}

// ─── RAG ASSISTANT ────────────────────────────────────────────────────────────
// No inner header — App.jsx topbar owns all controls.
export function RAGAssistant({ theme: t, serverStatus, notebooks, setNotebooks }) {
  const [activeId,    setActiveId]    = useState(null);
  const [loadingList, setLoadingList] = useState(true);
  const [listError,   setListError]   = useState(null);
  const [search,      setSearch]      = useState("");
  const [creating,    setCreating]    = useState(false);
  const [newName,     setNewName]     = useState("");
  const [submitting,  setSubmitting]  = useState(false);
  const nameInputRef = useRef();

  useEffect(() => {
    if (creating) setTimeout(() => nameInputRef.current?.focus(), 40);
  }, [creating]);

  const handleCreate = useCallback(async () => {
    const name = newName.trim() || `Notebook ${notebooks.length + 1}`;
    setSubmitting(true);
    try {
      const nb = await createNotebook(name);
      setNotebooks(prev => [{ ...nb, papers: [], fileCount: 0, msgCount: 0 }, ...prev]);
      setNewName("");
      setCreating(false);
    } catch (err) {
      alert(`Create failed: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  }, [newName, notebooks.length, setNotebooks]);

  const fetchNotebooks = useCallback(async () => {
    setLoadingList(true); setListError(null);
    try   { setNotebooks(await listNotebooks()); }
    catch (err) { setListError(err.message); }
    finally { setLoadingList(false); }
  }, [setNotebooks]);

  useEffect(() => { fetchNotebooks(); }, [fetchNotebooks]);

  const handleDelete = async (id) => {
    setNotebooks(prev => prev.filter(nb => nb.id !== id));
    try   { await deleteNotebook(id); }
    catch (err) { fetchNotebooks(); alert(`Delete failed: ${err.message}`); }
  };

  const handleRename = async (id, name) => {
    setNotebooks(prev => prev.map(nb => nb.id === id ? { ...nb, name } : nb));
    try   { await renameNotebook(id, name); }
    catch (err) { fetchNotebooks(); alert(`Rename failed: ${err.message}`); }
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
      <div style={{ flex: 1, overflowY: "auto", padding: "32px 28px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 22 }}>
          <div>
            <p style={{ fontSize: 24, fontWeight: 700, color: t.text, margin: 0 }}>Notebooks</p>
            <p style={{ fontSize: 13, color: t.textMuted, margin: "6px 0 0" }}>Search or create a notebook for your research.</p>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search notebooks…"
              style={{
                minWidth: 180, padding: "8px 12px", borderRadius: 10,
                border: `1px solid ${t.border2}`, background: t.surface2,
                color: t.text, outline: "none", fontSize: 13,
              }}
            />
            {creating ? (
              <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
                <input
                  ref={nameInputRef}
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleCreate();
                    if (e.key === "Escape") { setCreating(false); setNewName(""); }
                  }}
                  placeholder="Notebook name…"
                  style={{
                    minWidth: 180, padding: "8px 12px", borderRadius: 10,
                    border: `1px solid ${t.border2}`, background: t.surface2,
                    color: t.text, outline: "none", fontSize: 13,
                  }}
                />
                <button
                  onClick={handleCreate}
                  disabled={submitting}
                  style={{
                    padding: "8px 12px", borderRadius: 10, border: "none",
                    background: t.text, color: t.bg, cursor: submitting ? "default" : "pointer",
                    fontSize: 13, fontWeight: 600,
                  }}
                >
                  {submitting ? "Creating…" : "Create"}
                </button>
                <button
                  onClick={() => { setCreating(false); setNewName(""); }}
                  style={{
                    padding: "8px 12px", borderRadius: 10, border: `1px solid ${t.border2}`,
                    background: "transparent", color: t.textMuted, cursor: "pointer",
                    fontSize: 13,
                  }}
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setCreating(true)}
                style={{
                  padding: "8px 14px", borderRadius: 10, border: "none",
                  background: t.text, color: t.bg, cursor: "pointer",
                  fontSize: 13, fontWeight: 600,
                }}
              >
                New notebook
              </button>
            )}
          </div>
        </div>

        {loadingList ? (
          <div style={{ textAlign: "center", marginTop: 80 }}>
            <Loader2 size={28} color={t.textDim} style={{ margin: "0 auto 14px", display: "block", animation: "spin .8s linear infinite" }} />
            <p style={{ fontSize: 14, color: t.textDim }}>Loading notebooks…</p>
          </div>

        ) : listError ? (
          <div style={{ textAlign: "center", marginTop: 80 }}>
            <AlertCircle size={32} color={t.errColor} style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 14, color: t.errColor, marginBottom: 12 }}>{listError}</p>
            <button onClick={fetchNotebooks} style={{
              padding: "8px 20px", borderRadius: 24, fontSize: 13,
              background: t.surface, color: t.text,
              border: `1px solid ${t.border2}`, cursor: "pointer", fontFamily: "inherit",
            }}>Retry</button>
          </div>

        ) : filtered.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 80 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, background: "#E8F0FE",
              display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
            }}>
              <FolderOpen size={28} color="#1A73E8" />
            </div>
            <p style={{ fontSize: 16, fontWeight: 500, color: t.textMuted, marginBottom: 8 }}>
              {search ? "No notebooks match your search." : "No notebooks yet."}
            </p>
            {!search && <p style={{ fontSize: 13, color: t.textDim }}>Create one to get started.</p>}
          </div>

        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 }}>
            {filtered.map(nb => (
              <NotebookCard
                key={nb.id} notebook={nb}
                onOpen={setActiveId}
                onDelete={handleDelete}
                onRename={handleRename}
                theme={t}
              />
            ))}

            {/* New notebook card */}
            <div
              onClick={() => setCreating(true)}
              style={{
                border: `1.5px dashed ${t.border2}`, borderRadius: 16,
                padding: "20px 20px 16px", cursor: "pointer",
                display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center",
                gap: 10, minHeight: 160, transition: "all .15s", background: "transparent",
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#b1b1b1"; e.currentTarget.style.background = "#f9f9f9"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border2; e.currentTarget.style.background = "transparent"; }}
            >
              <div style={{
                width: 40, height: 40, borderRadius: 20, background: t.surface2,
                display: "flex", alignItems: "center", justifyContent: "center",
                border: `1px solid ${t.border}`,
              }}>
                <Plus size={18} color={t.textDim} />
              </div>
              <p style={{ fontSize: 13, color: t.textDim, fontWeight: 500 }}>New notebook</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}