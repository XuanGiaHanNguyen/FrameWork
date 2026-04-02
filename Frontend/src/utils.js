import { NODE_WIDTH } from "./constant";

// ─── SSE STREAMING READER ─────────────────────────────────────────────────────
/**
 * Async generator that reads an SSE (Server-Sent Events) response stream
 * and yields parsed JSON objects from each `data:` line.
 */
export async function* readSSE(response) {
  const reader  = response.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      // Flush any remaining buffered data that arrived without a trailing \n\n
      const line = buf.replace(/^data: /, "").trim();
      if (line) { try { yield JSON.parse(line); } catch {} }
      break;
    }

    buf += decoder.decode(value, { stream: true });
    const parts = buf.split("\n\n");
    buf = parts.pop(); // keep the incomplete last chunk

    for (const part of parts) {
      const line = part.replace(/^data: /, "").trim();
      if (line) {
        try { yield JSON.parse(line); } catch { /* skip malformed lines */ }
      }
    }
  }
}

// ─── SVG BEZIER PATH ──────────────────────────────────────────────────────────
/**
 * Build a cubic-bezier SVG path string from (fx,fy) → (tx,ty).
 * Control points spread horizontally by at least 50px or half the distance.
 */
export function makePath(fx, fy, tx, ty) {
  const dx  = Math.abs(tx - fx);
  const cx1 = fx + Math.max(50, dx * 0.5);
  const cx2 = tx - Math.max(50, dx * 0.5);
  return `M${fx},${fy} C${cx1},${fy} ${cx2},${ty} ${tx},${ty}`;
}

// ─── NODE HANDLE POSITIONS ────────────────────────────────────────────────────
/**
 * Returns the canvas-space coordinate of a node's right-side connection handle.
 * Falls back to height=80 if the DOM element isn't mounted yet.
 */
export function getRightHandle(node, nodeRefs) {
  const el = nodeRefs.current[node.id];
  const h  = el ? el.offsetHeight : 80;
  return { x: node.x + NODE_WIDTH, y: node.y + h / 2 };
}

/**
 * Returns the canvas-space coordinate of a node's left-side connection handle.
 */
export function getLeftHandle(node, nodeRefs) {
  const el = nodeRefs.current[node.id];
  const h  = el ? el.offsetHeight : 80;
  return { x: node.x, y: node.y + h / 2 };
}

// ─── MISC HELPERS ─────────────────────────────────────────────────────────────
/**
 * Deduplicate an array of strings.
 */
export function uniqueStrings(arr) {
  return [...new Set(arr)];
}

/**
 * Truncate a string to maxLen characters, appending "…" if cut.
 */
export function truncate(str, maxLen = 80) {
  if (!str) return "";
  return str.length > maxLen ? str.slice(0, maxLen) + "…" : str;
}

/**
 * Format a timestamp as "Mon DD" (e.g. "Apr 02").
 */
export function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}