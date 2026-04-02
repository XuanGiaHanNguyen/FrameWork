import { CheckCircle2, ChevronDown, Edit3, Loader2, X } from "lucide-react";
import { NODE_META } from "../constant";

// ─── FLOW NODE ────────────────────────────────────────────────────────────────
/**
 * A draggable node card rendered on the flow canvas.
 *
 * Props:
 *   node           – node data object
 *   selected       – boolean
 *   onDelete       – (nodeId) => void
 *   onFieldChange  – (nodeId, fieldIndex, value) => void
 *   onMouseDown    – (e) => void  (initiates drag)
 *   onStartConnect – (nodeId, e) => void  (starts edge draw from right handle)
 *   onCompleteConnect – (nodeId) => void  (completes edge draw to left handle)
 *   connectingFrom – nodeId currently being connected from, or null
 *   onOpenEditor   – (nodeId) => void  (opens PromptEditorPanel)
 *   runStatus      – null | "running" | "done" | "error"
 *   theme          – theme object (t)
 */
export function FlowNode({
  node, selected, onDelete, onFieldChange,
  onMouseDown, onStartConnect, onCompleteConnect,
  connectingFrom, onOpenEditor, runStatus, theme: t,
}) {
  const meta     = NODE_META[node.type] || NODE_META.output;
  const NodeIcon = meta.Icon;
  const isTarget = connectingFrom && connectingFrom !== node.id;
  const isLLM    = node.type === "llm";
  const hasPrompt = node.fields?.some(f => f.type === "textarea" && f.value?.trim());

  // Border glow colour during a pipeline run
  const runBorder =
    runStatus === "running" ? t.warnColor
    : runStatus === "done"  ? t.okColor
    : runStatus === "error" ? t.errColor
    : null;

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: 220, cursor: "grab",
        background: t.surface,
        border: `1px solid ${runBorder || (selected ? t.text : isTarget ? t.accent : t.border)}`,
        borderRadius: 10,
        boxShadow: runBorder ? `0 0 12px ${runBorder}44` : selected ? t.nodeGlow : t.shadow,
        userSelect: "none", transition: "border-color .15s, box-shadow .15s",
        fontFamily: "'DM Mono', monospace", position: "relative",
      }}
    >
      {/* ── Header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 10px", background: t.surface2,
        borderRadius: "9px 9px 0 0", borderBottom: `1px solid ${t.border}`,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <NodeIcon size={13} color={t.textMuted} strokeWidth={1.8} />
          <span style={{ fontSize: 11, fontWeight: 500, color: t.text }}>{node.label || meta.label}</span>
          {isLLM && hasPrompt && (
            <span style={{
              fontSize: 9, padding: "1px 5px", borderRadius: 3,
              background: t.savedTag, color: t.savedText, border: `1px solid ${t.savedBorder}`,
            }}>
              saved
            </span>
          )}
          {runStatus === "running" && <Loader2 size={10} color={t.warnColor} style={{ animation: "spin .7s linear infinite" }} />}
          {runStatus === "done"    && <CheckCircle2 size={10} color={t.okColor} />}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
          {isLLM && (
            <button
              onMouseDown={e => e.stopPropagation()}
              onClick={e => { e.stopPropagation(); onOpenEditor(node.id); }}
              style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, padding: 2, display: "flex", borderRadius: 4 }}
              onMouseEnter={e => e.currentTarget.style.color = t.text}
              onMouseLeave={e => e.currentTarget.style.color = t.textDim}
              title="Edit prompt"
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

      {/* ── Fields ── */}
      <div style={{ padding: "10px", display: "flex", flexDirection: "column", gap: 7 }}>
        {(node.fields || []).map((f, i) => (
          <NodeField
            key={i} field={f} index={i} nodeId={node.id}
            onOpenEditor={onOpenEditor} onFieldChange={onFieldChange} theme={t}
          />
        ))}
      </div>

      {/* ── Left handle (input) ── */}
      <div
        onMouseUp={e => {
          e.stopPropagation();
          if (connectingFrom && connectingFrom !== node.id) onCompleteConnect(node.id);
        }}
        style={{
          position: "absolute", left: -6, top: "50%",
          transform: isTarget ? "translateY(-50%) scale(1.4)" : "translateY(-50%)",
          width: 12, height: 12, borderRadius: "50%",
          background: isTarget ? t.text : t.handle,
          border: `2px solid ${t.bg}`,
          cursor: isTarget ? "crosshair" : "default", zIndex: 10,
        }}
      />

      {/* ── Right handle (output) ── */}
      <div
        onMouseDown={e => { e.stopPropagation(); onStartConnect(node.id, e); }}
        style={{
          position: "absolute", right: -6, top: "50%",
          transform: "translateY(-50%)",
          width: 12, height: 12, borderRadius: "50%",
          background: connectingFrom === node.id ? t.text : t.handle,
          border: `2px solid ${t.bg}`,
          cursor: "crosshair", zIndex: 10,
        }}
        onMouseEnter={e => { if (!connectingFrom) e.currentTarget.style.transform = "translateY(-50%) scale(1.4)"; }}
        onMouseLeave={e => { e.currentTarget.style.transform = "translateY(-50%)"; }}
      />
    </div>
  );
}

// ─── INDIVIDUAL FIELD RENDERERS ───────────────────────────────────────────────
function NodeField({ field: f, index: i, nodeId, onOpenEditor, onFieldChange, theme: t }) {
  if (f.type === "text") {
    return (
      <input
        defaultValue={f.value} placeholder={f.placeholder}
        style={{
          width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
          borderRadius: 5, padding: "4px 8px", fontSize: 11, color: t.text,
          fontFamily: "inherit", outline: "none",
        }}
        onMouseDown={e => e.stopPropagation()}
        onChange={e => onFieldChange(nodeId, i, e.target.value)}
      />
    );
  }

  if (f.type === "textarea") {
    return (
      <div style={{ position: "relative" }}>
        <textarea
          value={f.value} placeholder={f.placeholder} rows={3}
          style={{
            width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
            borderRadius: 5, padding: "5px 8px", fontSize: 11, color: t.textMuted,
            fontFamily: "inherit", outline: "none", resize: "none", lineHeight: 1.5,
          }}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => onFieldChange(nodeId, i, e.target.value)}
        />
        {!f.value && (
          <div
            onMouseDown={e => e.stopPropagation()}
            onClick={e => { e.stopPropagation(); onOpenEditor(nodeId); }}
            style={{
              position: "absolute", bottom: 6, right: 6,
              display: "flex", alignItems: "center", gap: 3,
              fontSize: 9, color: t.textDim, cursor: "pointer",
              padding: "2px 5px", borderRadius: 3,
              background: t.surface2, border: `1px solid ${t.border}`,
            }}
          >
            <Edit3 size={8} />edit
          </div>
        )}
      </div>
    );
  }

  if (f.type === "select") {
    return (
      <div style={{ position: "relative" }}>
        <select
          value={f.value}
          style={{
            width: "100%", background: t.inputBg, border: `1px solid ${t.border}`,
            borderRadius: 5, padding: "4px 24px 4px 8px", fontSize: 11,
            color: t.text, fontFamily: "inherit", outline: "none",
            cursor: "pointer", appearance: "none",
          }}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => onFieldChange(nodeId, i, e.target.value)}
        >
          {f.options.map(o => <option key={o}>{o}</option>)}
        </select>
        <ChevronDown size={10} color={t.textMuted} style={{
          position: "absolute", right: 7, top: "50%",
          transform: "translateY(-50%)", pointerEvents: "none",
        }} />
      </div>
    );
  }

  if (f.type === "slider") {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: t.textMuted }}>{f.label}</span>
          <span style={{ fontSize: 10, color: t.text }}>{f.value}</span>
        </div>
        <input
          type="range" min={f.min} max={f.max} step={f.step} value={f.value}
          style={{ width: "100%", accentColor: t.accent }}
          onMouseDown={e => e.stopPropagation()}
          onChange={e => onFieldChange(nodeId, i, parseFloat(e.target.value))}
        />
      </div>
    );
  }

  if (f.type === "tags") {
    return (
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {f.value.map(tag => (
          <span key={tag} style={{
            padding: "2px 7px", borderRadius: 4, fontSize: 10,
            background: t.surface2, color: t.textMuted, border: `1px solid ${t.border}`,
          }}>
            {tag}
          </span>
        ))}
      </div>
    );
  }

  return null;
}