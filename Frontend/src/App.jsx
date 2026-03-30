import { useState, useCallback, useRef, useEffect } from "react";
import {
  Brain, Upload, File, X, Send, Layers, AlignLeft, HelpCircle,
  BookOpen, Loader2, Workflow, Zap, Database, Globe,
  SlidersHorizontal, ChevronDown, Play, Trash2, Save,
  Sun, Moon, FileText, Edit3, BookMarked, Check,
  Bookmark, Copy, CornerDownLeft, Server, AlertCircle,
  CheckCircle2, ChevronRight, Terminal, Search, Plus, FolderOpen, MoreHorizontal, Hash, Clock,
  ArrowLeft
} from "lucide-react";
import ReactMarkdown from "react-markdown";

// ─── BACKEND CONFIG ────────────────────────────────────────────────────────────
const API = "http://localhost:3001/api";

// ─── THEME ────────────────────────────────────────────────────────────────────
const themes = {
  dark: {
    bg:         "#171717",
    surface:    "#191919",
    surface2:   "#1e1e1e",
    surface3:   "#222222",
    border:     "#242424",
    border2:    "#2e2e2e",
    text:       "#f0f0f0",
    textMuted:  "#666666",
    textDim:    "#333333",
    accent:     "#f0f0f0",
    inputBg:    "#0d0d0d",
    msgUser:    "#f0f0f0",
    msgUserTxt: "#080808",
    shadow:     "0 4px 24px rgba(0,0,0,.6)",
    nodeGlow:   "0 0 0 1px #f0f0f022, 0 8px 32px rgba(0,0,0,.5)",
    handle:     "#f0f0f0",
    edgeColor:  "#888",
    gridDot:    "#1e1e1e",
    savedTag:   "#2a2a1a",
    savedBorder:"#4a4a2a",
    savedText:  "#c8c060",
    panelBg:    "#111",
    okColor:    "#4ade80",
    errColor:   "#f87171",
    warnColor:  "#fbbf24",
  },
  light: {
    bg:         "#fafafa",
    surface:    "#ffffff",
    surface2:   "#f2f2f2",
    surface3:   "#ebebeb",
    border:     "#e0e0e0",
    border2:    "#d0d0d0",
    text:       "#3d3d3d",
    textMuted:  "#888",
    textDim:    "#ccc",
    accent:     "#3b3b3b",
    inputBg:    "#f7f7f7",
    msgUser:    "#3d3d3d",
    msgUserTxt: "#ffffff",
    shadow:     "0 4px 24px rgba(0,0,0,.08)",
    nodeGlow:   "0 0 0 1px #11111122, 0 8px 32px rgba(0,0,0,.1)",
    handle:     "#3d3d3d",
    edgeColor:  "#999",
    gridDot:    "#e8e8e8",
    savedTag:   "#fefce8",
    savedBorder:"#d4c44a",
    savedText:  "#8a7a10",
    panelBg:    "#f5f5f5",
    okColor:    "#16a34a",
    errColor:   "#dc2626",
    warnColor:  "#d97706",
  }
};

// ─── PRESET QUESTIONS ─────────────────────────────────────────────────────────
const PRESETS = [
  { Icon: AlignLeft,  label: "Summarize all",   prompt: "Summarize each uploaded paper in 2–3 sentences. Do not repeat summaries." },
  { Icon: Layers,     label: "Compare methods", prompt: "What are the main methodological differences between these papers?" },
  { Icon: HelpCircle, label: "Limitations",     prompt: "What limitations are mentioned across the papers?" },
  { Icon: BookOpen,   label: "Common themes",   prompt: "What themes or topics recur across all the papers?" },
];

// ─── NODE META ────────────────────────────────────────────────────────────────
const NODE_META = {
  github:    { label: "GitHub Repo",    Icon: Brain },
  llm:       { label: "LLM",           Icon: Brain },
  rag:       { label: "RAG Retriever", Icon: Database },
  output:    { label: "Output",        Icon: FileText },
  web:       { label: "Web Scraper",   Icon: Globe },
  transform: { label: "Transform",     Icon: SlidersHorizontal },
};
const NODE_WIDTH = 220;

// ─── SSE READER & ??? ───────────────────────────────────────────────────────────────
async function* readSSE(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop();
    for (const part of parts) {
      const line = part.replace(/^data: /, "").trim();
      if (line) { try { yield JSON.parse(line); } catch {} }
    }
  }
}
 

// ─── SERVER STATUS BADGE ──────────────────────────────────────────────────────
function ServerBadge({ status, theme: t }) {
  const color = status === "ok" ? t.okColor : status === "checking" ? t.warnColor : t.errColor;
  const label = status === "ok" ? "Backend live" : status === "checking" ? "Connecting…" : "Backend offline";
  const Icon  = status === "ok" ? CheckCircle2 : status === "checking" ? Loader2 : AlertCircle;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color }}>
      <Icon size={12} style={status === "checking" ? { animation: "spin .8s linear infinite" } : {}} />
      {label}
    </div>
  );
}

// ─── PROMPT EDITOR PANEL ──────────────────────────────────────────────────────
function PromptEditorPanel({ node, savedPrompts, onSave, onClose, onApplySaved, onDeleteSaved, theme: t }) {
  const sysField  = node.fields?.find(f => f.placeholder?.toLowerCase().includes("system"));
  const userField = node.fields?.find(f => f.placeholder?.toLowerCase().includes("user"));
  const [sysVal,  setSysVal]  = useState(sysField?.value  || "");
  const [userVal, setUserVal] = useState(userField?.value || "");
  const [saveName, setSaveName] = useState("");
  const [tab, setTab] = useState("edit");
  const [copied, setCopied] = useState(null);
  const [saving, setSaving] = useState(false);

  const applyToNode = () => { onSave(node.id, sysVal, userVal); };

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

  return (
    <div style={{
      position: "absolute", right: 0, top: 0, bottom: 0, width: 400, zIndex: 50,
      background: t.panelBg, borderLeft: `1px solid ${t.border2}`,
      display: "flex", flexDirection: "column",
      boxShadow: "-8px 0 32px rgba(0,0,0,.25)",
      fontFamily: "'DM Mono', monospace",
      animation: "slideIn .18s ease forwards"
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 14px", borderBottom:`1px solid ${t.border}`, background: t.surface }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <Edit3 size={13} color={t.textMuted} />
          <span style={{ fontSize:12, fontWeight:600, color:t.text }}>Prompt Editor</span>
          <span style={{ fontSize:10, padding:"1px 7px", borderRadius:4, background:t.savedTag, color:t.savedText, border:`1px solid ${t.savedBorder}` }}>{node.label}</span>
        </div>
        <button onClick={onClose} style={{ background:"none", border:"none", cursor:"pointer", color:t.textMuted, display:"flex", padding:4 }}
          onMouseEnter={e=>e.currentTarget.style.color=t.text} onMouseLeave={e=>e.currentTarget.style.color=t.textMuted}>
          <X size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display:"flex", borderBottom:`1px solid ${t.border}`, background:t.surface }}>
        {[{id:"edit",Icon:Edit3,label:"Edit"},{id:"library",Icon:BookMarked,label:`Library (${savedPrompts.length})`}].map(({id,Icon:TI,label})=>(
          <button key={id} onClick={()=>setTab(id)} style={{
            flex:1, padding:"9px 0", display:"flex", alignItems:"center", justifyContent:"center", gap:6,
            fontSize:11, cursor:"pointer", background:"transparent", border:"none",
            borderBottom: tab===id ? `2px solid ${t.text}` : "2px solid transparent",
            color: tab===id ? t.text : t.textMuted, fontFamily:"inherit"
          }}><TI size={12} />{label}</button>
        ))}
      </div>

      {tab === "edit" && (
        <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>
          {/* System prompt */}
          <div style={{ padding:"14px 14px 10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
              <span style={{ fontSize:10, color:t.textMuted, letterSpacing:".08em" }}>SYSTEM PROMPT</span>
              <button onClick={()=>copy(sysVal,"sys")} style={{ background:"none",border:"none",cursor:"pointer",color:t.textDim,display:"flex",gap:4,alignItems:"center",fontSize:10,fontFamily:"inherit" }}
                onMouseEnter={e=>e.currentTarget.style.color=t.textMuted} onMouseLeave={e=>e.currentTarget.style.color=t.textDim}>
                {copied==="sys"?<Check size={11}/>:<Copy size={11}/>}{copied==="sys"?"copied":"copy"}
              </button>
            </div>
            <textarea value={sysVal} onChange={e=>setSysVal(e.target.value)} placeholder="You are a helpful assistant…" rows={6}
              style={{ width:"100%", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:7, padding:"9px 11px", fontSize:11.5, color:t.text, fontFamily:"inherit", outline:"none", resize:"vertical", lineHeight:1.6 }} />
          </div>
          <div style={{ height:1, background:t.border, margin:"0 14px" }} />
          {/* User prompt */}
          <div style={{ padding:"12px 14px 10px" }}>
            <div style={{ display:"flex", justifyContent:"space-between", marginBottom:7 }}>
              <span style={{ fontSize:10, color:t.textMuted, letterSpacing:".08em" }}>USER PROMPT</span>
              <button onClick={()=>copy(userVal,"usr")} style={{ background:"none",border:"none",cursor:"pointer",color:t.textDim,display:"flex",gap:4,alignItems:"center",fontSize:10,fontFamily:"inherit" }}
                onMouseEnter={e=>e.currentTarget.style.color=t.textMuted} onMouseLeave={e=>e.currentTarget.style.color=t.textDim}>
                {copied==="usr"?<Check size={11}/>:<Copy size={11}/>}{copied==="usr"?"copied":"copy"}
              </button>
            </div>
            <textarea value={userVal} onChange={e=>setUserVal(e.target.value)} placeholder="Based on the context, please…" rows={8}
              style={{ width:"100%", background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:7, padding:"9px 11px", fontSize:11.5, color:t.text, fontFamily:"inherit", outline:"none", resize:"vertical", lineHeight:1.6 }} />
          </div>
          {/* Save name */}
          <div style={{ padding:"8px 14px 12px" }}>
            <div style={{ display:"flex", gap:6 }}>
              <input value={saveName} onChange={e=>setSaveName(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveToLibrary()}
                placeholder="Name to save to library…"
                style={{ flex:1, background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:6, padding:"5px 9px", fontSize:11, color:t.text, fontFamily:"inherit", outline:"none" }} />
              <button onClick={saveToLibrary} disabled={!saveName.trim()||saving} style={{
                display:"flex", alignItems:"center", gap:5, padding:"5px 10px", borderRadius:6, fontSize:11, cursor:saveName.trim()?"pointer":"default",
                background: saveName.trim() ? t.savedTag : t.surface2,
                color: saveName.trim() ? t.savedText : t.textDim,
                border:`1px solid ${saveName.trim()?t.savedBorder:t.border}`, fontFamily:"inherit"
              }}>
                {saving ? <Loader2 size={11} style={{animation:"spin .7s linear infinite"}} /> : <Bookmark size={11} />}Save
              </button>
            </div>
          </div>
          <div style={{ padding:"0 14px 14px", marginTop:"auto" }}>
            <button onClick={applyToNode} style={{
              width:"100%", padding:"9px 0", borderRadius:7, fontSize:12, fontWeight:600,
              background:t.text, color:t.bg, border:"none", cursor:"pointer",
              display:"flex", alignItems:"center", justifyContent:"center", gap:7, fontFamily:"inherit"
            }} onMouseEnter={e=>e.currentTarget.style.opacity=".85"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
              <CornerDownLeft size={13} />Apply to Node
            </button>
          </div>
        </div>
      )}

      {tab === "library" && (
        <div style={{ flex:1, overflowY:"auto", padding:"10px" }}>
          {savedPrompts.length === 0
            ? <div style={{ textAlign:"center", marginTop:40, color:t.textDim }}>
                <BookMarked size={24} style={{ margin:"0 auto 10px", display:"block", opacity:.4 }} />
                <p style={{ fontSize:12 }}>No saved prompts yet.</p>
              </div>
            : <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                {savedPrompts.map(sp => (
                  <div key={sp.id} style={{ background:t.surface, border:`1px solid ${t.border}`, borderRadius:8, overflow:"hidden" }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", borderBottom:`1px solid ${t.border}` }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <Bookmark size={11} color={t.savedText} />
                        <span style={{ fontSize:12, fontWeight:500, color:t.text }}>{sp.name}</span>
                      </div>
                      <div style={{ display:"flex", gap:4 }}>
                        <button onClick={()=>onApplySaved(node.id, sp)} style={{ display:"flex",alignItems:"center",gap:4,padding:"3px 8px",borderRadius:5,fontSize:10,cursor:"pointer",background:t.savedTag,color:t.savedText,border:`1px solid ${t.savedBorder}`,fontFamily:"inherit" }}>
                          <CornerDownLeft size={10} />Apply
                        </button>
                        <button onClick={()=>onDeleteSaved(sp.id)} style={{ background:"none",border:"none",cursor:"pointer",color:t.textDim,display:"flex",padding:4,borderRadius:4 }}
                          onMouseEnter={e=>e.currentTarget.style.color=t.text} onMouseLeave={e=>e.currentTarget.style.color=t.textDim}>
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                    <div style={{ padding:"8px 10px", display:"flex", flexDirection:"column", gap:6 }}>
                      {sp.system && <div>
                        <span style={{ fontSize:9, color:t.textDim, letterSpacing:".08em", display:"block", marginBottom:3 }}>SYSTEM</span>
                        <p style={{ fontSize:10.5, color:t.textMuted, lineHeight:1.5, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{sp.system}</p>
                      </div>}
                      {sp.user && <div>
                        <span style={{ fontSize:9, color:t.textDim, letterSpacing:".08em", display:"block", marginBottom:3 }}>USER</span>
                        <p style={{ fontSize:10.5, color:t.textMuted, lineHeight:1.5, overflow:"hidden", display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical" }}>{sp.user}</p>
                      </div>}
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  );
}

// ─── FLOW NODE ────────────────────────────────────────────────────────────────
function FlowNode({ node, selected, onDelete, onFieldChange, onMouseDown, onStartConnect, onCompleteConnect, connectingFrom, onOpenEditor, runStatus, theme: t }) {
  const meta = NODE_META[node.type] || NODE_META.output;
  const NodeIcon = meta.Icon;
  const isTarget = connectingFrom && connectingFrom !== node.id;
  const isLLM = node.type === "llm";
  const hasPrompt = node.fields?.some(f => f.type === "textarea" && f.value?.trim());

  // Glow colour during flow run
  const runBorder = runStatus === "running" ? t.warnColor : runStatus === "done" ? t.okColor : runStatus === "error" ? t.errColor : null;

  return (
    <div onMouseDown={onMouseDown} style={{
      width: NODE_WIDTH, cursor: "grab",
      background: t.surface,
      border: `1px solid ${runBorder || (selected ? t.text : isTarget ? t.accent : t.border)}`,
      borderRadius: 10,
      boxShadow: runBorder ? `0 0 12px ${runBorder}44` : selected ? t.nodeGlow : t.shadow,
      userSelect: "none", transition: "border-color .15s, box-shadow .15s",
      fontFamily: "'DM Mono', monospace", position: "relative",
    }}>
      {/* Header */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 10px", background:t.surface2, borderRadius:"9px 9px 0 0", borderBottom:`1px solid ${t.border}` }}>
        <div style={{ display:"flex", alignItems:"center", gap:7 }}>
          <NodeIcon size={13} color={t.textMuted} strokeWidth={1.8} />
          <span style={{ fontSize:11, fontWeight:500, color:t.text }}>{node.label || meta.label}</span>
          {isLLM && hasPrompt && <span style={{ fontSize:9, padding:"1px 5px", borderRadius:3, background:t.savedTag, color:t.savedText, border:`1px solid ${t.savedBorder}` }}>saved</span>}
          {runStatus === "running" && <Loader2 size={10} color={t.warnColor} style={{animation:"spin .7s linear infinite"}} />}
          {runStatus === "done"    && <CheckCircle2 size={10} color={t.okColor} />}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:2 }}>
          {isLLM && <button onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onOpenEditor(node.id);}}
            style={{ background:"none",border:"none",cursor:"pointer",color:t.textDim,padding:2,display:"flex",borderRadius:4 }}
            onMouseEnter={e=>e.currentTarget.style.color=t.text} onMouseLeave={e=>e.currentTarget.style.color=t.textDim}
            title="Edit prompt"><Edit3 size={11} /></button>}
          <button onMouseDown={e=>{e.stopPropagation();onDelete(node.id);}}
            style={{ background:"none",border:"none",cursor:"pointer",color:t.textDim,padding:2,display:"flex",borderRadius:4 }}
            onMouseEnter={e=>e.currentTarget.style.color=t.text} onMouseLeave={e=>e.currentTarget.style.color=t.textDim}>
            <X size={11} />
          </button>
        </div>
      </div>

      {/* Fields */}
      <div style={{ padding:"10px", display:"flex", flexDirection:"column", gap:7 }}>
        {(node.fields||[]).map((f,i)=>(
          <div key={i}>
            {f.type==="text" && <input defaultValue={f.value} placeholder={f.placeholder}
              style={{ width:"100%",background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:5,padding:"4px 8px",fontSize:11,color:t.text,fontFamily:"inherit",outline:"none" }}
              onMouseDown={e=>e.stopPropagation()} onChange={e=>onFieldChange(node.id,i,e.target.value)} />}
            {f.type==="textarea" && (
              <div style={{ position:"relative" }}>
                <textarea value={f.value} placeholder={f.placeholder} rows={3}
                  style={{ width:"100%",background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:5,padding:"5px 8px",fontSize:11,color:t.textMuted,fontFamily:"inherit",outline:"none",resize:"none",lineHeight:1.5 }}
                  onMouseDown={e=>e.stopPropagation()} onChange={e=>onFieldChange(node.id,i,e.target.value)} />
                {!f.value && <div onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();onOpenEditor(node.id);}}
                  style={{ position:"absolute",bottom:6,right:6,display:"flex",alignItems:"center",gap:3,fontSize:9,color:t.textDim,cursor:"pointer",padding:"2px 5px",borderRadius:3,background:t.surface2,border:`1px solid ${t.border}` }}>
                  <Edit3 size={8} />edit</div>}
              </div>
            )}
            {f.type==="select" && (
              <div style={{ position:"relative" }}>
                <select value={f.value} style={{ width:"100%",background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:5,padding:"4px 24px 4px 8px",fontSize:11,color:t.text,fontFamily:"inherit",outline:"none",cursor:"pointer",appearance:"none" }}
                  onMouseDown={e=>e.stopPropagation()} onChange={e=>onFieldChange(node.id,i,e.target.value)}>
                  {f.options.map(o=><option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={10} color={t.textMuted} style={{ position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",pointerEvents:"none" }} />
              </div>
            )}
            {f.type==="slider" && (
              <div>
                <div style={{ display:"flex",justifyContent:"space-between",marginBottom:4 }}>
                  <span style={{ fontSize:10,color:t.textMuted }}>{f.label}</span>
                  <span style={{ fontSize:10,color:t.text }}>{f.value}</span>
                </div>
                <input type="range" min={f.min} max={f.max} step={f.step} value={f.value}
                  style={{ width:"100%",accentColor:t.accent }}
                  onMouseDown={e=>e.stopPropagation()} onChange={e=>onFieldChange(node.id,i,parseFloat(e.target.value))} />
              </div>
            )}
            {f.type==="tags" && (
              <div style={{ display:"flex",flexWrap:"wrap",gap:4 }}>
                {f.value.map(tag=><span key={tag} style={{ padding:"2px 7px",borderRadius:4,fontSize:10,background:t.surface2,color:t.textMuted,border:`1px solid ${t.border}` }}>{tag}</span>)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Handles */}
      <div onMouseUp={e=>{e.stopPropagation();if(connectingFrom&&connectingFrom!==node.id)onCompleteConnect(node.id);}}
        style={{ position:"absolute",left:-6,top:"50%",transform:isTarget?"translateY(-50%) scale(1.4)":"translateY(-50%)",width:12,height:12,borderRadius:"50%",background:isTarget?t.text:t.handle,border:`2px solid ${t.bg}`,cursor:isTarget?"crosshair":"default",zIndex:10 }} />
      <div onMouseDown={e=>{e.stopPropagation();onStartConnect(node.id,e);}}
        style={{ position:"absolute",right:-6,top:"50%",transform:"translateY(-50%)",width:12,height:12,borderRadius:"50%",background:connectingFrom===node.id?t.text:t.handle,border:`2px solid ${t.bg}`,cursor:"crosshair",zIndex:10 }}
        onMouseEnter={e=>{if(!connectingFrom)e.currentTarget.style.transform="translateY(-50%) scale(1.4)";}}
        onMouseLeave={e=>{e.currentTarget.style.transform="translateY(-50%)";}} />
    </div>
  );
}

// ─── BEZIER ───────────────────────────────────────────────────────────────────
function makePath(fx,fy,tx,ty){const dx=Math.abs(tx-fx);const cx1=fx+Math.max(50,dx*.5);const cx2=tx-Math.max(50,dx*.5);return `M${fx},${fy} C${cx1},${fy} ${cx2},${ty} ${tx},${ty}`;}

function getRightHandle(node,nodeRefs){const el=nodeRefs.current[node.id];const h=el?el.offsetHeight:80;return{x:node.x+NODE_WIDTH,y:node.y+h/2};}
function getLeftHandle(node,nodeRefs){const el=nodeRefs.current[node.id];const h=el?el.offsetHeight:80;return{x:node.x,y:node.y+h/2};}

// ─── FLOW CANVAS ──────────────────────────────────────────────────────────────
let nodeIdCounter = 20;
const INITIAL_NODES = [
  { id:"1", type:"github", x:60, y:160, label:"GitHub Repo", fields:[{type:"text",placeholder:"Enter GitHub URL",value:""},{type:"tags",value:["README","Structure","Files"]}] },
  { id:"2", type:"llm",    x:340, y:140, label:"Generate README", fields:[
    {type:"select",value:"claude-haiku-4-5",options:["claude-haiku-4-5","claude-sonnet-4-5","claude-opus-4-5"]},
    {type:"textarea",placeholder:"System prompt…",value:"You are a technical documentation expert."},
    {type:"textarea",placeholder:"User prompt…",value:"Based on the repo context, generate a comprehensive README.md with Overview, Features, Installation, Usage sections."},
    {type:"slider",label:"Temp:",min:0,max:1,step:0.1,value:0.7}
  ]},
  { id:"3", type:"output", x:640, y:160, label:"README Output", fields:[{type:"select",value:"README.md",options:["README.md","JSON","Markdown","HTML"]},{type:"tags",value:["Output: readme.md"]}] },
];
const INITIAL_EDGES = [{id:"e1",from:"1",to:"2"},{id:"e2",from:"2",to:"3"}];

function FlowCanvas({ theme: t, serverStatus }) {
  const [nodes, setNodes]         = useState(INITIAL_NODES);
  const [edges, setEdges]         = useState(INITIAL_EDGES);
  const [selected, setSelected]   = useState(null);
  const [running, setRunning]     = useState(false);
  const [runLog, setRunLog]       = useState([]);
  const [showLog, setShowLog]     = useState(false);
  const [flowOutput, setFlowOutput] = useState("");
  const [pan, setPan]             = useState({ x:0, y:0 });
  const [editorNodeId, setEditorNodeId] = useState(null);
  const [nodeRunStatus, setNodeRunStatus] = useState({}); // nodeId → "running"|"done"|"error"
  const [savedPrompts, setSavedPrompts] = useState([
    { id:"sp1", name:"README Generator",  system:"You are a technical documentation expert.", user:"Based on the repo context, generate a comprehensive README.md with Overview, Features, Installation, Usage sections." },
    { id:"sp2", name:"Code Reviewer",     system:"You are a senior software engineer.", user:"Review the provided code and give specific, actionable feedback on improvements." },
    { id:"sp3", name:"Research Summarizer", system:"You are a research analyst.", user:"Summarize the key findings, methodology, and implications of the provided research." },
  ]);

  const [connectingFrom, setConnectingFrom] = useState(null);
  const [dragPos, setDragPos] = useState({ x:0, y:0 });

  const dragging = useRef(null);
  const panning  = useRef(null);
  const canvasRef = useRef();
  const nodeRefs  = useRef({});
  const edgeIdCtr = useRef(10);
  const spCtr     = useRef(10);

  const onNodeMouseDown = useCallback((nodeId, e) => {
    e.stopPropagation();
    const node = nodes.find(n => n.id === nodeId);
    setSelected(nodeId);
    dragging.current = { nodeId, startX: e.clientX - node.x, startY: e.clientY - node.y };
  }, [nodes]);

  const onCanvasMouseDown = useCallback((e) => {
    const tag = e.target.tagName.toLowerCase();
    if (e.target===canvasRef.current || ["svg","path","rect","circle"].includes(tag)) {
      setSelected(null);
      panning.current = { startX: e.clientX - pan.x, startY: e.clientY - pan.y };
    }
  }, [pan]);

  const onStartConnect = useCallback((nodeId, e) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setConnectingFrom(nodeId);
    setDragPos({ x: e.clientX-rect.left-pan.x, y: e.clientY-rect.top-pan.y });
  }, [pan]);

  const onCompleteConnect = useCallback((targetId) => {
    if (!connectingFrom || connectingFrom===targetId) { setConnectingFrom(null); return; }
    setEdges(es => {
      if (es.some(e=>e.from===connectingFrom&&e.to===targetId)) return es;
      return [...es, { id:`e${++edgeIdCtr.current}`, from:connectingFrom, to:targetId }];
    });
    setConnectingFrom(null);
  }, [connectingFrom]);

  const onMouseMove = useCallback((e) => {
    if (dragging.current) {
      const { nodeId, startX, startY } = dragging.current;
      setNodes(ns => ns.map(n => n.id===nodeId ? {...n, x:e.clientX-startX, y:e.clientY-startY} : n));
    } else if (panning.current) {
      setPan({ x:e.clientX-panning.current.startX, y:e.clientY-panning.current.startY });
    }
    if (connectingFrom) {
      const rect = canvasRef.current.getBoundingClientRect();
      setDragPos({ x:e.clientX-rect.left-pan.x, y:e.clientY-rect.top-pan.y });
    }
  }, [connectingFrom, pan]);

  const onMouseUp = useCallback(() => {
    dragging.current = null; panning.current = null;
    if (connectingFrom) setConnectingFrom(null);
  }, [connectingFrom]);

  const onDelete = useCallback((id) => {
    setNodes(ns=>ns.filter(n=>n.id!==id));
    setEdges(es=>es.filter(e=>e.from!==id&&e.to!==id));
    if (selected===id) setSelected(null);
    if (editorNodeId===id) setEditorNodeId(null);
  }, [selected, editorNodeId]);

  const deleteEdge = useCallback((edgeId) => setEdges(es=>es.filter(e=>e.id!==edgeId)), []);

  const onFieldChange = useCallback((nodeId, fi, value) => {
    setNodes(ns=>ns.map(n=>n.id===nodeId ? {...n, fields:n.fields.map((f,i)=>i===fi?{...f,value}:f)} : n));
  }, []);

  const addNode = useCallback((type) => {
    const id = String(++nodeIdCounter);
    const defaults = {
      github:    [{type:"text",placeholder:"Enter GitHub URL",value:""},{type:"tags",value:["README"]}],
      llm:       [{type:"select",value:"claude-haiku-4-5",options:["claude-haiku-4-5","claude-sonnet-4-5","claude-opus-4-5"]},{type:"textarea",placeholder:"System prompt…",value:""},{type:"textarea",placeholder:"User prompt…",value:""},{type:"slider",label:"Temp:",min:0,max:1,step:0.1,value:0.7}],
      rag:       [{type:"select",value:"cosine",options:["cosine","dot_product","euclidean"]},{type:"slider",label:"Top-K:",min:1,max:20,step:1,value:5}],
      output:    [{type:"select",value:"Markdown",options:["README.md","JSON","Markdown","HTML"]}],
      web:       [{type:"text",placeholder:"Enter URL…",value:""}],
      transform: [{type:"select",value:"Chunk",options:["Chunk","Embed","Summarize","JSON → Text"]}],
    };
    setNodes(ns=>[...ns, { id, type, label:NODE_META[type].label, x:80+Math.random()*300, y:100+Math.random()*200, fields:defaults[type]||[] }]);
    if (type==="llm") setTimeout(()=>setEditorNodeId(id), 50);
  }, []);

  const handleEditorSave = useCallback(async (nodeId, sysVal, userVal, saveName) => {
    setNodes(ns=>ns.map(n=>{
      if (n.id!==nodeId) return n;
      return {...n, fields:n.fields.map(f=>{
        if (f.type==="textarea"&&f.placeholder?.toLowerCase().includes("system")) return {...f,value:sysVal};
        if (f.type==="textarea"&&f.placeholder?.toLowerCase().includes("user"))   return {...f,value:userVal};
        return f;
      })};
    }));
    if (saveName) {
      const entry = { id:`sp${++spCtr.current}`, name:saveName, system:sysVal, user:userVal };
      setSavedPrompts(sp=>[...sp, entry]);
      // Also persist to server
      try {
        await fetch(`${API}/prompts`, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({name:saveName,system:sysVal,user:userVal}) });
      } catch {}
    }
  }, []);

  const handleApplySaved = useCallback((nodeId, sp) => {
    setNodes(ns=>ns.map(n=>{
      if (n.id!==nodeId) return n;
      return {...n, fields:n.fields.map(f=>{
        if (f.type==="textarea"&&f.placeholder?.toLowerCase().includes("system")) return {...f,value:sp.system||f.value};
        if (f.type==="textarea"&&f.placeholder?.toLowerCase().includes("user"))   return {...f,value:sp.user||f.value};
        return f;
      })};
    }));
  }, []);

  const handleDeleteSaved = useCallback((id) => setSavedPrompts(sp=>sp.filter(p=>p.id!==id)), []);

  // ── Listen for header Run button ───────────────────────────────────────────
  const runPipelineRef = useRef(null);
  useEffect(() => {
    const handler = () => runPipelineRef.current?.();
    document.addEventListener("fw:run-flow", handler);
    return () => document.removeEventListener("fw:run-flow", handler);
  }, []);

  // ── Real flow run via backend ──────────────────────────────────────────────
  const runPipeline = useCallback(async () => {
    if (serverStatus !== "ok") {
      setRunLog([{ text:"⚠  Backend not connected. Start the server first.", dim:false, color:"warn" }]);
      setShowLog(true);
      return;
    }
    setRunning(true); setShowLog(true); setFlowOutput(""); setNodeRunStatus({});
    setRunLog([{ text:"▶  Sending flow to backend…", dim:false }]);

    try {
      const resp = await fetch(`${API}/flow/run`, {
        method: "POST",
        headers: { "Content-Type":"application/json" },
        body: JSON.stringify({ nodes, edges }),
      });

      let currentOutput = "";
      for await (const event of readSSE(resp)) {
        if (event.type === "status") {
          setRunLog(l=>[...l, { text:`   ${event.text}`, dim:true }]);
        } else if (event.type === "node_start") {
          setRunLog(l=>[...l, { text:`→  Running: ${event.label}`, dim:false }]);
          setNodeRunStatus(s=>({...s, [event.nodeId]:"running"}));
        } else if (event.type === "node_token") {
          currentOutput += event.token;
          setFlowOutput(currentOutput);
        } else if (event.type === "node_done") {
          setNodeRunStatus(s=>({...s, [event.nodeId]:"done"}));
          setRunLog(l=>[...l, { text:`✓  Done: ${event.output?.slice(0,80)}${event.output?.length>80?"…":""}`, dim:true }]);
        } else if (event.type === "flow_done") {
          setFlowOutput(event.output || currentOutput);
          setRunLog(l=>[...l, { text:"✓  Flow complete", dim:false }]);
        } else if (event.type === "error") {
          setRunLog(l=>[...l, { text:`✗  ${event.error}`, dim:false, color:"err" }]);
        }
      }
    } catch (err) {
      setRunLog(l=>[...l, { text:`✗  ${err.message}`, dim:false, color:"err" }]);
    }
    setRunning(false);
  }, [nodes, edges, serverStatus]);

  const editorNode = editorNodeId ? nodes.find(n=>n.id===editorNodeId) : null;

  const edgePaths = edges.map(e=>{
    const fn=nodes.find(n=>n.id===e.from), tn=nodes.find(n=>n.id===e.to);
    if(!fn||!tn) return null;
    const from=getRightHandle(fn,nodeRefs), to=getLeftHandle(tn,nodeRefs);
    const d=makePath(from.x,from.y,to.x,to.y);
    const mx=(from.x+to.x)/2, my=(from.y+to.y)/2;
    return (
      <g key={e.id}>
        <path d={d} fill="none" stroke="transparent" strokeWidth="12" style={{cursor:"pointer"}} onClick={()=>deleteEdge(e.id)} />
        <path d={d} fill="none" stroke={t.edgeColor} strokeWidth="1.5" strokeDasharray="5 4" markerEnd="url(#arr)" style={{animation:"edgeDash 1.2s linear infinite",pointerEvents:"none"}} />
        <g transform={`translate(${mx},${my})`} style={{cursor:"pointer"}} onClick={()=>deleteEdge(e.id)}>
          <circle r="8" fill={t.surface} stroke={t.border2} strokeWidth="1" />
          <line x1="-3.5" y1="-3.5" x2="3.5" y2="3.5" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
          <line x1="3.5" y1="-3.5" x2="-3.5" y2="3.5" stroke={t.textMuted} strokeWidth="1.5" strokeLinecap="round"/>
        </g>
      </g>
    );
  });

  let pendingPath = null;
  if (connectingFrom) {
    const fn = nodes.find(n=>n.id===connectingFrom);
    if (fn) { const from=getRightHandle(fn,nodeRefs); pendingPath=<path d={makePath(from.x,from.y,dragPos.x,dragPos.y)} fill="none" stroke={t.text} strokeWidth="1.5" strokeDasharray="6 4" opacity=".6" style={{pointerEvents:"none"}}/>; }
  }

  return (
    <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", background:t.bg }}>
      {/* Palette */}
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"7px 14px", borderBottom:`1px solid ${t.border}`, background:t.surface, flexWrap:"wrap" }}>
        <span style={{ fontSize:10, color:t.textMuted, marginRight:4, fontFamily:"monospace", letterSpacing:".08em" }}>ADD NODE</span>
        {Object.entries(NODE_META).map(([type,meta])=>{
          const NI=meta.Icon;
          return <button key={type} onClick={()=>addNode(type)} style={{ display:"flex",alignItems:"center",gap:5,padding:"4px 10px",borderRadius:6,fontSize:11,border:`1px solid ${t.border2}`,background:t.surface2,color:t.textMuted,cursor:"pointer",fontFamily:"inherit" }}
            onMouseEnter={e=>{e.currentTarget.style.color=t.text;e.currentTarget.style.borderColor=t.text;}}
            onMouseLeave={e=>{e.currentTarget.style.color=t.textMuted;e.currentTarget.style.borderColor=t.border2;}}><NI size={11}/>{meta.label}</button>;
        })}
        <div style={{flex:1}}/>
        <span style={{ fontSize:10, color:t.textDim, fontFamily:"monospace" }}>drag right handle → left to connect · click × on edge to remove</span>
      </div>

      {/* Canvas + panel */}
      <div style={{ flex:1, position:"relative", display:"flex", overflow:"hidden" }}>
        <div ref={canvasRef} style={{ flex:1, position:"relative", overflow:"hidden", cursor:connectingFrom?"crosshair":"default" }}
          onMouseDown={onCanvasMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp}>
          <svg style={{ position:"absolute",inset:0,width:"100%",height:"100%",overflow:"visible" }}>
            <defs>
              <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse" x={pan.x%24} y={pan.y%24}>
                <circle cx="12" cy="12" r=".8" fill={t.gridDot}/>
              </pattern>
              <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0.5 L0,6.5 L6,3.5 z" fill={t.edgeColor}/>
              </marker>
            </defs>
            <style>{`@keyframes edgeDash{to{stroke-dashoffset:-36;}}`}</style>
            <rect width="100%" height="100%" fill="url(#grid)"/>
            <g transform={`translate(${pan.x},${pan.y})`}>{edgePaths}{pendingPath}</g>
          </svg>

          <div style={{ position:"absolute", inset:0 }}>
            {nodes.map(n=>(
              <div key={n.id} ref={el=>{if(el)nodeRefs.current[n.id]=el;}} style={{ position:"absolute", left:n.x+pan.x, top:n.y+pan.y }}>
                <FlowNode node={n} selected={selected===n.id} onDelete={onDelete} onFieldChange={onFieldChange}
                  onMouseDown={e=>onNodeMouseDown(n.id,e)} onStartConnect={onStartConnect} onCompleteConnect={onCompleteConnect}
                  connectingFrom={connectingFrom} onOpenEditor={setEditorNodeId}
                  runStatus={nodeRunStatus[n.id] || null} theme={t} />
              </div>
            ))}
          </div>

          {/* Run log */}
          {showLog && (
            <div style={{ position:"absolute", bottom:16, right: editorNode ? 416 : 16, width:320, background:t.surface, border:`1px solid ${t.border}`, borderRadius:10, overflow:"hidden", boxShadow:t.shadow, transition:"right .2s ease" }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"8px 12px", borderBottom:`1px solid ${t.border}` }}>
                <span style={{ fontSize:10, color:t.textMuted, fontFamily:"monospace", letterSpacing:".08em" }}>RUN LOG</span>
                <button onClick={()=>setShowLog(false)} style={{ background:"none",border:"none",cursor:"pointer",color:t.textMuted,display:"flex" }}><X size={11}/></button>
              </div>
              <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:4, maxHeight:180, overflowY:"auto" }}>
                {runLog.map((l,i)=>(
                  <span key={i} style={{ fontFamily:"monospace", fontSize:11, color: l.color==="err" ? t.errColor : l.color==="warn" ? t.warnColor : l.dim ? t.textMuted : t.text }}>{l.text}</span>
                ))}
                {running && <div style={{display:"flex",gap:4,marginTop:2}}>{[0,1,2].map(i=><div key={i} style={{width:6,height:6,borderRadius:"50%",background:t.textMuted,animation:`dot 1.4s ease infinite`,animationDelay:`${i*.2}s`}}/>)}</div>}
              </div>
              {/* Output area */}
              {flowOutput && (
                <div style={{ borderTop:`1px solid ${t.border}`, padding:"10px 12px", maxHeight:200, overflowY:"auto" }}>
                  <span style={{ fontSize:9, color:t.textDim, letterSpacing:".08em", display:"block", marginBottom:6 }}>OUTPUT</span>
                  <pre style={{ fontSize:11, color:t.text, fontFamily:"inherit", lineHeight:1.55, whiteSpace:"pre-wrap", wordBreak:"break-word" }}>{flowOutput}</pre>
                </div>
              )}
            </div>
          )}
        </div>

        {editorNode && (
          <PromptEditorPanel node={editorNode} savedPrompts={savedPrompts}
            onSave={handleEditorSave} onClose={()=>setEditorNodeId(null)}
            onApplySaved={handleApplySaved} onDeleteSaved={handleDeleteSaved} theme={t} />
        )}
      </div>
    </div>
  );
}

// ─── Notebook card on the home screen ────────────────────────────────────────
function NotebookCard({ notebook, onOpen, onDelete, theme: t }) {
  const [hover, setHover] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
 
  const totalChunks = notebook.papers.reduce((s, p) => s + (p.chunks || 0), 0);
  const date = new Date(notebook.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
 
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setMenuOpen(false); }}
      onClick={() => onOpen(notebook.id)}
      style={{
        background: hover ? t.surface2 : t.surface,
        border: `1px solid ${hover ? t.border2 : t.border}`,
        borderRadius: 12,
        padding: "18px 18px 14px",
        cursor: "pointer",
        transition: "all .15s ease",
        position: "relative",
        boxShadow: hover ? t.shadow : "none",
      }}
    >
      {/* Folder icon + title */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center",
          background: t.surface3, border: `1px solid ${t.border}`, flexShrink: 0,
        }}>
          <FolderOpen size={16} color={t.textMuted} strokeWidth={1.6} />
        </div>
        <button
          onClick={e => { e.stopPropagation(); setMenuOpen(m => !m); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex", padding: 4, borderRadius: 5, opacity: hover ? 1 : 0, transition: "opacity .1s" }}
          onMouseEnter={e => e.currentTarget.style.color = t.textMuted}
          onMouseLeave={e => e.currentTarget.style.color = t.textDim}
        >
          <MoreHorizontal size={14} />
        </button>
        {menuOpen && (
          <div style={{
            position: "absolute", top: 44, right: 12, background: t.surface, border: `1px solid ${t.border2}`,
            borderRadius: 8, padding: "4px", zIndex: 20, boxShadow: t.shadow, minWidth: 130,
          }} onClick={e => e.stopPropagation()}>
            <button onClick={() => { onDelete(notebook.id); setMenuOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 7, width: "100%", padding: "7px 10px", borderRadius: 5, background: "none", border: "none", cursor: "pointer", color: t.errColor, fontSize: 12, fontFamily: "inherit" }}
              onMouseEnter={e => e.currentTarget.style.background = t.surface2}
              onMouseLeave={e => e.currentTarget.style.background = "none"}>
              <Trash2 size={11} /> Delete notebook
            </button>
          </div>
        )}
      </div>
 
      <p style={{ fontSize: 13, fontWeight: 600, color: t.text, marginBottom: 4, lineHeight: 1.3 }}>{notebook.name}</p>
      <p style={{ fontSize: 11, color: t.textMuted, lineHeight: 1.5, marginBottom: 10, minHeight: 32,
        overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
        {notebook.papers.length === 0 ? "No sources yet — add PDFs, TXT or MD files." : notebook.papers.map(p => p.name).join(", ")}
      </p>
 
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
 
      {/* Arrow hint on hover */}
      <div style={{
        position: "absolute", right: 14, bottom: 14, opacity: hover ? 1 : 0, transition: "opacity .15s",
        display: "flex", alignItems: "center", gap: 3, fontSize: 10, color: t.textMuted,
      }}>
        Open <ChevronRight size={10} />
      </div>
    </div>
  );
}
 
// ─── Inside a notebook: sources sidebar + chat ────────────────────────────────
function NotebookView({ notebook, onBack, onUpdateNotebook, theme: t, serverStatus }) {
  const [papers, setPapers] = useState(notebook.papers || []);
  const [messages, setMessages] = useState(notebook.messages || [
    { role: "assistant", content: `Welcome to **${notebook.name}**. Upload sources and start asking questions — I'll ground my answers in your documents.` }
  ]);
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [ingesting, setIngesting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [pipeline, setPipeline] = useState(null);
  const [sources, setSources]   = useState([]);
  const fileRef  = useRef();
  const chatRef  = useRef();
 
  // Persist changes upward
  useEffect(() => {
    onUpdateNotebook(notebook.id, { papers, messages });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [papers, messages]);
 
  const ingest = useCallback(async (files) => {
    if (serverStatus !== "ok") {
      setMessages(m => [...m, { role: "assistant", content: "⚠ Backend not running. Please start the server first." }]);
      return;
    }
    setIngesting(true);
    const form = new FormData();
    // Tag files with notebook id so backend can namespace them
    form.append("notebookId", notebook.id);
    for (const f of files) form.append("files", f);
    try {
      const resp = await fetch(`${API}/ingest`, { method: "POST", body: form });
      const data = await resp.json();
      const newPapers = (data.results || []).filter(r => r.status === "ok");
      // Deduplicate by name
      setPapers(prev => {
        const existing = new Set(prev.map(p => p.name));
        return [...prev, ...newPapers.filter(p => !existing.has(p.name))];
      });
      const ok = newPapers.length;
      const msg = ok
        ? `✓ Ingested ${newPapers.map(p => `"${p.name}" (${p.chunks} chunks)`).join(", ")} using LangChain + all-MiniLM-L6-v2.`
        : (data.results || []).map(r => `${r.name}: ${r.reason || r.status}`).join("; ");
      setMessages(m => [...m, { role: "assistant", content: msg }]);
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Ingest error: ${err.message}` }]);
    }
    setIngesting(false);
  }, [serverStatus, notebook.id]);
 
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
      const resp = await fetch(`${API}/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, topK: 6, notebookId: notebook.id }),
      });
 
      let fullText = "";
      let msgAdded = false;
 
      for await (const event of readSSE(resp)) {
        if (event.type === "status") {
          setPipeline(p => [...(p || []), event.text]);
        } else if (event.type === "sources") {
          // Deduplicate sources
          const unique = [...new Set(event.sources || [])];
          setSources(unique);
        } else if (event.type === "token") {
          fullText += event.token;
          if (!msgAdded) {
            setMessages(m => [...m, { role: "assistant", content: fullText, streaming: true }]);
            msgAdded = true;
          } else {
            setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: fullText } : msg));
          }
        } else if (event.type === "done") {
          setMessages(m => m.map((msg, i) => i === m.length - 1 ? { ...msg, content: event.fullText || fullText, streaming: false } : msg));
        } else if (event.type === "error") {
          setMessages(m => [...m, { role: "assistant", content: `Error: ${event.error}` }]);
        }
      }
    } catch (err) {
      setMessages(m => [...m, { role: "assistant", content: `Connection error: ${err.message}` }]);
    }
 
    setLoading(false); setPipeline(null);
    setTimeout(() => chatRef.current?.scrollTo({ top: 999999, behavior: "smooth" }), 80);
  }, [serverStatus, notebook.id]);
 
  const removePaper = async (name) => {
    setPapers(p => p.filter(x => x.name !== name));
    try { await fetch(`${API}/store/${encodeURIComponent(name)}`, { method: "DELETE" }); } catch {}
  };
 
  return (
    <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
      {/* ── Left sidebar: sources ── */}
      <aside style={{
        width: 260, flexShrink: 0, display: "flex", flexDirection: "column",
        background: t.surface, borderRight: `1px solid ${t.border}`,
      }}>
        {/* Back + title */}
        <div style={{ padding: "12px 12px 10px", borderBottom: `1px solid ${t.border}` }}>
          <button onClick={onBack}
            style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "none", cursor: "pointer", color: t.textMuted, fontSize: 11, padding: "3px 0 8px", fontFamily: "inherit" }}
            onMouseEnter={e => e.currentTarget.style.color = t.text}
            onMouseLeave={e => e.currentTarget.style.color = t.textMuted}>
            <ArrowLeft size={11} /> All notebooks
          </button>
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            <FolderOpen size={14} color={t.textMuted} strokeWidth={1.6} />
            <span style={{ fontWeight: 600, fontSize: 13, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{notebook.name}</span>
          </div>
          <p style={{ fontSize: 10, color: t.textDim, marginTop: 3 }}>
            {papers.length} source{papers.length !== 1 ? "s" : ""} · {papers.reduce((s, p) => s + (p.chunks || 0), 0)} vectors
          </p>
        </div>
 
        {/* Drop zone */}
        <div
          style={{
            margin: "10px 10px 6px", borderRadius: 8,
            border: `1.5px dashed ${dragOver ? t.text : t.border2}`,
            background: dragOver ? t.surface2 : "transparent",
            padding: "12px 8px", textAlign: "center", cursor: "pointer", transition: "all .2s",
          }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); ingest([...e.dataTransfer.files]); }}
          onClick={() => fileRef.current.click()}
        >
          <input ref={fileRef} type="file" multiple accept=".pdf,.txt,.md" style={{ display: "none" }}
            onChange={e => ingest([...e.target.files])} />
          {ingesting
            ? <Loader2 size={16} color={t.textMuted} style={{ margin: "0 auto 5px", display: "block", animation: "spin .7s linear infinite" }} />
            : <Upload size={16} color={dragOver ? t.text : t.textDim} style={{ margin: "0 auto 5px", display: "block" }} />
          }
          <p style={{ fontSize: 11, color: ingesting ? t.text : t.textMuted }}>
            {ingesting ? "Processing…" : "Add sources"}
          </p>
          <p style={{ fontSize: 10, color: t.textDim, marginTop: 1 }}>PDF · TXT · MD</p>
        </div>
 
        {/* File list */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 10px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
          {papers.length === 0
            ? <p style={{ fontSize: 11, color: t.textDim, textAlign: "center", marginTop: 18 }}>No sources yet</p>
            : papers.map(p => (
              <div key={p.name} style={{
                display: "flex", alignItems: "flex-start", gap: 7,
                background: t.surface2, border: `1px solid ${t.border}`, borderRadius: 7, padding: "7px 8px",
              }}>
                <File size={11} color={t.textMuted} style={{ marginTop: 1, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 11, color: t.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</p>
                  <p style={{ fontSize: 10, color: t.textMuted }}>{p.chunks} chunks · {((p.size || 0) / 1024).toFixed(1)}KB</p>
                </div>
                <button onClick={() => removePaper(p.name)}
                  style={{ background: "none", border: "none", cursor: "pointer", color: t.textDim, display: "flex", padding: 2 }}
                  onMouseEnter={e => e.currentTarget.style.color = t.text}
                  onMouseLeave={e => e.currentTarget.style.color = t.textDim}>
                  <X size={10} />
                </button>
              </div>
            ))
          }
        </div>
 
        {/* Sources from last query */}
        {sources.length > 0 && (
          <div style={{ margin: "0 10px 10px", padding: "8px 10px", borderRadius: 7, background: t.surface2, border: `1px solid ${t.border}` }}>
            <p style={{ fontSize: 9, color: t.textDim, marginBottom: 5, letterSpacing: ".07em" }}>CITED IN LAST ANSWER</p>
            {sources.map(s => (
              <p key={s} style={{ fontSize: 10.5, color: t.textMuted, padding: "2px 0" }}>• {s}</p>
            ))}
          </div>
        )}
      </aside>
 
      {/* ── Main chat area ── */}
      <main style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: t.bg }}>
        {/* Presets */}
        <div style={{ display: "flex", gap: 6, padding: "8px 14px", borderBottom: `1px solid ${t.border}`, flexWrap: "wrap", background: t.surface }}>
          {PRESETS.map(({ Icon: PI, label, prompt }) => (
            <button key={label} onClick={() => query(prompt)} style={{
              display: "flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 6,
              fontSize: 11, border: `1px solid ${t.border}`, background: t.surface2, color: t.textMuted, cursor: "pointer",
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = t.border2; e.currentTarget.style.color = t.text; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textMuted; }}>
              <PI size={12} color={t.textMuted} />{label}
            </button>
          ))}
        </div>
 
        {/* Messages */}
        <div ref={chatRef} style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{
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
                maxWidth: "70%", borderRadius: 12, padding: "10px 14px", fontSize: 13, lineHeight: 1.65,
                background: m.role === "user" ? t.msgUser : t.surface,
                color: m.role === "user" ? t.msgUserTxt : t.text,
                border: m.role === "assistant" ? `1px solid ${t.border}` : "none",
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
          ))}
 
          {loading && !messages[messages.length - 1]?.streaming && (
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
                        <div style={{ width: 5, height: 5, borderRadius: "50%", background: i === pipeline.length - 1 ? t.text : t.textMuted, flexShrink: 0 }} />
                        <span style={{ color: i === pipeline.length - 1 ? t.text : t.textMuted, fontFamily: "monospace" }}>{s}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 5 }}>
                    {[0, 1, 2].map(i => (
                      <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: t.textMuted, animation: `dot 1.4s ease infinite`, animationDelay: `${i * .2}s` }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
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
            <button onClick={() => query(input)} disabled={loading || !input.trim()} style={{
              width: 32, height: 32, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: loading || !input.trim() ? "default" : "pointer",
              background: loading || !input.trim() ? t.surface2 : t.text,
              border: `1px solid ${t.border}`,
            }}>
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
 
// ─── Home screen: notebook grid ───────────────────────────────────────────────
let nbCtr = 3;
const DEFAULT_NOTEBOOKS = [
  {
    id: "nb1",
    name: "Literature Review",
    createdAt: Date.now() - 1000 * 60 * 60 * 24 * 2,
    papers: [],
    messages: [{ role: "assistant", content: "Welcome to **Literature Review**. Upload your papers and I'll help you analyze them." }],
  },
  {
    id: "nb2",
    name: "Research Notes",
    createdAt: Date.now() - 1000 * 60 * 60 * 5,
    papers: [],
    messages: [{ role: "assistant", content: "Welcome to **Research Notes**. Upload your sources and start asking questions." }],
  },
];
 
export function RAGAssistant({ theme: t, serverStatus }) {
  const [notebooks, setNotebooks] = useState(DEFAULT_NOTEBOOKS);
  const [activeId, setActiveId]   = useState(null);
  const [creating, setCreating]   = useState(false);
  const [newName, setNewName]     = useState("");
  const [search, setSearch]       = useState("");
  const nameInputRef = useRef();
 
  useEffect(() => {
    if (creating) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [creating]);
 
  const createNotebook = () => {
    const name = newName.trim() || `Notebook ${nbCtr + 1}`;
    const nb = {
      id: `nb${++nbCtr}`,
      name,
      createdAt: Date.now(),
      papers: [],
      messages: [{ role: "assistant", content: `Welcome to **${name}**. Upload sources and start asking questions.` }],
    };
    setNotebooks(n => [...n, nb]);
    setNewName("");
    setCreating(false);
    setActiveId(nb.id);
  };
 
  const deleteNotebook = (id) => setNotebooks(n => n.filter(nb => nb.id !== id));
 
  const updateNotebook = (id, patch) => {
    setNotebooks(n => n.map(nb => nb.id === id ? { ...nb, ...patch } : nb));
  };
 
  const activeNotebook = notebooks.find(nb => nb.id === activeId);
 
  // ── If a notebook is open, show it ─────────────────────────────────────────
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
 
  // ── Home screen ─────────────────────────────────────────────────────────────
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
              ref={nameInputRef}
              value={newName} onChange={e => setNewName(e.target.value)}
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
            fontSize: 12, fontWeight: 500, background: t.text, color: t.bg, border: "none", cursor: "pointer", fontFamily: "inherit",
          }}
            onMouseEnter={e => e.currentTarget.style.opacity = ".85"}
            onMouseLeave={e => e.currentTarget.style.opacity = "1"}>
            <Plus size={13} /> New notebook
          </button>
        )}
      </div>
 
      {/* Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 20px" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", marginTop: 60 }}>
            <FolderOpen size={32} color={t.textDim} style={{ margin: "0 auto 12px", display: "block" }} />
            <p style={{ fontSize: 14, color: t.textMuted, marginBottom: 6 }}>
              {search ? "No notebooks match your search." : "No notebooks yet."}
            </p>
            {!search && (
              <p style={{ fontSize: 12, color: t.textDim }}>Create one to get started.</p>
            )}
          </div>
        ) : (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: 14,
          }}>
            {filtered.map(nb => (
              <NotebookCard key={nb.id} notebook={nb} onOpen={setActiveId} onDelete={deleteNotebook} theme={t} />
            ))}
 
            {/* Ghost "new" card */}
            <div
              onClick={() => setCreating(true)}
              style={{
                border: `1.5px dashed ${t.border2}`, borderRadius: 12, padding: "18px 18px 14px",
                cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center",
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

// ─── SETUP MODAL ──────────────────────────────────────────────────────────────
function SetupModal({ onDismiss, theme: t }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.7)", zIndex:200, display:"flex", alignItems:"center", justifyContent:"center" }}>
      <div style={{ width:520, background:t.surface, border:`1px solid ${t.border2}`, borderRadius:14, overflow:"hidden", boxShadow:t.shadow, fontFamily:"'DM Mono', monospace" }}>
        <div style={{ padding:"16px 20px", borderBottom:`1px solid ${t.border}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <Terminal size={15} color={t.textMuted}/>
            <span style={{ fontSize:13, fontWeight:600, color:t.text }}>Backend Setup</span>
          </div>
          <button onClick={onDismiss} style={{ background:"none", border:"none", cursor:"pointer", color:t.textMuted }}><X size={13}/></button>
        </div>
        <div style={{ padding:"18px 20px", display:"flex", flexDirection:"column", gap:14 }}>
          <p style={{ fontSize:12, color:t.textMuted, lineHeight:1.7 }}>
            The AI backend runs locally using <strong style={{color:t.text}}>Express + LangChain</strong>. Free local embeddings via <strong style={{color:t.text}}>all-MiniLM-L6-v2</strong>. Only an Anthropic key is needed for the LLM.
          </p>
          {[
            ["1. Install dependencies", "cd framework && npm install"],
            ["2. Set your API key",     "cp .env.example .env\n# edit .env → ANTHROPIC_API_KEY=sk-ant-..."],
            ["3. Start the backend",    "npm run dev"],
            ["4. Refresh this page",    "The status badge will turn green ✓"],
          ].map(([label, cmd])=>(
            <div key={label}>
              <p style={{ fontSize:10, color:t.textDim, letterSpacing:".07em", marginBottom:6 }}>{label.toUpperCase()}</p>
              <pre style={{ background:t.inputBg, border:`1px solid ${t.border}`, borderRadius:7, padding:"9px 12px", fontSize:11.5, color:t.text, whiteSpace:"pre-wrap", lineHeight:1.6 }}>{cmd}</pre>
            </div>
          ))}
          <p style={{ fontSize:11, color:t.textDim, lineHeight:1.6 }}>
            Stack: <span style={{color:t.textMuted}}>LangChain.js · @langchain/anthropic · MemoryVectorStore · HuggingFaceTransformersEmbeddings · RecursiveCharacterTextSplitter · pdf-parse · Express SSE</span>
          </p>
        </div>
        <div style={{ padding:"12px 20px", borderTop:`1px solid ${t.border}`, display:"flex", justifyContent:"flex-end" }}>
          <button onClick={onDismiss} style={{ padding:"7px 18px", borderRadius:7, fontSize:12, fontWeight:600, background:t.text, color:t.bg, border:"none", cursor:"pointer", fontFamily:"inherit" }}>
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [page, setPage]           = useState("rag");
  const [dark, setDark]           = useState(true);
  const [flowName, setFlowName]   = useState("README Generator");
  const [editingName, setEditingName] = useState(false);
  const [serverStatus, setServerStatus] = useState("checking"); // checking | ok | error
  const [showSetup, setShowSetup] = useState(false);

  const t = dark ? themes.dark : themes.light;

  // Poll server health
  useEffect(() => {
    const check = async () => {
      try {
        const r = await fetch(`${API}/health`, { signal: AbortSignal.timeout(3000) });
        setServerStatus(r.ok ? "ok" : "error");
      } catch { setServerStatus("error"); }
    };
    check();
    const id = setInterval(check, 8000);
    return () => clearInterval(id);
  }, []);

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@300;400;500;600&display=swap');
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${t.bg}; color: ${t.text}; font-family: 'DM Sans', sans-serif; height: 100vh; overflow: hidden; }
    #root { height: 100vh; display: flex; flex-direction: column; overflow: hidden; }
    @keyframes spin  { to { transform: rotate(360deg); } }
    @keyframes fadeIn{ from { opacity:0; transform:translateY(5px); } to { opacity:1; transform:translateY(0); } }
    @keyframes dot   { 0%,100% { opacity:.25; } 50% { opacity:1; } }
    @keyframes blink { 50% { opacity:0; } }
    @keyframes slideIn{ from { transform:translateX(20px); opacity:0; } to { transform:translateX(0); opacity:1; } }
    ::-webkit-scrollbar { width: 3px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: ${t.border2}; border-radius: 2px; }
    input[type=range] { -webkit-appearance:none; height:3px; border-radius:2px; background:${t.border}; outline:none; }
    input[type=range]::-webkit-slider-thumb { -webkit-appearance:none; width:12px; height:12px; border-radius:50%; background:${t.text}; cursor:pointer; }
    select { -webkit-appearance:none; appearance:none; }
  `;

  return (
    <>
      <style>{css}</style>
      {showSetup && <SetupModal onDismiss={()=>setShowSetup(false)} theme={t}/>}
      <div style={{ display:"flex", flexDirection:"column", height:"100vh", overflow:"hidden", background:t.bg }}>
        {/* Topbar */}
        <header style={{ display:"flex", alignItems:"center", height:46, padding:"0 14px", gap:10, borderBottom:`1px solid ${t.border}`, background:t.surface, flexShrink:0 }}>
          {/* Logo */}
          <div style={{ display:"flex", alignItems:"center", gap:7, marginRight:4 }}>
            <div style={{ width:20, height:20, borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", background:t.surface2, border:`1px solid ${t.border}` }}>
              <Zap size={12} color={t.textMuted}/>
            </div>
            <span style={{ fontWeight:700, fontSize:14, color:t.text, letterSpacing:"-.03em" }}>FrameWork</span>
          </div>

          <div style={{ width:1, height:20, background:t.border, marginRight:2 }}/>

          {/* Tabs */}
          {[{id:"rag",Icon:Brain,label:"RAG Research"},{id:"flow",Icon:Workflow,label:"Flow Builder"}].map(({id,Icon:TI,label})=>(
            <button key={id} onClick={()=>setPage(id)} style={{ display:"flex",alignItems:"center",gap:6,padding:"5px 12px",borderRadius:7,fontSize:12,cursor:"pointer",
              background:page===id?t.surface2:"transparent", color:page===id?t.text:t.textMuted,
              border:`1px solid ${page===id?t.border2:"transparent"}`, fontWeight:page===id?500:400 }}>
              <TI size={13} strokeWidth={1.8}/>{label}
            </button>
          ))}

          {page==="flow" && (
            <>
              <div style={{ width:1, height:20, background:t.border }}/>
              {editingName
                ? <input autoFocus value={flowName} onChange={e=>setFlowName(e.target.value)} onBlur={()=>setEditingName(false)} onKeyDown={e=>e.key==="Enter"&&setEditingName(false)}
                    style={{ background:"transparent", border:"none", outline:"none", fontSize:12, color:t.text, fontFamily:"'DM Mono',monospace", minWidth:180 }}/>
                : <span onClick={()=>setEditingName(true)} style={{ fontSize:12, color:t.text, fontFamily:"'DM Mono',monospace", cursor:"text", padding:"4px 8px", borderRadius:6 }}
                    onMouseEnter={e=>e.currentTarget.style.background=t.surface2} onMouseLeave={e=>e.currentTarget.style.background="transparent"}>{flowName}</span>
              }
            </>
          )}

          <div style={{flex:1}}/>

          {/* Server status */}
          <button onClick={()=>setShowSetup(true)} style={{ background:"none", border:`1px solid ${t.border}`, borderRadius:7, padding:"5px 10px", cursor:"pointer", display:"flex", alignItems:"center", gap:6 }}
            onMouseEnter={e=>e.currentTarget.style.borderColor=t.border2} onMouseLeave={e=>e.currentTarget.style.borderColor=t.border}>
            <ServerBadge status={serverStatus} theme={t}/>
          </button>

          {/* Theme toggle */}
          <button onClick={()=>setDark(d=>!d)} style={{ width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center", background:t.surface2, border:`1px solid ${t.border}`, borderRadius:7, cursor:"pointer", color:t.textMuted }}
            onMouseEnter={e=>{e.currentTarget.style.color=t.text;e.currentTarget.style.borderColor=t.border2;}} onMouseLeave={e=>{e.currentTarget.style.color=t.textMuted;e.currentTarget.style.borderColor=t.border;}}>
            {dark?<Sun size={14}/>:<Moon size={14}/>}
          </button>

          {page==="flow" && (
            <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:4 }}>
              {[Save, Trash2].map((BI,i)=>(
                <button key={i} style={{ width:32,height:32,display:"flex",alignItems:"center",justifyContent:"center",background:t.surface2,border:`1px solid ${t.border}`,borderRadius:7,cursor:"pointer",color:t.textMuted }}
                  onMouseEnter={e=>{e.currentTarget.style.color=t.text;e.currentTarget.style.borderColor=t.border2;}} onMouseLeave={e=>{e.currentTarget.style.color=t.textMuted;e.currentTarget.style.borderColor=t.border;}}>
                  <BI size={13}/>
                </button>
              ))}
              <FlowRunButton serverStatus={serverStatus} theme={t}/>
            </div>
          )}
        </header>

        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
          {page==="rag"  && <RAGAssistant theme={t} serverStatus={serverStatus}/>}
          {page==="flow" && <FlowCanvasWrapper theme={t} serverStatus={serverStatus}/>}
        </div>
      </div>
    </>
  );
}

// Wrapper to give FlowCanvas access to a run trigger from the header Play button
function FlowCanvasWrapper({ theme, serverStatus }) {
  return <FlowCanvas theme={theme} serverStatus={serverStatus}/>;
}

function FlowRunButton({ serverStatus, theme: t }) {
  // We need to trigger run from header — use a global event
  return (
    <button
      onClick={()=>document.dispatchEvent(new CustomEvent("fw:run-flow"))}
      style={{ display:"flex",alignItems:"center",gap:6,padding:"6px 14px",borderRadius:7,fontSize:12,fontWeight:600,background:t.text,color:t.bg,border:"none",cursor:"pointer" }}
      onMouseEnter={e=>e.currentTarget.style.opacity=".8"} onMouseLeave={e=>e.currentTarget.style.opacity="1"}>
      <Play size={12}/>Run
    </button>
  );
}