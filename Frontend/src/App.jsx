import { useState, useCallback, useRef, useEffect } from "react";
import {
  Brain, Upload, File, X, Send, Layers, AlignLeft, HelpCircle,
  BookOpen, Loader2, Workflow, Zap, Database, Globe,
  SlidersHorizontal, ChevronDown, Plus, Play, Trash2, Save,
  Sun, Moon, FileText, Edit3, BookMarked, Check, ChevronRight,
  FolderOpen, Bookmark, Copy, CornerDownLeft
} from "lucide-react";

// ─── UTILS ────────────────────────────────────────────────────────────────────
const cosineSim = (a, b) => {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i]*b[i]; na += a[i]**2; nb += b[i]**2; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-9);
};
const naiveEmbed = (text) => {
  const vec = new Float32Array(64).fill(0);
  const t = text.toLowerCase();
  for (let i = 0; i < t.length; i++) vec[t.charCodeAt(i) % 64] += 1;
  const norm = Math.sqrt(vec.reduce((s, v) => s + v*v, 0)) + 1e-9;
  return vec.map(v => v / norm);
};
const chunkText = (text, size = 400, overlap = 80) => {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += size - overlap) {
    chunks.push(words.slice(i, i + size).join(" "));
    if (i + size >= words.length) break;
  }
  return chunks;
};

// ─── THEME ────────────────────────────────────────────────────────────────────
const themes = {
  dark: {
    bg:        "#171717",
    surface:   "#191919",
    surface2:  "#1a1a1a",
    surface3:  "#222222",
    border:    "#242424",
    border2:   "#2e2e2e",
    text:      "#f0f0f0",
    textMuted: "#666666",
    textDim:   "#333333",
    accent:    "#f0f0f0",
    accentBg:  "#1a1a1a",
    inputBg:   "#0d0d0d",
    msgUser:   "#f0f0f0",
    msgUserText:"#080808",
    shadow:    "0 4px 24px rgba(0,0,0,.6)",
    nodeGlow:  "0 0 0 1px #f0f0f022, 0 8px 32px rgba(0,0,0,.5)",
    handle:    "#f0f0f0",
    edgeColor: "#888888",
    gridDot:   "#1e1e1e",
    savedTag:  "#2a2a1a",
    savedBorder:"#4a4a2a",
    savedText: "#c8c060",
    panelBg:   "#111111",
  },
  light: {
    bg:        "#fafafa",
    surface:   "#ffffff",
    surface2:  "#f2f2f2",
    surface3:  "#ebebeb",
    border:    "#e0e0e0",
    border2:   "#d0d0d0",
    text:      "#3d3d3d",
    textMuted: "#888888",
    textDim:   "#cccccc",
    accent:    "#3b3b3b",
    accentBg:  "#f0f0f0",
    inputBg:   "#f7f7f7",
    msgUser:   "#3d3d3d",
    msgUserText:"#ffffff",
    shadow:    "0 4px 24px rgba(0,0,0,.08)",
    nodeGlow:  "0 0 0 1px #11111122, 0 8px 32px rgba(0,0,0,.1)",
    handle:    "#3d3d3d",
    edgeColor: "#999999",
    gridDot:   "#e8e8e8",
    savedTag:  "#fefce8",
    savedBorder:"#d4c44a",
    savedText: "#8a7a10",
    panelBg:   "#f5f5f5",
  }
};

// ─── PRESET QUESTIONS ─────────────────────────────────────────────────────────
const PRESETS = [
  { Icon: AlignLeft,   label: "Summarize all",   prompt: "Summarize each uploaded paper in 2-3 sentences." },
  { Icon: Layers,      label: "Compare methods", prompt: "What are the main methodological differences between these papers?" },
  { Icon: HelpCircle,  label: "Limitations",     prompt: "What limitations are mentioned across the papers?" },
  { Icon: BookOpen,    label: "Common themes",   prompt: "What themes or topics recur across all the papers?" },
];

// ─── NODE META ────────────────────────────────────────────────────────────────
const NODE_META = {
  github:    { label: "GitHub Repo",   Icon: Brain,            shade: "strong" },
  llm:       { label: "LLM",           Icon: Brain,            shade: "medium" },
  rag:       { label: "RAG Retriever", Icon: Database,         shade: "strong" },
  output:    { label: "Output",        Icon: FileText,         shade: "medium" },
  web:       { label: "Web Scraper",   Icon: Globe,            shade: "strong" },
  transform: { label: "Transform",     Icon: SlidersHorizontal,shade: "medium" },
};

const NODE_WIDTH = 220;

function getRightHandle(node, nodeRefs) {
  const el = nodeRefs.current[node.id];
  const h = el ? el.offsetHeight : 80;
  return { x: node.x + NODE_WIDTH, y: node.y + h / 2 };
}
function getLeftHandle(node, nodeRefs) {
  const el = nodeRefs.current[node.id];
  const h = el ? el.offsetHeight : 80;
  return { x: node.x, y: node.y + h / 2 };
}

// ─── PROMPT EDITOR PANEL ──────────────────────────────────────────────────────
function PromptEditorPanel({ node, savedPrompts, onSave, onClose, onApplySaved, onDeleteSaved, theme: t }) {
  const [systemVal, setSystemVal] = useState(
    node.fields?.find(f => f.placeholder?.includes("System"))?.value || ""
  );
  const [userVal, setUserVal] = useState(
    node.fields?.find(f => f.placeholder?.includes("User"))?.value || ""
  );
  const [promptName, setPromptName] = useState(node.label || "");
  const [saveNameInput, setSaveNameInput] = useState("");
  const [tab, setTab] = useState("edit"); // "edit" | "library"
  const [copied, setCopied] = useState(null);

  const handleSave = () => {
    onSave(node.id, systemVal, userVal);
  };

  const handleSaveToLibrary = () => {
    if (!saveNameInput.trim()) return;
    onSave(node.id, systemVal, userVal, saveNameInput.trim());
    setSaveNameInput("");
  };

  const copyToClipboard = (text, id) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    });
  };

  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0,
      width: 400, zIndex: 50,
      background: t.panelBg,
      borderLeft: `1px solid ${t.border2}`,
      display: "flex", flexDirection: "column",
      boxShadow: "-8px 0 32px rgba(0,0,0,.25)",
      fontFamily: "'DM Mono', 'Fira Mono', monospace",
      animation: "slideIn .2s ease forwards"
    }}>
      {/* Panel header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 14px", borderBottom: `1px solid ${t.border}`,
        background: t.surface,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Edit3 size={13} color={t.textMuted} />
          <span style={{ fontSize: 12, fontWeight: 600, color: t.text, letterSpacing: "-.01em" }}>
            Prompt Editor
          </span>
          <span style={{
            fontSize: 10, padding: "1px 7px", borderRadius: 4,
            background: t.savedTag, color: t.savedText,
            border: `1px solid ${t.savedBorder}`
          }}>
            {node.label}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex", padding: 4, borderRadius: 5 }}
          onMouseEnter={e => e.currentTarget.style.color = t.text}
          onMouseLeave={e => e.currentTarget.style.color = t.textMuted}
        >
          <X size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: `1px solid ${t.border}`, background: t.surface }}>
        {[
          { id: "edit", Icon: Edit3, label: "Edit Prompt" },
          { id: "library", Icon: BookMarked, label: `Library (${savedPrompts.length})` },
        ].map(({ id, Icon: TIcon, label }) => (
          <button key={id} onClick={() => setTab(id)}
            style={{
              flex: 1, padding: "9px 0", display: "flex", alignItems: "center", justifyContent: "center",
              gap: 6, fontSize: 11, cursor: "pointer", transition: "all .15s",
              background: "transparent", border: "none",
              borderBottom: tab === id ? `2px solid ${t.text}` : "2px solid transparent",
              color: tab === id ? t.text : t.textMuted,
              fontFamily: "inherit",
            }}
          >
            <TIcon size={12} />{label}
          </button>
        ))}
      </div>

      {tab === "edit" && (
        <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 0 }}>
          {/* System prompt */}
          <div style={{ padding: "14px 14px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: ".08em" }}>SYSTEM PROMPT</span>
              <button
                onClick={() => copyToClipboard(systemVal, "sys")}
                style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex", gap: 4, alignItems: "center", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontFamily: "inherit" }}
                onMouseEnter={e => e.currentTarget.style.color = t.textMuted}
                onMouseLeave={e => e.currentTarget.style.color = t.textDim}
              >
                {copied === "sys" ? <Check size={11} /> : <Copy size={11} />}
                {copied === "sys" ? "copied" : "copy"}
              </button>
            </div>
            <textarea
              value={systemVal}
              onChange={e => setSystemVal(e.target.value)}
              placeholder="You are a helpful assistant…"
              rows={6}
              style={{
                width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                borderRadius: 7, padding: "9px 11px", fontSize: 11.5, color: t.text,
                fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.6,
                transition: "border-color .15s"
              }}
              onFocus={e => e.target.style.borderColor = t.border2}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>

          <div style={{ height: 1, background: t.border, margin: "0 14px" }} />

          {/* User prompt */}
          <div style={{ padding: "12px 14px 10px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
              <span style={{ fontSize: 10, color: t.textMuted, letterSpacing: ".08em" }}>USER PROMPT</span>
              <button
                onClick={() => copyToClipboard(userVal, "usr")}
                style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex", gap: 4, alignItems: "center", fontSize: 10, padding: "2px 6px", borderRadius: 4, fontFamily: "inherit" }}
                onMouseEnter={e => e.currentTarget.style.color = t.textMuted}
                onMouseLeave={e => e.currentTarget.style.color = t.textDim}
              >
                {copied === "usr" ? <Check size={11} /> : <Copy size={11} />}
                {copied === "usr" ? "copied" : "copy"}
              </button>
            </div>
            <textarea
              value={userVal}
              onChange={e => setUserVal(e.target.value)}
              placeholder="Based on the context, please…"
              rows={8}
              style={{
                width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                borderRadius: 7, padding: "9px 11px", fontSize: 11.5, color: t.text,
                fontFamily: "inherit", outline: "none", resize: "vertical", lineHeight: 1.6,
                transition: "border-color .15s"
              }}
              onFocus={e => e.target.style.borderColor = t.border2}
              onBlur={e => e.target.style.borderColor = t.border}
            />
          </div>

          {/* Save to library */}
          <div style={{ padding: "8px 14px 12px" }}>
            <div style={{ display: "flex", gap: 6 }}>
              <input
                value={saveNameInput}
                onChange={e => setSaveNameInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSaveToLibrary()}
                placeholder="Name to save to library…"
                style={{
                  flex: 1, background: t.inputBg, border: `1px solid ${t.border}`,
                  borderRadius: 6, padding: "5px 9px", fontSize: 11, color: t.text,
                  fontFamily: "inherit", outline: "none"
                }}
              />
              <button
                onClick={handleSaveToLibrary}
                disabled={!saveNameInput.trim()}
                style={{
                  display: "flex", alignItems: "center", gap: 5, padding: "5px 10px",
                  borderRadius: 6, fontSize: 11, cursor: saveNameInput.trim() ? "pointer" : "default",
                  background: saveNameInput.trim() ? t.savedTag : t.surface2,
                  color: saveNameInput.trim() ? t.savedText : t.textDim,
                  border: `1px solid ${saveNameInput.trim() ? t.savedBorder : t.border}`,
                  fontFamily: "inherit", transition: "all .15s"
                }}
              >
                <Bookmark size={11} />Save
              </button>
            </div>
          </div>

          {/* Apply button */}
          <div style={{ padding: "0 14px 14px", marginTop: "auto" }}>
            <button
              onClick={handleSave}
              style={{
                width: "100%", padding: "9px 0", borderRadius: 7, fontSize: 12, fontWeight: 600,
                background: t.text, color: t.bg, border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
                fontFamily: "inherit", transition: "opacity .15s"
              }}
              onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
              onMouseLeave={e => e.currentTarget.style.opacity = "1"}
            >
              <CornerDownLeft size={13} />Apply to Node
            </button>
          </div>
        </div>
      )}

      {tab === "library" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "10px" }}>
          {savedPrompts.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 40, color: t.textDim }}>
              <BookMarked size={24} style={{ margin: "0 auto 10px", display: "block", opacity: .4 }} />
              <p style={{ fontSize: 12 }}>No saved prompts yet.</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>Save prompts from the Edit tab.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {savedPrompts.map((sp) => (
                <div key={sp.id} style={{
                  background: t.surface, border: `1px solid ${t.border}`, borderRadius: 8,
                  overflow: "hidden"
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", borderBottom: `1px solid ${t.border}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Bookmark size={11} color={t.savedText} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{sp.name}</span>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => onApplySaved(node.id, sp)}
                        style={{
                          display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                          borderRadius: 5, fontSize: 10, cursor: "pointer", fontFamily: "inherit",
                          background: t.savedTag, color: t.savedText,
                          border: `1px solid ${t.savedBorder}`, transition: "all .15s"
                        }}
                      >
                        <CornerDownLeft size={10} />Apply
                      </button>
                      <button
                        onClick={() => onDeleteSaved(sp.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex", padding: 4, borderRadius: 4 }}
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
                        <p style={{ fontSize: 10.5, color: t.textMuted, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {sp.system}
                        </p>
                      </div>
                    )}
                    {sp.user && (
                      <div>
                        <span style={{ fontSize: 9, color: t.textDim, letterSpacing: ".08em", display: "block", marginBottom: 3 }}>USER</span>
                        <p style={{ fontSize: 10.5, color: t.textMuted, lineHeight: 1.5, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {sp.user}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── FLOW NODE ────────────────────────────────────────────────────────────────
function FlowNode({
  node, selected, onDelete, onFieldChange, onMouseDown,
  onStartConnect, onCompleteConnect, connectingFrom,
  onOpenEditor,
  theme: t
}) {
  const meta = NODE_META[node.type] || NODE_META.output;
  const NodeIcon = meta.Icon;
  const isTarget = connectingFrom && connectingFrom !== node.id;
  const isLLM = node.type === "llm";

  // Check if this node has saved/filled prompts
  const hasPrompt = node.fields?.some(f => f.type === "textarea" && f.value?.trim().length > 0);

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: NODE_WIDTH,
        cursor: "grab",
        background: t.surface,
        border: `1px solid ${selected ? t.text : isTarget ? t.accent : t.border}`,
        borderRadius: 10,
        boxShadow: selected ? t.nodeGlow : t.shadow,
        userSelect: "none",
        transition: "border-color .15s, box-shadow .15s",
        fontFamily: "'DM Mono', 'Fira Mono', monospace",
        position: "relative",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px",
        background: t.surface2,
        borderRadius: "9px 9px 0 0",
        borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <NodeIcon size={13} color={t.textMuted} strokeWidth={1.8} />
          <span style={{ fontSize: 11, fontWeight: 500, color: t.text, letterSpacing: "-.01em" }}>
            {node.label || meta.label}
          </span>
          {isLLM && hasPrompt && (
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3,
              background: t.savedTag, color: t.savedText,
              border: `1px solid ${t.savedBorder}`
            }}>saved</span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {isLLM && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onOpenEditor(node.id); }}
              title="Open Prompt Editor"
              style={{
                background: "none", border: "none", cursor: "pointer", color: t.textDim,
                padding: 2, display: "flex", borderRadius: 4, transition: "color .15s"
              }}
              onMouseEnter={e => e.currentTarget.style.color = t.text}
              onMouseLeave={e => e.currentTarget.style.color = t.textDim}
            >
              <Edit3 size={11} />
            </button>
          )}
          <button
            onMouseDown={e => { e.stopPropagation(); onDelete(node.id); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, padding: 2, display: "flex", borderRadius: 4 }}
            onMouseEnter={e => e.currentTarget.style.color = t.text}
            onMouseLeave={e => e.currentTarget.style.color = t.textDim}
          >
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 7 }}>
        {(node.fields || []).map((f, i) => (
          <div key={i}>
            {f.type === "text" && (
              <input
                defaultValue={f.value}
                placeholder={f.placeholder}
                style={{
                  width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                  borderRadius: 5, padding: "4px 8px", fontSize: 11, color: t.text,
                  fontFamily: "inherit", outline: "none"
                }}
                onMouseDown={e => e.stopPropagation()}
                onChange={e => onFieldChange(node.id, i, e.target.value)}
              />
            )}
            {f.type === "textarea" && (
              <div style={{ position: "relative" }}>
                <textarea
                  value={f.value}
                  placeholder={f.placeholder}
                  rows={3}
                  style={{
                    width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                    borderRadius: 5, padding: "5px 8px", fontSize: 11, color: t.textMuted,
                    fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5
                  }}
                  onMouseDown={e => e.stopPropagation()}
                  onChange={e => onFieldChange(node.id, i, e.target.value)}
                />
                {/* Edit hint overlay when empty */}
                {!f.value && (
                  <div
                    onMouseDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onOpenEditor(node.id); }}
                    style={{
                      position: "absolute", bottom: 6, right: 6,
                      display: "flex", alignItems: "center", gap: 3,
                      fontSize: 9, color: t.textDim, cursor: "pointer",
                      padding: "2px 5px", borderRadius: 3, background: t.surface2,
                      border: `1px solid ${t.border}`
                    }}
                  >
                    <Edit3 size={8} />edit
                  </div>
                )}
              </div>
            )}
            {f.type === "select" && (
              <div style={{ position: "relative" }}>
                <select
                  value={f.value}
                  style={{
                    width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
                    borderRadius: 5, padding: "4px 24px 4px 8px", fontSize: 11, color: t.text,
                    fontFamily: "inherit", outline: "none", cursor: "pointer", appearance: "none"
                  }}
                  onMouseDown={e => e.stopPropagation()}
                  onChange={e => onFieldChange(node.id, i, e.target.value)}
                >
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={10} color={t.textMuted} style={{ position: "absolute", right: 7, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              </div>
            )}
            {f.type === "slider" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 10, color: t.textMuted }}>{f.label}</span>
                  <span style={{ fontSize: 10, color: t.text }}>{f.value}</span>
                </div>
                <input
                  type="range" min={f.min} max={f.max} step={f.step} value={f.value}
                  style={{ width: "100%", accentColor: t.accent }}
                  onMouseDown={e => e.stopPropagation()}
                  onChange={e => onFieldChange(node.id, i, parseFloat(e.target.value))}
                />
              </div>
            )}
            {f.type === "tags" && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {f.value.map(tag => (
                  <span key={tag} style={{
                    padding: "2px 7px", borderRadius: 4, fontSize: 10,
                    background: t.surface2, color: t.textMuted,
                    border: `1px solid ${t.border}`,
                  }}>{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* LEFT handle */}
      <div
        onMouseUp={e => {
          e.stopPropagation();
          if (connectingFrom && connectingFrom !== node.id) onCompleteConnect(node.id);
        }}
        style={{
          position: "absolute", left: -6, top: "50%", transform: "translateY(-50%)",
          width: 12, height: 12, borderRadius: "50%",
          background: isTarget ? t.text : t.handle,
          border: `2px solid ${t.bg}`,
          cursor: isTarget ? "crosshair" : "default",
          zIndex: 10, transition: "background .15s, transform .15s",
          ...(isTarget ? { transform: "translateY(-50%) scale(1.4)" } : {}),
        }}
      />

      {/* RIGHT handle */}
      <div
        onMouseDown={e => { e.stopPropagation(); onStartConnect(node.id, e); }}
        style={{
          position: "absolute", right: -6, top: "50%", transform: "translateY(-50%)",
          width: 12, height: 12, borderRadius: "50%",
          background: connectingFrom === node.id ? t.text : t.handle,
          border: `2px solid ${t.bg}`,
          cursor: "crosshair", zIndex: 10, transition: "background .15s, transform .15s",
        }}
        onMouseEnter={e => { if (!connectingFrom) e.currentTarget.style.transform = "translateY(-50%) scale(1.4)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(-50%)"; }}
      />
    </div>
  );
}

// ─── BEZIER HELPER ────────────────────────────────────────────────────────────
function makePath(fx, fy, tx, ty) {
  const dx = Math.abs(tx - fx);
  const cx1 = fx + Math.max(50, dx * 0.5);
  const cx2 = tx - Math.max(50, dx * 0.5);
  return `M${fx},${fy} C${cx1},${fy} ${cx2},${ty} ${tx},${ty}`;
}

// ─── FLOW CANVAS ──────────────────────────────────────────────────────────────
let nodeIdCounter = 20;
const INITIAL_NODES = [
  {
    id: "1", type: "github", x: 60, y: 160, label: "GitHub Repo",
    fields: [{ type: "text", placeholder: "Enter GitHub URL", value: "" }, { type: "tags", value: ["README", "Structure", "Files"] }]
  },
  {
    id: "2", type: "llm", x: 340, y: 140, label: "Generate README",
    fields: [
      { type: "select", value: "claude-sonnet-4", options: ["claude-sonnet-4", "claude-opus-4", "gpt-4o"] },
      { type: "textarea", placeholder: "System prompt…", value: "You are a technical documentation expert." },
      { type: "textarea", placeholder: "User prompt…", value: "Based on the repo context, generate a comprehensive README.md with Overview, Features, Installation, Usage sections." },
      { type: "slider", label: "Temp:", min: 0, max: 1, step: 0.1, value: 0.7 }
    ]
  },
  {
    id: "3", type: "output", x: 640, y: 160, label: "README Output",
    fields: [{ type: "select", value: "README.md", options: ["README.md", "JSON", "Markdown", "HTML"] }, { type: "tags", value: ["Output: readme.md"] }]
  },
];
const INITIAL_EDGES = [
  { id: "e1", from: "1", to: "2" },
  { id: "e2", from: "2", to: "3" },
];

function FlowCanvas({ theme: t }) {
  const [nodes, setNodes] = useState(INITIAL_NODES);
  const [edges, setEdges] = useState(INITIAL_EDGES);
  const [selected, setSelected] = useState(null);
  const [running, setRunning] = useState(false);
  const [runLog, setRunLog] = useState([]);
  const [showLog, setShowLog] = useState(false);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [editorNodeId, setEditorNodeId] = useState(null); // which node's editor is open
  const [savedPrompts, setSavedPrompts] = useState([
    {
      id: "sp1", name: "README Generator",
      system: "You are a technical documentation expert.",
      user: "Based on the repo context, generate a comprehensive README.md with Overview, Features, Installation, Usage sections."
    },
    {
      id: "sp2", name: "Code Reviewer",
      system: "You are a senior software engineer who reviews code for quality, security, and performance.",
      user: "Review the provided code and give specific, actionable feedback on improvements."
    },
  ]);

  const [connectingFrom, setConnectingFrom] = useState(null);
  const [dragPos, setDragPos] = useState({ x: 0, y: 0 });

  const dragging = useRef(null);
  const panning = useRef(null);
  const canvasRef = useRef();
  const nodeRefs = useRef({});
  const edgeIdCounter = useRef(10);
  const savedPromptCounter = useRef(10);

  const onNodeMouseDown = useCallback((nodeId, e) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    setSelected(nodeId);
    dragging.current = { nodeId, startX: e.clientX - node.x, startY: e.clientY - node.y };
  }, [nodes]);

  const onCanvasMouseDown = useCallback((e) => {
    const tag = e.target.tagName.toLowerCase();
    if (e.target === canvasRef.current || tag === "svg" || tag === "path" || tag === "rect" || tag === "circle") {
      setSelected(null);
      panning.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y };
    }
  }, [pan]);

  const onStartConnect = useCallback((nodeId, e) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setConnectingFrom(nodeId);
    setDragPos({ x: e.clientX - rect.left - pan.x, y: e.clientY - rect.top - pan.y });
  }, [pan]);

  const onCompleteConnect = useCallback((targetNodeId) => {
    if (!connectingFrom || connectingFrom === targetNodeId) { setConnectingFrom(null); return; }
    setEdges(es => {
      const exists = es.some(e => e.from === connectingFrom && e.to === targetNodeId);
      if (exists) return es;
      return [...es, { id: `e${++edgeIdCounter.current}`, from: connectingFrom, to: targetNodeId }];
    });
    setConnectingFrom(null);
  }, [connectingFrom]);

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
    panning.current = null;
    if (connectingFrom) setConnectingFrom(null);
  }, [connectingFrom]);

  const onDelete = useCallback((id) => {
    setNodes(ns => ns.filter(n => n.id !== id));
    setEdges(es => es.filter(e => e.from !== id && e.to !== id));
    if (selected === id) setSelected(null);
    if (editorNodeId === id) setEditorNodeId(null);
  }, [selected, editorNodeId]);

  const deleteEdge = useCallback((edgeId) => {
    setEdges(es => es.filter(e => e.id !== edgeId));
  }, []);

  const onFieldChange = useCallback((nodeId, fieldIdx, value) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? {
      ...n, fields: n.fields.map((f, i) => i === fieldIdx ? { ...f, value } : f)
    } : n));
  }, []);

  const addNode = useCallback((type) => {
    const id = String(++nodeIdCounter);
    const defaults = {
      github: [{ type: "text", placeholder: "Enter GitHub URL", value: "" }, { type: "tags", value: ["README"] }],
      llm: [
        { type: "select", value: "claude-sonnet-4", options: ["claude-sonnet-4", "claude-opus-4", "gpt-4o"] },
        { type: "textarea", placeholder: "System prompt…", value: "" },
        { type: "textarea", placeholder: "User prompt…", value: "" },
        { type: "slider", label: "Temp:", min: 0, max: 1, step: 0.1, value: 0.7 }
      ],
      rag: [{ type: "select", value: "cosine", options: ["cosine", "dot_product", "euclidean"] }, { type: "slider", label: "Top-K:", min: 1, max: 20, step: 1, value: 5 }],
      output: [{ type: "select", value: "Markdown", options: ["README.md", "JSON", "Markdown", "HTML"] }],
      web: [{ type: "text", placeholder: "Enter URL…", value: "" }],
      transform: [{ type: "select", value: "Chunk", options: ["Chunk", "Embed", "Summarize", "JSON → Text"] }],
    };
    setNodes(ns => [...ns, {
      id, type, label: NODE_META[type].label,
      x: 80 + Math.random() * 300, y: 100 + Math.random() * 200,
      fields: defaults[type] || []
    }]);
    // Auto-open editor for new LLM nodes
    if (type === "llm") setTimeout(() => setEditorNodeId(id), 50);
  }, []);

  // Save prompt from editor back to node
  const handleEditorSave = useCallback((nodeId, systemVal, userVal, saveName) => {
    setNodes(ns => ns.map(n => {
      if (n.id !== nodeId) return n;
      const newFields = n.fields.map(f => {
        if (f.type === "textarea" && f.placeholder?.includes("System")) return { ...f, value: systemVal };
        if (f.type === "textarea" && f.placeholder?.includes("User")) return { ...f, value: userVal };
        return f;
      });
      return { ...n, fields: newFields };
    }));
    if (saveName) {
      setSavedPrompts(sp => [...sp, {
        id: `sp${++savedPromptCounter.current}`,
        name: saveName,
        system: systemVal,
        user: userVal
      }]);
    }
  }, []);

  // Apply a saved prompt to a node
  const handleApplySaved = useCallback((nodeId, savedPrompt) => {
    setNodes(ns => ns.map(n => {
      if (n.id !== nodeId) return n;
      const newFields = n.fields.map(f => {
        if (f.type === "textarea" && f.placeholder?.includes("System")) return { ...f, value: savedPrompt.system || f.value };
        if (f.type === "textarea" && f.placeholder?.includes("User")) return { ...f, value: savedPrompt.user || f.value };
        return f;
      });
      return { ...n, fields: newFields };
    }));
  }, []);

  const handleDeleteSaved = useCallback((id) => {
    setSavedPrompts(sp => sp.filter(p => p.id !== id));
  }, []);

  const runPipeline = useCallback(async () => {
    setRunning(true); setShowLog(true); setRunLog([{ text: "▶  Pipeline started", dim: false }]);
    for (const node of nodes) {
      await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
      setRunLog(l => [...l, { text: `✓  ${node.label || NODE_META[node.type]?.label || "Node"} processed`, dim: true }]);
    }
    await new Promise(r => setTimeout(r, 300));
    setRunLog(l => [...l, { text: "✓  Pipeline complete", dim: false }]);
    setRunning(false);
  }, [nodes]);

  const editorNode = editorNodeId ? nodes.find(n => n.id === editorNodeId) : null;

  const edgePaths = edges.map(e => {
    const fromNode = nodes.find(n => n.id === e.from);
    const toNode = nodes.find(n => n.id === e.to);
    if (!fromNode || !toNode) return null;
    const from = getRightHandle(fromNode, nodeRefs);
    const to = getLeftHandle(toNode, nodeRefs);
    const d = makePath(from.x, from.y, to.x, to.y);
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    return (
      <g key={e.id}>
        <path d={d} fill="none" stroke="transparent" strokeWidth="12" style={{ cursor: "pointer" }} onClick={() => deleteEdge(e.id)} />
        <path d={d} fill="none" stroke={t.edgeColor} strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#arrowhead)" style={{ animation: "edgeDash 1.2s linear infinite", pointerEvents: "none" }} />
        <g transform={`translate(${mx}, ${my})`} style={{ cursor: "pointer" }} onClick={() => deleteEdge(e.id)}>
          <circle r="8" fill={t.surface} stroke={t.border2} strokeWidth="1" />
          <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" />
          <line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round" />
        </g>
      </g>
    );
  });

  let pendingPath = null;
  if (connectingFrom) {
    const fromNode = nodes.find(n => n.id === connectingFrom);
    if (fromNode) {
      const from = getRightHandle(fromNode, nodeRefs);
      const d = makePath(from.x, from.y, dragPos.x, dragPos.y);
      pendingPath = <path d={d} fill="none" stroke={t.text} strokeWidth="1.5" strokeDasharray="6 4" opacity="0.6" style={{ pointerEvents: "none" }} />;
    }
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg }}>
      {/* Palette */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 14px", borderBottom: `1px solid ${t.border}`, background: t.surface, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: t.textMuted, marginRight: 4, fontFamily: "monospace", letterSpacing: ".08em" }}>ADD NODE</span>
        {Object.entries(NODE_META).map(([type, meta]) => {
          const NodeIcon = meta.Icon;
          return (
            <button key={type} onClick={() => addNode(type)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
                borderRadius: 6, fontSize: 11, border: `1px solid ${t.border2}`,
                background: t.surface2, color: t.textMuted, cursor: "pointer", transition: "all .15s",
                fontFamily: "inherit"
              }}
              onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.text; }}
              onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border2; }}
            >
              <NodeIcon size={11} />{meta.label}
            </button>
          );
        })}
        <div style={{ flex: 1 }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: t.textDim, fontFamily: "monospace" }}>
            click <Edit3 size={9} style={{ display: "inline", verticalAlign: "middle" }} /> on LLM nodes to edit prompts
          </span>
          {savedPrompts.length > 0 && (
            <span style={{
              fontSize: 10, padding: "2px 7px", borderRadius: 4,
              background: t.savedTag, color: t.savedText,
              border: `1px solid ${t.savedBorder}`,
              display: "flex", alignItems: "center", gap: 4
            }}>
              <Bookmark size={9} />{savedPrompts.length} saved
            </span>
          )}
        </div>
      </div>

      {/* Canvas + Editor overlay */}
      <div style={{ flex: 1, position: "relative", display: "flex", overflow: "hidden" }}>
        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{
            flex: 1, position: "relative", overflow: "hidden",
            cursor: connectingFrom ? "crosshair" : "default"
          }}
          onMouseDown={onCanvasMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseUp}
        >
          <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", overflow: "visible" }}>
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse" x={pan.x % 24} y={pan.y % 24}>
                <circle cx="12" cy="12" r="0.8" fill={t.gridDot} />
              </pattern>
              <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L6,3.5 z" fill={t.edgeColor} />
              </marker>
            </defs>
            <style>{`@keyframes edgeDash { to { stroke-dashoffset: -36; } } @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
            <rect width="100%" height="100%" fill="url(#grid)" />
            <g transform={`translate(${pan.x}, ${pan.y})`}>
              {edgePaths}
              {pendingPath}
            </g>
          </svg>

          <div style={{ position: "absolute", inset: 0 }}>
            {nodes.map(n => (
              <div
                key={n.id}
                ref={el => { if (el) nodeRefs.current[n.id] = el; }}
                style={{ position: "absolute", left: n.x + pan.x, top: n.y + pan.y }}
              >
                <FlowNode
                  node={n}
                  selected={selected === n.id}
                  onDelete={onDelete}
                  onFieldChange={onFieldChange}
                  onMouseDown={e => onNodeMouseDown(n.id, e)}
                  onStartConnect={onStartConnect}
                  onCompleteConnect={onCompleteConnect}
                  connectingFrom={connectingFrom}
                  onOpenEditor={setEditorNodeId}
                  theme={t}
                />
              </div>
            ))}
          </div>

          {showLog && (
            <div style={{
              position: "absolute", bottom: 16, right: editorNode ? 416 : 16, width: 260,
              background: t.surface, border: `1px solid ${t.border}`, borderRadius: 10,
              overflow: "hidden", boxShadow: t.shadow, transition: "right .2s ease"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", borderBottom: `1px solid ${t.border}` }}>
                <span style={{ fontSize: 10, color: t.textMuted, fontFamily: "monospace", letterSpacing: ".08em" }}>RUN LOG</span>
                <button onClick={() => setShowLog(false)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, display: "flex" }}>
                  <X size={11} />
                </button>
              </div>
              <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4, maxHeight: 140, overflowY: "auto" }}>
                {runLog.map((l, i) => (
                  <span key={i} style={{ fontFamily: "monospace", fontSize: 11, color: l.dim ? t.textMuted : t.text }}>{l.text}</span>
                ))}
                {running && (
                  <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: t.textMuted, animation: `dot 1.4s ease infinite`, animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Prompt Editor Panel */}
        {editorNode && (
          <PromptEditorPanel
            node={editorNode}
            savedPrompts={savedPrompts}
            onSave={handleEditorSave}
            onClose={() => setEditorNodeId(null)}
            onApplySaved={handleApplySaved}
            onDeleteSaved={handleDeleteSaved}
            theme={t}
          />
        )}
      </div>
    </div>
  );
}

// ─── RAG ASSISTANT ────────────────────────────────────────────────────────────
function RAGAssistant({ theme: t }) {
  const [papers, setPapers] = useState([]);
  const [vectorStore, setVectorStore] = useState([]);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Upload research papers (PDF, TXT, MD) and ask questions. I'll retrieve relevant chunks to ground my answers." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pipeline, setPipeline] = useState(null);
  const fileRef = useRef();
  const chatRef = useRef();

  const extractText = useCallback(async (file) => {
    return new Promise(resolve => {
      const reader = new FileReader();
      reader.onload = e => {
        if (typeof e.target.result === "string") { resolve(e.target.result); return; }
        const arr = new Uint8Array(e.target.result);
        let text = "", buf = "";
        for (let i = 0; i < arr.length; i++) {
          const c = arr[i];
          if (c >= 32 && c < 127) buf += String.fromCharCode(c);
          else if (buf.length > 4) { text += buf + " "; buf = ""; }
          else buf = "";
        }
        resolve((text + buf).replace(/\s{3,}/g, " ").trim() || "[No readable text found]");
      };
      if (file.name.endsWith(".txt") || file.name.endsWith(".md") || file.type.startsWith("text")) reader.readAsText(file);
      else reader.readAsArrayBuffer(file);
    });
  }, []);

  const ingest = useCallback(async (files) => {
    setIngesting(true);
    const newPapers = [...papers], newStore = [...vectorStore];
    for (const file of files) {
      if (newPapers.find(p => p.name === file.name)) continue;
      const text = await extractText(file);
      const chunks = chunkText(text);
      newPapers.push({ name: file.name, chunks: chunks.length, size: file.size });
      chunks.forEach(chunk => newStore.push({ chunkText: chunk, embedding: naiveEmbed(chunk), paperName: file.name }));
    }
    setPapers(newPapers); setVectorStore(newStore); setIngesting(false);
  }, [papers, vectorStore, extractText]);

  const query = useCallback(async (q) => {
    if (!q.trim()) return;
    setInput("");
    setMessages(m => [...m, { role: "user", content: q }]);
    setLoading(true);
    const qEmbed = naiveEmbed(q);
    const steps = ["Embedding query…", "Searching vector store…"];
    let context = "";
    if (vectorStore.length > 0) {
      const top = vectorStore.map(item => ({ ...item, score: cosineSim(qEmbed, item.embedding) }))
        .sort((a, b) => b.score - a.score).slice(0, 6);
      context = top.map(s => `[${s.paperName}]\n${s.chunkText}`).join("\n\n---\n\n");
      steps.push(`Retrieved ${top.length} chunks from ${[...new Set(top.map(s => s.paperName))].length} paper(s)`);
    } else {
      steps.push("No documents – answering from general knowledge");
    }
    steps.push("Generating answer…");
    setPipeline(steps);
    const systemPrompt = vectorStore.length > 0
      ? `You are a research assistant. Answer ONLY using the provided context. Cite paper names. Be precise.\n\nCONTEXT:\n${context}`
      : "You are a helpful research assistant. No documents uploaded yet. Answer generally.";
    try {
      const resp = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514", max_tokens: 1000,
          system: systemPrompt,
          messages: [{ role: "user", content: q }]
        })
      });
      const data = await resp.json();
      setMessages(m => [...m, { role: "assistant", content: data.content?.[0]?.text || "No response generated." }]);
    } catch {
      setMessages(m => [...m, { role: "assistant", content: "API error — check your connection." }]);
    }
    setLoading(false); setPipeline(null);
    setTimeout(() => chatRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 80);
  }, [vectorStore]);

  const removePaper = (name) => {
    setPapers(p => p.filter(x => x.name !== name));
    setVectorStore(v => v.filter(x => x.paperName !== name));
  };

  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      <aside style={{ width: 264, flexShrink: 0, display: "flex", flexDirection: "column", background: t.surface, borderRight: `1px solid ${t.border}` }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: `1px solid ${t.border}` }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 4 }}>
            <Brain size={15} color={t.textMuted} strokeWidth={1.8} />
            <span style={{ fontWeight: 600, fontSize: 13, color: t.text, letterSpacing: "-.02em" }}>Research Papers</span>
          </div>
          <p style={{ fontSize: 11, color: t.textMuted }}>Upload PDFs to ground AI answers</p>
        </div>
        <div
          style={{
            margin: "10px 10px 6px", borderRadius: 8,
            border: `1.5px dashed ${dragOver ? t.text : t.border2}`,
            background: dragOver ? t.surface2 : "transparent",
            padding: "14px 10px", textAlign: "center", cursor: "pointer", transition: "all .2s"
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); ingest([...e.dataTransfer.files]); }}
          onClick={() => fileRef.current.click()}
        >
          <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" style={{ display: "none" }} onChange={e => ingest([...e.target.files])} />
          {ingesting
            ? <Loader2 size={18} color={t.textMuted} style={{ margin: "0 auto 6px", display: "block", animation: "spin .7s linear infinite" }} />
            : <Upload size={18} color={dragOver ? t.text : t.textDim} style={{ margin: "0 auto 6px", display: "block" }} />
          }
          <p style={{ fontSize: 11, color: ingesting ? t.text : t.textMuted }}>
            {ingesting ? "Processing files…" : "Drop files or click to upload"}
          </p>
          <p style={{ fontSize: 10, color: t.textDim, marginTop: 2 }}>PDF · TXT · MD</p>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 6 }}>
          {papers.length === 0
            ? <p style={{ fontSize: 11, color: t.textDim, textAlign: "center", marginTop: 20 }}>No papers yet</p>
            : papers.map(p => (
              <div key={p.name} style={{ display: "flex", alignItems: "flex-start", gap: 8, background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 8px" }}>
                <File size={12} color={t.textMuted} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: t.textMuted }}>{p.chunks} chunks · {(p.size / 1024).toFixed(1)}KB</p>
                </div>
                <button onClick={() => removePaper(p.name)} style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex", padding: 2 }}
                  onMouseEnter={e => e.currentTarget.style.color = t.text}
                  onMouseLeave={e => e.currentTarget.style.color = t.textDim}>
                  <X size={11} />
                </button>
              </div>
            ))
          }
        </div>
        {vectorStore.length > 0 && (
          <div style={{ margin: "0 10px 10px", padding: "7px 10px", borderRadius: 7, background: t.surface2, border: `1px solid ${t.border}` }}>
            <p style={{ fontSize: 11, color: t.textMuted }}>
              <strong style={{ color: t.text }}>{vectorStore.length}</strong> vectors · <strong style={{ color: t.text }}>{papers.length}</strong> paper{papers.length !== 1 ? "s" : ""}
            </p>
          </div>
        )}
      </aside>

      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg }}>
        <div style={{ display: "flex", gap: 6, padding: "8px 14px", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap", background: t.surface }}>
          {PRESETS.map(({ Icon: PI, label, prompt }) => (
            <button key={label} onClick={() => query(prompt)}
              style={{
                display: "flex", alignItems: "center", gap: 5, padding: "5px 11px",
                borderRadius: 6, fontSize: 11, border: `1px solid ${t.border}`,
                background: t.surface2, color: t.textMuted, cursor: "pointer", transition: "all .15s"
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.border2; e.currentTarget.style.color = t.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}
            >
              <PI size={12} color={t.textMuted} />{label}
            </button>
          ))}
        </div>
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", gap: 8, alignItems: "flex-start", animation: "fadeIn .2s ease forwards" }}>
              {m.role === "assistant" && (
                <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: t.surface2, border: `1px solid ${t.border}`, flexShrink: 0, marginTop: 2 }}>
                  <Brain size={13} color={t.textMuted} strokeWidth={1.8} />
                </div>
              )}
              <div style={{
                maxWidth: "68%", borderRadius: 12, padding: "10px 14px", fontSize: 13, lineHeight: 1.65,
                background: m.role === "user" ? t.msgUser : t.surface,
                color: m.role === "user" ? t.msgUserText : t.text,
                border: m.role === "assistant" ? `1px solid ${t.border}` : "none",
                whiteSpace: "pre-wrap"
              }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 8, alignItems: "flex-start", animation: "fadeIn .2s ease forwards" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: t.surface2, border: `1px solid ${t.border}`, flexShrink: 0, marginTop: 2 }}>
                <Brain size={13} color={t.textMuted} strokeWidth={1.8} />
              </div>
              <div style={{ borderRadius: 12, padding: "10px 14px", background: t.surface, border: `1px solid ${t.border}` }}>
                {pipeline ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {pipeline.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11 }}>
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: i === pipeline.length - 1 ? t.text : t.textMuted, flexShrink: 0 }} />
                        <span style={{ color: i === pipeline.length - 1 ? t.text : t.textMuted, fontFamily: "monospace" }}>{s}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: t.textMuted, animation: `dot 1.4s ease infinite`, animationDelay: `${i * 0.2}s` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        <div style={{ padding: "12px 16px", borderTop: `1px solid ${t.border}`, background: t.surface }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 12, padding: "8px 10px 8px 14px" }}>
            <input
              style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13, color: t.text, fontFamily: "inherit" }}
              placeholder={papers.length ? "Ask about your papers…" : "Upload papers, then ask questions…"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && query(input)}
            />
            <button
              onClick={() => query(input)}
              disabled={loading || !input.trim()}
              style={{
                width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                cursor: loading || !input.trim() ? "default" : "pointer",
                background: loading || !input.trim() ? t.surface2 : t.text,
                border: `1px solid ${t.border}`, transition: "background .15s"
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

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage] = useState("rag");
  const [dark, setDark] = useState(true);
  const [flowName, setFlowName] = useState("README Generator");
  const [editingName, setEditingName] = useState(false);

  const t = dark ? themes.dark : themes.light;

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${t.bg}; color: ${t.text}; font-family: 'DM Sans', sans-serif; height: 100vh; overflow: hidden; }
    #root { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes dot { 0%,100% { opacity: .25; } 50% { opacity: 1; } }
    @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${t.border2}; border-radius: 2px; }
    input[type=range] { -webkit-appearance: none; height: 3px; border-radius: 2px; background: ${t.border}; outline: none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; width: 12px; height: 12px; border-radius: 50%; background: ${t.text}; cursor: pointer; }
    select { -webkit-appearance: none; appearance: none; }
  `;

  return (
    <>
      <style>{css}</style>
      <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden", background: t.bg }}>
        <header style={{
          display: "flex", alignItems: "center", height: 46, padding: "0 14px", gap: 10,
          borderBottom: `1px solid ${t.border}`, background: t.surface, flexShrink: 0
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginRight: 4 }}>
            <div style={{ width: 20, height: 20, borderRadius: 7, display: "flex", alignItems: "center", justifyContent: "center", background: t.surface2, border: `1px solid ${t.border}` }}>
              <Zap size={12} color={t.textMuted} />
            </div>
            <span style={{ fontWeight: 700, fontSize: 14, color: t.text, letterSpacing: "-.03em", fontFamily: "'DM Sans', sans-serif" }}>FrameWork</span>
          </div>

          <div style={{ width: 1, height: 20, background: t.border, marginRight: 2 }} />

          {[
            { id: "rag", Icon: Brain, label: "RAG Research" },
            { id: "flow", Icon: Workflow, label: "Flow Builder" },
          ].map(({ id, Icon: TabIcon, label }) => (
            <button key={id} onClick={() => setPage(id)}
              style={{
                display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", borderRadius: 7,
                fontSize: 12, cursor: "pointer", transition: "all .15s",
                background: page === id ? t.surface2 : "transparent",
                color: page === id ? t.text : t.textMuted,
                border: `1px solid ${page === id ? t.border2 : "transparent"}`,
                fontWeight: page === id ? 500 : 400
              }}>
              <TabIcon size={13} strokeWidth={1.8} />{label}
            </button>
          ))}

          {page === "flow" && (
            <>
              <div style={{ width: 1, height: 20, background: t.border }} />
              {editingName
                ? <input autoFocus value={flowName}
                  onChange={e => setFlowName(e.target.value)}
                  onBlur={() => setEditingName(false)}
                  onKeyDown={e => e.key === "Enter" && setEditingName(false)}
                  style={{ background: "transparent", border: "none", outline: "none", fontSize: 12, color: t.text, fontFamily: "'DM Mono', monospace", minWidth: 180 }}
                />
                : <span onClick={() => setEditingName(true)}
                  style={{ fontSize: 12, color: t.text, fontFamily: "'DM Mono', monospace", cursor: "text", padding: "4px 8px", borderRadius: 6 }}
                  onMouseEnter={e => e.currentTarget.style.background = t.surface2}
                  onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                >
                  {flowName}
                </span>
              }
            </>
          )}

          <div style={{ flex: 1 }} />

          <button
            onClick={() => setDark(d => !d)}
            style={{
              width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
              background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 7, cursor: "pointer",
              color: t.textMuted, transition: "all .15s"
            }}
            onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.border2; }}
            onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border; }}
          >
            {dark ? <Sun size={14} /> : <Moon size={14} />}
          </button>

          {page === "flow" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              {[Save, Trash2].map((BtnIcon, i) => (
                <button key={i} style={{
                  width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center",
                  background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 7, cursor: "pointer",
                  color: t.textMuted, transition: "all .15s"
                }}
                  onMouseEnter={e => { e.currentTarget.style.color = t.text; e.currentTarget.style.borderColor = t.border2; }}
                  onMouseLeave={e => { e.currentTarget.style.color = t.textMuted; e.currentTarget.style.borderColor = t.border; }}>
                  <BtnIcon size={13} />
                </button>
              ))}
              <button style={{
                display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 7,
                fontSize: 12, fontWeight: 600, background: t.text, color: t.bg,
                border: "none", cursor: "pointer", transition: "opacity .15s"
              }}
                onMouseEnter={e => e.currentTarget.style.opacity = ".8"}
                onMouseLeave={e => e.currentTarget.style.opacity = "1"}
              >
                <Play size={12} />Run
              </button>
            </div>
          )}
        </header>

        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          {page === "rag" && <RAGAssistant theme={t} />}
          {page === "flow" && <FlowCanvas theme={t} />}
        </div>
      </div>
    </>
  );
}