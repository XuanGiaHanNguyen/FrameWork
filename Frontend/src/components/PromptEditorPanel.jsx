import { useState } from "react";
import {
  Edit3, X, BookMarked, Check, Copy, CornerDownLeft,
  Bookmark, Loader2, Trash2,
} from "lucide-react";
// API calls for saving prompts are handled by the parent (FlowCanvas → handleEditorSave)
// so no direct fetch is needed here.

// ─── PROMPT EDITOR PANEL ──────────────────────────────────────────────────────
/**
 * Slide-in right panel for editing system + user prompts on an LLM node.
 * Also manages a saved-prompt library (view, apply, delete).
 *
 * Props:
 *   node          – the LLM FlowNode object
 *   savedPrompts  – array of { id, name, system, user }
 *   onSave        – (nodeId, sysVal, userVal, saveName?) => void
 *   onClose       – () => void
 *   onApplySaved  – (nodeId, savedPrompt) => void
 *   onDeleteSaved – (savedPromptId) => void
 *   theme         – theme object (t)
 */
export function PromptEditorPanel({
  node, savedPrompts,
  onSave, onClose, onApplySaved, onDeleteSaved,
  theme: t,
}) {
  const sysField  = node.fields?.find(f => f.placeholder?.toLowerCase().includes("system"));
  const userField = node.fields?.find(f => f.placeholder?.toLowerCase().includes("user"));

  const [sysVal,   setSysVal]   = useState(sysField?.value  || "");
  const [userVal,  setUserVal]  = useState(userField?.value || "");
  const [saveName, setSaveName] = useState("");
  const [tab,      setTab]      = useState("edit");
  const [copied,   setCopied]   = useState(null);
  const [saving,   setSaving]   = useState(false);

  const applyToNode = () => onSave(node.id, sysVal, userVal);

  const saveToLibrary = async () => {
    if (!saveName.trim()) return;
    setSaving(true);
    await onSave(node.id, sysVal, userVal, saveName.trim());
    setSaveName("");
    setSaving(false);
  };

  const copy = (txt, key) => {
    navigator.clipboard.writeText(txt);
    setCopied(key);
    setTimeout(() => setCopied(null), 1400);
  };

  const TABS = [
    { id: "edit",    Icon: Edit3,      label: "Edit" },
    { id: "library", Icon: BookMarked, label: `Library (${savedPrompts.length})` },
  ];

  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0, width: 400, zIndex: 50,
      background: t.panelBg, borderLeft: `1px solid ${t.border2}`,
      display: "flex", flexDirection: "column",
      boxShadow: "-8px 0 32px rgba(0,0,0,.25)",
      fontFamily: "'DM Mono', monospace",
      animation: "slideIn .18s ease forwards",
    }}>
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: `1px solid ${t.border}`, background: t.surface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Edit3 size={13} color={t.textMuted} />
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>Prompt Editor</span>
          <span style={{
            fontSize: 10, padding: "1px 7px", borderRadius: 4,
            background: t.savedTag, color: t.savedText, border: `1px solid ${t.savedBorder}`,
          }}>
            {node.label}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex", padding: 4 }}
          onMouseEnter={e => e.currentTarget.style.color = t.text}
          onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
        >
          <X size={13} />
        </button>
      </div>

      {/* ── Tabs ── */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, background: t.surface }}>
        {TABS.map(({ id, Icon: TI, label }) => (
          <button key={id} onClick={() => setTab(id)} style={{
            flex: 1, padding: "9px 0", display: "flex", alignItems: "center",
            justifyContent: "center", gap: 6, fontSize: 11, cursor: "pointer",
            background: "transparent", border: "none",
            borderBottom: tab === id ? `2px solid ${t.text}` : "2px solid transparent",
            color: tab === id ? t.text : t.textMuted, fontFamily: "inherit",
          }}>
            <TI size={12} />{label}
          </button>
        ))}
      </div>

      {/* ── Edit tab ── */}
      {tab === "edit" && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
          {/* System prompt */}
          <PromptTextarea
            label="SYSTEM PROMPT" value={sysVal} onChange={setSysVal}
            copied={copied === "sys"} onCopy={() => copy(sysVal, "sys")}
            placeholder="You are a helpful assistant…" rows={6} theme={t}
          />
          <div style={{ height: 1, background: t.border, margin: "0 14px" }} />

          {/* User prompt */}
          <PromptTextarea
            label="USER PROMPT" value={userVal} onChange={setUserVal}
            copied={copied === "usr"} onCopy={() => copy(userVal, "usr")}
            placeholder="Based on the context, please…" rows={8} theme={t}
          />

          {/* Save name */}
          <div style={{ padding: "8px 14px 12px" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={saveName} onChange={e => setSaveName(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveToLibrary()}
                placeholder="Name to save to library…"
                style={{
                  flex: 1, background: t.inputBg, border: `1px solid ${t.border}`,
                  borderRadius: 6, padding: "5px 9px", fontSize: 11,
                  color: t.text, fontFamily: "inherit", outline: "none",
                }}
              />
              <button
                onClick={saveToLibrary} disabled={!saveName.trim() || saving}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                  borderRadius: 6, fontSize: 11, cursor: saveName.trim() ? "pointer" : "default",
                  background: saveName.trim() ? t.savedTag : t.surface2,
                  color: saveName.trim() ? t.savedText : t.textDim,
                  border: `1px solid ${saveName.trim() ? t.savedBorder : t.border}`,
                  fontFamily: "inherit",
                }}
              >
                {saving
                  ? <Loader2 size={11} style={{ animation: "spin .7s linear infinite" }} />
                  : <Bookmark size={11} />}
                Save
              </button>
            </div>
          </div>

          {/* Apply button */}
          <div style={{ padding: "0 14px 14px", marginTop: "auto" }}>
            <button
              onClick={applyToNode}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: t.text, color: t.bg, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
                gap: 7, fontFamily: "inherit",
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <CornerDownLeft size={13} />Apply to Node
            </button>
          </div>
        </div>
      )}

      {/* ── Library tab ── */}
      {tab === "library" && (
        <SavedPromptLibrary
          node={node} savedPrompts={savedPrompts}
          onApply={onApplySaved} onDelete={onDeleteSaved} theme={t}
        />
      )}
    </div>
  );
}

// ─── HELPER: labelled textarea with copy button ───────────────────────────────
function PromptTextarea({ label, value, onChange, copied, onCopy, placeholder, rows, theme: t }) {
  return (
    <div style={{ padding: "14px 14px 10px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 7 }}>
        <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: ".08em" }}>{label}</span>
        <button
          onClick={onCopy}
          style={{
            background: "none", border: "none", cursor: "pointer", color: t.textDim,
            display: "flex", gap: 4, alignItems: "center", fontSize: 10, fontFamily: "inherit",
          }}
          onMouseEnter={e => e.currentTarget.style.color = t.textMuted}
          onMouseLeave={e => e.currentTarget.style.color = t.textDim}
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? "copied" : "copy"}
        </button>
      </div>
      <textarea
        value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} rows={rows}
        style={{
          width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
          borderRadius: 7, padding: "9px 11px", fontSize: 11.5, color: t.text,
          fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.6,
        }}
      />
    </div>
  );
}

// ─── HELPER: saved prompt library list ────────────────────────────────────────
function SavedPromptLibrary({ node, savedPrompts, onApply, onDelete, theme: t }) {
  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
      {savedPrompts.length === 0 ? (
        <div style={{ textAlign: "center", marginTop: 40, color: t.textDim }}>
          <BookMarked size={24} style={{ margin: "0 auto 10px", display: "block", opacity: 0.4 }} />
          <p style={{ fontSize: 12 }}>No saved prompts yet.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {savedPrompts.map(sp => (
            <div key={sp.id} style={{
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8, overflow: "hidden",
            }}>
              <div style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "8px 10px", borderBottom: `1px solid ${t.border}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <Bookmark size={11} color={t.savedText} />
                  <span style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{sp.name}</span>
                </div>
                <div style={{ display: "flex", gap: 4 }}>
                  <button
                    onClick={() => onApply(node.id, sp)}
                    style={{
                      display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                      borderRadius: 5, fontSize: 10, cursor: "pointer",
                      background: t.savedTag, color: t.savedText,
                      border: `1px solid ${t.savedBorder}`, fontFamily: "inherit",
                    }}
                  >
                    <CornerDownLeft size={10} />Apply
                  </button>
                  <button
                    onClick={() => onDelete(sp.id)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: t.textDim, display: "flex", padding: 4, borderRadius: 4,
                    }}
                    onMouseEnter={e => e.currentTarget.style.color = t.text}
                    onMouseLeave={e => e.currentTarget.style.color = t.textDim}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>

              <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
                {sp.system && (
                  <div>
                    <span style={{ fontSize: 9, color: t.textDim, letterSpacing: ".08em", display: "block", marginBottom: 3 }}>SYSTEM</span>
                    <p style={{ fontSize: 10.5, color: t.textMuted, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{sp.system}</p>
                  </div>
                )}
                {sp.user && (
                  <div>
                    <span style={{ fontSize: 9, color: t.textDim, letterSpacing: ".08em", display: "block", marginBottom: 3 }}>USER</span>
                    <p style={{ fontSize: 10.5, color: t.textMuted, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{sp.user}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}