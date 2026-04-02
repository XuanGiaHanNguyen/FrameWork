// ─── THEME DEFINITIONS ────────────────────────────────────────────────────────
export const themes = {
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
  },
};

// ─── GLOBAL CSS ───────────────────────────────────────────────────────────────
export function buildGlobalCSS(t) {
  return `
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
}