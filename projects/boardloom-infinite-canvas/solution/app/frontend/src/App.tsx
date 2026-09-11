import React, { useEffect, useRef, useState } from "react";

const GENERIC = new Set(["rectangle", "ellipse", "diamond", "line", "arrow", "frame", "pencil", "image", "sticky", "text", ""]);
const FILLS_LIGHT = ["transparent", "#1e1e1e", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#e599f7", "#fff3bf", "#ffd8a8"];
const FILLS_DARK = ["transparent", "#ffffff", "#ffc9c9", "#b2f2bb", "#a5d8ff", "#e599f7", "#fff3bf", "#ffd8a8"];
const STROKES_LIGHT = ["#1e1e1e", "#e03131", "#2f9e44", "#1971c2", "#9c36b5", "#f08c00"];
const STROKES_DARK = ["#ffffff", "#ffa8a8", "#8ce99a", "#74c0fc", "#e599f7", "#ffe066"];
const CANVAS_BG_LIGHT = ["#ffffff", "#f8f9fa", "#fff5f5", "#e7f5ff"];
const CANVAS_BG_DARK = ["#121212", "#1a1b1e", "#0d0d0d", "#16161a"];

function Icon({ d, size = 20 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d={d} />
    </svg>
  );
}

const ICONS: Record<string, string> = {
  select: "M4 4l7 16 2-7 7-2z",
  hand: "M8 11V7a1 1 0 012 0v4M10 11V6a1 1 0 012 0v5M12 11V7.5A1 1 0 0114 7v4m0 0V9a1 1 0 012 0v5.5a5 5 0 01-5 5H10a5 5 0 01-5-5V12a1 1 0 012 0",
  rectangle: "M5 6h14v12H5z",
  diamond: "M12 3l9 9-9 9-9-9z",
  ellipse: "M12 5a8 6 0 110 14 8 6 0 010-14z",
  arrow: "M5 12h14M13 6l6 6-6 6",
  line: "M5 19L19 5",
  pencil: "M4 20l4-1 11-11-3-3L5 16z",
  text: "M6 6h12M12 6v14",
  sticky: "M7 4h10v12l-4 4H7z",
  image: "M5 6h14v12H5zM8 10a1 1 0 100-2 1 1 0 000 2zm-1 7l4-5 3 4 2-2 4 3",
  eraser: "M6 16l8-8 4 4-8 8H6z",
};

const TOOLS: [string, string][] = [
  ["select", "Select"], ["hand", "Hand"], ["rectangle", "Rectangle"], ["diamond", "Diamond"],
  ["ellipse", "Ellipse"], ["arrow", "Arrow"], ["line", "Line"], ["pencil", "Pencil"],
  ["text", "Text"], ["sticky", "Sticky note"], ["connector", "Connector"],
  ["image", "Image"], ["eraser", "Eraser"],
];

const SELECT_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path d="${ICONS.select}" fill="#111111" stroke="#ffffff" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
)}") 4 4, default`;

function canvasCursor(tool: string, hasBoard: boolean) {
  if (!hasBoard) return "default";
  if (tool === "select") return SELECT_CURSOR;
  if (tool === "hand") return "grab";
  if (tool === "eraser") return "cell";
  return "crosshair";
}

function loadToken() { return localStorage.getItem("bl_token"); }

async function api(path: string, opts: any = {}) {
  const token = loadToken();
  const r = await fetch(path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers || {}),
    },
    ...opts,
  });
  const text = await r.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: r.status, body };
}

function worldFromSvg(svg: SVGSVGElement, clientX: number, clientY: number, pan: { x: number; y: number; z: number }) {
  const pt = svg.createSVGPoint();
  pt.x = clientX; pt.y = clientY;
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const loc = pt.matrixTransform(ctm.inverse());
  return { x: (loc.x - pan.x) / pan.z, y: (loc.y - pan.y) / pan.z };
}

function normBox(x0: number, y0: number, x1: number, y1: number) {
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), width: Math.abs(x1 - x0), height: Math.abs(y1 - y0) };
}

function lineBox(x0: number, y0: number, x1: number, y1: number) {
  let dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 1) return { x: x0, y: y0, width: 20, height: 0 };
  const ang = Math.abs(Math.atan2(dy, dx));
  if (ang < Math.PI / 12 || ang > Math.PI - Math.PI / 12) dy = 0;
  else if (Math.abs(ang - Math.PI / 2) < Math.PI / 12) dx = 0;
  const n = Math.hypot(dx, dy) || 1;
  return { x: x0, y: y0, width: dx, height: dy };
}

function drawBox(tool: string, x0: number, y0: number, x1: number, y1: number) {
  if (tool === "line" || tool === "arrow") return lineBox(x0, y0, x1, y1);
  return normBox(x0, y0, x1, y1);
}

function labelOf(o: any) {
  if (o.type === "text" || o.type === "sticky" || o.type === "instance") return o.text || "";
  if (o.name && !GENERIC.has(String(o.name).toLowerCase())) return o.name;
  return "";
}

function pencilPts(o: any) {
  try { return JSON.parse(o.text || "[]"); } catch { return []; }
}

function paintFill(c?: string) {
  if (!c || c === "transparent" || c === "none") return "none";
  return c;
}

function distToSeg(px: number, py: number, x1: number, y1: number, x2: number, y2: number) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len)) : 0;
  const x = x1 + t * dx, y = y1 + t * dy;
  return Math.hypot(px - x, py - y);
}

const AUTO_INK = new Set(["#1e1e1e", "#ffffff", "#f1f3f5"]);
const themed = (c: any, ink: string) => {
  const v = typeof c === "string" ? c.trim().toLowerCase() : "";
  return !v || AUTO_INK.has(v) ? ink : c;
};
const themedFill = (c: any, ink: string) =>
  (typeof c === "string" && AUTO_INK.has(c.trim().toLowerCase()) ? ink : c);

function isLocked(o: any) {
  return o != null && Number(o.locked) === 1;
}

function hitsObject(o: any, world: { x: number; y: number }) {
  if (o.hidden) return false;
  if (o.type === "text") {
    const fs = Number(o.style?.fontSize || 28);
    const w = Math.max(Number(o.width) || 0, String(o.text || "Text").length * fs * 0.55, 48);
    const h = Math.max(Number(o.height) || 0, fs + 16, 36);
    return world.x >= o.x && world.x <= o.x + w && world.y >= o.y && world.y <= o.y + h;
  }
  if (o.type === "line" || o.type === "arrow") {
    return distToSeg(world.x, world.y, o.x, o.y, o.x + o.width, o.y + o.height) <= 10;
  }
  if (o.type === "pencil") {
    const pts = pencilPts(o);
    return pts.some((p: any, i: number) => i && distToSeg(world.x, world.y, pts[i - 1].x, pts[i - 1].y, p.x, p.y) <= 8);
  }
  return world.x >= o.x && world.x <= o.x + o.width && world.y >= o.y && world.y <= o.y + o.height;
}

function shareTokenFromPath() {
  const m = location.pathname.match(/^\/s\/([^/]+)/);
  return m ? m[1] : null;
}

function shareThemeFromUrl(): "light" | "dark" | null {
  const t = new URLSearchParams(location.search).get("theme");
  if (t === "light" || t === "dark") return t;
  return null;
}

function shareNameFromUrl(): string | null {
  const n = new URLSearchParams(location.search).get("name");
  if (!n) return null;
  try { return decodeURIComponent(n); } catch { return n; }
}

function appendShareQuery(url: string, theme: "light" | "dark", name?: string) {
  try {
    const u = new URL(url, location.origin);
    u.searchParams.set("theme", theme);
    const trimmed = (name || "").trim();
    if (trimmed) u.searchParams.set("name", trimmed);
    return u.toString();
  } catch {
    const params = new URLSearchParams();
    params.set("theme", theme);
    const trimmed = (name || "").trim();
    if (trimmed) params.set("name", trimmed);
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${params.toString()}`;
  }
}

async function svgToPng(svg: SVGSVGElement, bg = "#ffffff") {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((res, rej) => { img.onload = () => res(); img.onerror = () => rej(new Error("png")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(800, svg.clientWidth || 1200);
    canvas.height = Math.max(600, svg.clientHeight || 800);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

export default function App() {
  const publicToken = shareTokenFromPath();
  const urlShareTheme = shareThemeFromUrl();
  const [token, setToken] = useState<string | null>(() => loadToken());
  const [authMode, setAuthMode] = useState<"signin" | "register">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [authErr, setAuthErr] = useState("");
  const [me, setMe] = useState<any>(null);
  const [boards, setBoards] = useState<any[]>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [state, setState] = useState<any>(null);
  const [sidebar, setSidebar] = useState(!publicToken);
  const [tool, setTool] = useState("select");
  const [selected, setSelected] = useState<string | null>(null);
  const [alsoSelected, setAlsoSelected] = useState<string[]>([]);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [noticeOk, setNoticeOk] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [boardName, setBoardName] = useState("Untitled board");
  const [pan, setPan] = useState({ x: 80, y: 70, z: 1 });
  const [status, setStatus] = useState("ONLINE");
  const [themePref, setThemePref] = useState(() => {
    if (publicToken) return urlShareTheme || "light";
    return localStorage.getItem("bl_theme") || "light";
  });
  const [systemDark, setSystemDark] = useState(window.matchMedia?.("(prefers-color-scheme: dark)")?.matches || false);
  const dark = themePref === "dark" || (themePref === "system" && systemDark);
  const [fill, setFill] = useState(dark ? "#ffffff" : "#1e1e1e");
  const [stroke, setStroke] = useState(dark ? "#ffffff" : "#1e1e1e");
  const [preview, setPreview] = useState<any>(null);
  const [nudge, setNudge] = useState<{ id: string; dx: number; dy: number; groupId?: string | null } | null>(null);
  const [edit, setEdit] = useState<any>(null);
  const [readOnly, setReadOnly] = useState(!!publicToken);
  const drag = useRef<any>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const boardRef = useRef(boardId);
  const nameLock = useRef(false);
  boardRef.current = boardId;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    document.documentElement.classList.toggle("dark", dark);
    setFill(dark ? "#ffffff" : "#1e1e1e");
    setStroke(dark ? "#ffffff" : "#1e1e1e");
  }, [dark]);

  async function refresh(id = boardRef.current) {
    const b = await api("/api/boards");
    if (Array.isArray(b.body)) setBoards(b.body);
    if (!id) { setState(null); return; }
    const s = await api(`/api/boards/${id}`);
    if (s.status === 200) {
      setState(s.body);
      if (!nameLock.current && s.body?.board?.name) setBoardName(s.body.board.name);
    }
  }

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    const onMq = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq?.addEventListener?.("change", onMq);
    (async () => {
      if (publicToken) {
        const r = await api(`/api/s/${publicToken}`);
        if (r.status === 200) {
          setState(r.body);
          setBoardId(r.body?.board?.id || null);
          const urlName = shareNameFromUrl();
          setBoardName((urlName || r.body?.board?.name || "Shared board").trim());
          setReadOnly(true);
          setSidebar(false);
        }
        return;
      }
      if (!token) return;
      const meRes = await api("/api/me");
      if (meRes.status !== 200) {
        localStorage.removeItem("bl_token");
        setToken(null);
        return;
      }
      setMe(meRes.body);
      const list = await api("/api/boards");
      let rows = Array.isArray(list.body) ? list.body : [];
      if (!rows.some((b: any) => b.status === "ACTIVE")) {
        await api("/api/ops", {
          method: "POST",
          body: JSON.stringify({ type: "createBoard", payload: { name: "Untitled board" }, opId: `op-home-${Date.now()}` }),
        });
        const again = await api("/api/boards");
        rows = Array.isArray(again.body) ? again.body : rows;
      }
      setBoards(rows);
      const first = rows.find((b: any) => b.status === "ACTIVE") || rows[0];
      if (first) { setBoardId(first.id); await refresh(first.id); }
      else { setBoardId(null); setState(null); }
    })();
    const t = setInterval(() => { if (loadToken() && boardRef.current && !readOnly) refresh(boardRef.current); }, 4000);
    const onOff = () => setStatus(navigator.onLine ? "ONLINE" : "OFFLINE");
    window.addEventListener("online", onOff);
    window.addEventListener("offline", onOff);
    return () => { clearInterval(t); mq?.removeEventListener?.("change", onMq); window.removeEventListener("online", onOff); window.removeEventListener("offline", onOff); };
  }, [token, publicToken]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(""), 3200);
    return () => clearTimeout(t);
  }, [notice]);

  function toast(msg: string, ok = false) {
    setNoticeOk(ok);
    setNotice(msg);
  }

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setAuthErr("");
    const path = authMode === "register" ? "/api/auth/register" : "/api/auth/signin";
    const r = await api(path, {
      method: "POST",
      body: JSON.stringify({ email, password, displayName }),
    });
    if (r.status >= 400 || !r.body?.access_token) {
      setAuthErr(r.body?.reason || "INVALID_CREDENTIALS");
      return;
    }
    localStorage.setItem("bl_token", r.body.access_token);
    setToken(r.body.access_token);
    setMe(r.body.user);
    setPassword("");
  }

  function signOut() {
    localStorage.removeItem("bl_token");
    setToken(null);
    setMe(null);
    setBoards([]);
    setBoardId(null);
    setState(null);
  }

  async function runHistory(type: "undo" | "redo") {
    pickOnly(null);
    setPreview(null);
    setNudge(null);
    setEdit(null);
    await op(type, {});
  }

  function reasonText(code: string) {
    const said: Record<string, string> = {
      INVALID_GEOMETRY: "Too small to be a shape - drag out at least 20 by 20",
      OBJECT_LOCKED: "That shape is locked - unlock it before changing it",
      BOARD_ARCHIVED: "Read-only: this board is archived - restore it to make changes",
      DUPLICATE_OPERATION: "Already done - that change was applied once already",
      CIRCULAR_GROUP: "A group cannot contain itself",
      OBJECT_NOT_FOUND: "That is not there any more - reload and try again",
      EMAIL_ALREADY_REGISTERED: "That address already has an account - sign in instead",
      INVALID_CREDENTIALS: "That address and password do not match an account",
      PASSWORD_TOO_SHORT: "Pick a password of at least 8 characters",
      INVALID_EMAIL: "That does not look like an email address",
      INVALID_IMPORT: "That file is not a board this app can read",
      READ_ONLY: "This is a read-only view of the board",
    };
    return said[code] ? `${said[code]} (${code})` : code;
  }

  async function op(type: string, payload: any, targetBoard = boardRef.current) {
    if (readOnly) return { status: 403, body: { reason: "READ_ONLY" } };
    setStatus("SYNCHRONIZING");
    const r = await api("/api/ops", {
      method: "POST",
      body: JSON.stringify({
        type,
        boardId: payload.id && String(type).endsWith("Board") ? payload.id : targetBoard,
        payload,
        opId: `op-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      }),
    });
    if (r.body?.reason && r.status >= 400) { toast(reasonText(String(r.body.reason)), false); setStatus(r.status >= 500 ? "SYNC FAILED" : "ONLINE"); }
    else { setStatus("ONLINE"); }
    const next = r.body?.targetId && String(type).endsWith("Board") ? r.body.targetId : targetBoard;
    await refresh(next);
    return r;
  }

  const objects = state?.objects || [];
  const components = state?.components || [];
  const connectors = state?.connectors || [];
  const versions: any[] = state?.versions || [];
  const sel = objects.find((o: any) => o.id === selected);
  const selectedIds = (selected ? [selected, ...alsoSelected.filter((id) => id !== selected)] : [...alsoSelected])
    .filter((id) => objects.some((o: any) => o.id === id));
  const isSelected = (id: string) => selectedIds.includes(id);
  const pickOnly = (id: string | null) => { setSelected(id); setAlsoSelected([]); };
  const togglePick = (id: string) => {
    if (!selected) { setSelected(id); return; }
    if (id === selected) return;
    setAlsoSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };
  const current = boards.find((b) => b.id === boardId) || state?.board;
  const archived = current?.status === "ARCHIVED";
  const canvasBg = dark
    ? (current?.background && CANVAS_BG_DARK.includes(current.background) ? current.background : "#121212")
    : (current?.background && CANVAS_BG_LIGHT.includes(current.background) ? current.background : "#ffffff");

  function hitAt(world: { x: number; y: number }) {
    return [...objects].reverse().find((o: any) => hitsObject(o, world));
  }

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (edit || readOnly || archived) return;
    const svg = e.currentTarget;
    svg.setPointerCapture(e.pointerId);
    const world = worldFromSvg(svg, e.clientX, e.clientY, pan);
    const hit = hitAt(world);
    if (tool === "image") { fileRef.current?.click(); return; }
    if (tool === "connector") {
      if (!hit) { setLinkFrom(null); toast("Pick a shape to start the connector from.", false); return; }
      if (!linkFrom) { setLinkFrom(hit.id); pickOnly(hit.id); toast("Now pick the shape to connect it to.", true); return; }
      if (hit.id === linkFrom) { toast("Pick a different shape for the other end.", false); return; }
      op("createConnector", { startId: linkFrom, endId: hit.id });
      setLinkFrom(null);
      return;
    }
    if (tool === "eraser") {
      if (hit && isLocked(hit)) { pickOnly(hit.id); toast(reasonText("OBJECT_LOCKED"), false); }
      else if (hit) op("deleteObject", { id: hit.id });
      drag.current = { kind: "erase" };
      return;
    }
    if (tool === "hand") {
      if (hit) {
        pickOnly(hit.id);
        setFill(hit.style?.fill || fill);
        setStroke(hit.style?.border || stroke);
        if (!isLocked(hit)) drag.current = { kind: "move", id: hit.id, sx: world.x, sy: world.y };
      } else {
        drag.current = { kind: "pan", sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
      }
      return;
    }
    if (["rectangle", "ellipse", "diamond", "line", "arrow", "text", "sticky"].includes(tool)) {
      drag.current = { kind: "draw", x0: world.x, y0: world.y };
      setPreview({ type: tool, ...drawBox(tool, world.x, world.y, world.x, world.y) });
      return;
    }
    if (tool === "pencil") {
      drag.current = { kind: "pencil", points: [world] };
      setPreview({ type: "pencil", points: [world] });
      return;
    }
    if (hit) {
      if (e.shiftKey && tool === "select") { togglePick(hit.id); return; }
      pickOnly(hit.id);
      setFill(hit.style?.fill || fill);
      setStroke(hit.style?.border || stroke);
      if (tool === "select") {
        if (isLocked(hit)) toast(reasonText("OBJECT_LOCKED"), false);
        else drag.current = { kind: "move", id: hit.id, sx: world.x, sy: world.y };
      }
    } else pickOnly(null);
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    if (!drag.current) return;
    const svg = e.currentTarget;
    const world = worldFromSvg(svg, e.clientX, e.clientY, pan);
    if (drag.current.kind === "pan") {
      setPan((p) => ({ ...p, x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) }));
    } else if (drag.current.kind === "draw") {
      setPreview({ type: tool, ...drawBox(tool, drag.current.x0, drag.current.y0, world.x, world.y) });
    } else if (drag.current.kind === "pencil") {
      drag.current.points.push(world);
      setPreview({ type: "pencil", points: [...drag.current.points] });
    } else if (drag.current.kind === "erase") {
      const hit = hitAt(world);
      if (hit && !isLocked(hit)) op("deleteObject", { id: hit.id });
    } else if (drag.current.kind === "move") {
      const hit = objects.find((o: any) => o.id === drag.current.id);
      if (isLocked(hit)) return;
      setNudge({ id: drag.current.id, dx: world.x - drag.current.sx, dy: world.y - drag.current.sy, groupId: hit?.group_id || null });
    }
  }

  async function onPointerUp(e: React.PointerEvent<SVGSVGElement>) {
    const svg = e.currentTarget;
    const world = worldFromSvg(svg, e.clientX, e.clientY, pan);
    if (drag.current?.kind === "draw") {
      const box = drawBox(tool, drag.current.x0, drag.current.y0, world.x, world.y);
      const r = await op("createObject", {
        type: tool, ...box,
        fill: tool === "text" ? (dark ? "#ffffff" : "#1e1e1e") : (tool === "sticky" ? "#fff3bf" : fill),
        border: tool === "sticky" ? "#ca8a04" : stroke,
        color: tool === "sticky" ? "#5c4b00" : undefined,
        name: "",
        text: tool === "text" ? "Text" : tool === "sticky" ? "Note" : null,
      });
      if (r.body?.targetId && (tool === "text" || tool === "sticky")) {
        setSelected(r.body.targetId);
        setEdit({ id: r.body.targetId, text: tool === "sticky" ? "Note" : "Text" });
      }
    }
    if (drag.current?.kind === "pencil" && drag.current.points.length > 1) {
      const pts = drag.current.points;
      const xs = pts.map((p: any) => p.x), ys = pts.map((p: any) => p.y);
      const x = Math.min(...xs), y = Math.min(...ys);
      await op("createObject", {
        type: "pencil", x, y,
        width: Math.max(20, Math.max(...xs) - x),
        height: Math.max(20, Math.max(...ys) - y),
        fill: "transparent", border: stroke, name: "",
        text: JSON.stringify(pts),
      });
    }
    if (drag.current?.kind === "move") {
      const moving = objects.find((o: any) => o.id === drag.current.id);
      const dx = world.x - drag.current.sx;
      const dy = world.y - drag.current.sy;
      if (!isLocked(moving) && Math.abs(dx) + Math.abs(dy) > 1) await op("move", { id: drag.current.id, dx, dy });
    }
    drag.current = null;
    setPreview(null);
    setNudge(null);
  }

  function onDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    if (readOnly) return;
    const svg = e.currentTarget;
    const world = worldFromSvg(svg, e.clientX, e.clientY, pan);
    const hit = hitAt(world);
    if (hit && !isLocked(hit) && (hit.type === "text" || hit.type === "sticky" || hit.type === "instance" || labelOf(hit))) {
      setSelected(hit.id);
      setEdit({ id: hit.id, text: hit.text || labelOf(hit) || "" });
    }
  }

  async function commitEdit() {
    if (!edit) return;
    await op("updateObject", { id: edit.id, text: edit.text });
    setEdit(null);
  }

  async function onUpload(file: File) {
    const dataUrl = await new Promise<string>((res) => {
      const reader = new FileReader();
      reader.onload = () => res(String(reader.result));
      reader.readAsDataURL(file);
    });
    const img = new Image();
    await new Promise<void>((res) => { img.onload = () => res(); img.src = dataUrl; });
    const w = Math.max(20, Math.min(480, img.width));
    const h = Math.max(20, Math.round((img.height / img.width) * w) || 120);
    await op("createObject", { type: "image", x: 200, y: 160, width: w, height: h, name: "", text: dataUrl, fill: "#ffffff", border: "#ced4da" });
  }

  async function exportJson() {
    if (!boardId) return;
    const r = await api(`/api/boards/${boardId}/export`);
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([JSON.stringify(r.body, null, 2)], { type: "application/json" }));
    a.download = "boardloom.json"; a.click();
  }

  async function downloadPng() {
    if (!svgRef.current) return;
    const png = await svgToPng(svgRef.current, canvasBg);
    const a = document.createElement("a");
    a.href = png; a.download = `${boardName || "boardloom"}.png`; a.click();
  }

  function currentShareTheme(): "light" | "dark" {
    return dark ? "dark" : "light";
  }

  async function persistBoardName() {
    if (!boardId || readOnly) return;
    const name = boardName.trim();
    if (!name) return;
    const stored = String(state?.board?.name || boards.find((b) => b.id === boardId)?.name || "").trim();
    if (name === stored) return;
    nameLock.current = false;
    await op("renameBoard", { id: boardId, name });
  }

  async function openShare() {
    if (!boardId) return;
    await persistBoardName();
    const theme = currentShareTheme();
    const name = boardName.trim();
    const r = await api("/api/share/link", {
      method: "POST",
      body: JSON.stringify({ boardId, theme, name }),
    });
    if (r.body?.url) setShareUrl(appendShareQuery(r.body.url, theme, name));
    setShareOpen(true);
  }

  async function copyShare() {
    if (!shareUrl) await openShare();
    try { await navigator.clipboard.writeText(shareUrl); toast("Link copied", true); }
    catch { toast(shareUrl, true); }
  }

  async function sendShare() {
    if (!svgRef.current || !boardId) return;
    try {
      await persistBoardName();
      const theme = currentShareTheme();
      const name = boardName.trim();
      const png = await svgToPng(svgRef.current, canvasBg);
      const r = await api("/api/share", {
        method: "POST",
        body: JSON.stringify({ email: shareEmail, boardId, image: png, theme, name }),
      });
      if (r.body?.ok) {
        if (r.body.shareUrl) setShareUrl(appendShareQuery(r.body.shareUrl, theme, name));
        toast(r.body.delivered ? `Sent to ${shareEmail}` : `Queued for ${shareEmail}`, !!r.body.delivered);
      } else toast(r.body?.reason || "INVALID_SHARE");
    } catch (e: any) { toast(e?.message || "INVALID_SHARE"); }
  }

  async function newBoard() {
    const r = await op("createBoard", { name: "Untitled board" }, boardId || "");
    const id = r.body?.targetId;
    if (id) { setBoardId(id); nameLock.current = false; setBoardName("Untitled board"); await refresh(id); }
  }

  async function renameBoard() {
    if (!boardId) return;
    const name = boardName.trim();
    if (!name) return;
    nameLock.current = false;
    const r = await op("renameBoard", { id: boardId, name });
    if (r.body?.ok) toast("Renamed", true);
  }

  function setTheme(next: string) {
    setThemePref(next);
    if (publicToken) {
      if (next === "light" || next === "dark") {
        const u = new URL(location.href);
        u.searchParams.set("theme", next);
        history.replaceState(null, "", `${u.pathname}${u.search}`);
      }
      return;
    }
    localStorage.setItem("bl_theme", next);
  }

  function groupOutlines() {
    const byGroup = new Map<string, any[]>();
    for (const o of objects) {
      if (!o.group_id || o.hidden) continue;
      if (!byGroup.has(o.group_id)) byGroup.set(o.group_id, []);
      byGroup.get(o.group_id)!.push(o);
    }
    const out: any[] = [];
    for (const [id, kids] of byGroup) {
      if (kids.length < 2) continue;
      const xs = kids.map((k: any) => Number(k.x));
      const ys = kids.map((k: any) => Number(k.y));
      const xe = kids.map((k: any) => Number(k.x) + Number(k.width || 0));
      const ye = kids.map((k: any) => Number(k.y) + Number(k.height || 0));
      const x = Math.min(...xs), y = Math.min(...ys);
      out.push({ id, x, y, w: Math.max(...xe) - x, h: Math.max(...ye) - y, count: kids.length });
    }
    return out;
  }

  function shapeEl(o: any) {
    const style = o.style || {};
    const caption = labelOf(o);
    const ink = dark ? "#f1f3f5" : "#1e1e1e";
    const dx = nudge && (nudge.id === o.id || (o.group_id && nudge.groupId === o.group_id)) ? nudge.dx : 0;
    const dy = nudge && (nudge.id === o.id || (o.group_id && nudge.groupId === o.group_id)) ? nudge.dy : 0;
    const x = Number(o.x) + dx, y = Number(o.y) + dy;
    const fillPaint = paintFill(themedFill(style.fill, ink));
    const textColor = themed(style.color, ink) !== ink || style.color
      ? themed(style.color, ink)
      : themed((style.fill && style.fill !== "transparent" && style.fill !== "none") ? style.fill : ink, ink);
    const lineColor = themed(style.border || (style.fill && style.fill !== "transparent" ? style.fill : stroke), ink);
    if (o.type === "pencil") {
      const pts = pencilPts(o).map((p: any) => ({ x: p.x + dx, y: p.y + dy }));
      if (pts.length < 2) return null;
      const d = pts.map((p: any, i: number) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ");
      return <path key={o.id} d={d} fill="none" stroke={themed(style.border || stroke, ink)} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />;
    }
    if (o.type === "image" && o.text) {
      return <image key={o.id} href={o.text} x={x} y={y} width={o.width} height={o.height} />;
    }
    if (o.type === "ellipse") {
      return <ellipse key={o.id} cx={x + o.width / 2} cy={y + o.height / 2} rx={o.width / 2} ry={o.height / 2} fill={fillPaint} stroke={style.border || stroke} strokeWidth={style.borderWidth || 2} />;
    }
    if (o.type === "diamond") {
      const d = `M ${x + o.width / 2} ${y} L ${x + o.width} ${y + o.height / 2} L ${x + o.width / 2} ${y + o.height} L ${x} ${y + o.height / 2} Z`;
      return (
        <g key={o.id}>
          <path d={d} fill={fillPaint} stroke={style.border || stroke} strokeWidth={style.borderWidth || 2} />
          {caption && <text x={x + o.width / 2} y={y + o.height / 2 + 4} textAnchor="middle" fill={textColor} fontSize={13} fontWeight={600}>{caption}</text>}
        </g>
      );
    }
    if (o.type === "line" || o.type === "arrow") {
      return (
        <g key={o.id}>
          {o.type === "arrow" && (
            <marker id={`arr-${o.id}`} markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={lineColor} />
            </marker>
          )}
          <line x1={x} y1={y} x2={x + o.width} y2={y + o.height} stroke={lineColor} strokeWidth={2} markerEnd={o.type === "arrow" ? `url(#arr-${o.id})` : undefined} />
        </g>
      );
    }
    if (o.type === "sticky") {
      const noteInk = style.color || "#5c4b00";
      return (
        <g key={o.id} transform={`rotate(${o.rotation || 0} ${x + o.width / 2} ${y + o.height / 2})`}>
          <rect x={x} y={y} width={o.width} height={o.height} rx={4} fill={fillPaint === "none" ? "#fff3bf" : (style.fill || "#fff3bf")} />
          <text x={x + 12} y={y + 28} fill={noteInk} fontSize={13}>{o.text}</text>
        </g>
      );
    }
    if (o.type === "text") {
      const fs = Number(style.fontSize || 28);
      const w = Math.max(Number(o.width) || 0, String(o.text || "").length * fs * 0.55, 48);
      const h = Math.max(Number(o.height) || 0, fs + 16, 36);
      return (
        <g key={o.id} data-object-id={o.id} data-object-type="text">
          <rect x={x} y={y} width={w} height={h} fill="transparent" stroke={isSelected(o.id) ? "#6965db" : "transparent"} strokeWidth={1.5} pointerEvents="all" />
          <text x={x} y={y + fs} fill={textColor} fontSize={fs} fontWeight={style.fontWeight || 700} pointerEvents="none">{o.text}</text>
        </g>
      );
    }
    if (o.type === "instance") {
      return (
        <g key={o.id}>
          <rect x={x} y={y} width={o.width} height={o.height} rx={8} fill={fillPaint === "none" ? "#2563EB" : (style.fill || "#2563EB")} />
          {o.text ? <text x={x + o.width / 2} y={y + 30} textAnchor="middle" fill="white" fontSize={14} fontWeight={600}>{o.text}</text> : null}
        </g>
      );
    }
    return (
      <g key={o.id}>
        <rect x={x} y={y} width={o.width} height={o.height} rx={o.type === "frame" ? 12 : 8}
          fill={fillPaint}
          stroke={isSelected(o.id) ? "#6965db" : themed(style.border || stroke, ink)}
          strokeWidth={isSelected(o.id) ? 2.5 : (style.borderWidth || 2)} />
        {caption && <text x={x + 14} y={y + 26} fill={textColor} fontSize={13} fontWeight={600}>{caption}</text>}
      </g>
    );
  }

  const fills = dark ? FILLS_DARK : FILLS_LIGHT;
  const strokes = dark ? STROKES_DARK : STROKES_LIGHT;
  const canvasSwatches = dark ? CANVAS_BG_DARK : CANVAS_BG_LIGHT;

  if (!publicToken && !token) {
    return (
      <div className="auth">
        <section className="auth-brand">
          <div className="logo"><span>BL</span> Boardloom</div>
          <div className="hero">
            <div className="eyebrow">YOUR IDEAS, UNBOUNDED</div>
            <h1>Think it.<br /><em>Shape it.</em><br />Share it.</h1>
            <p>An infinite canvas for diagrams, wireframes, and every idea in between.</p>
            <div className="mini-canvas">
              <div className="note">Next big idea ✦</div>
              <div className="flow f1">Research</div>
              <div className="flow f2">Prototype</div>
              <svg><path d="M155 92 C200 92 195 150 238 150" /></svg>
            </div>
          </div>
        </section>
        <section className="auth-form">
          <div className="card">
            <div className="mark">BL</div>
            <h2>{authMode === "signin" ? "Welcome back" : "Create your space"}</h2>
            <p>{authMode === "signin" ? "Sign in to continue to your boards." : "Start with a fresh, empty canvas."}</p>
            <form onSubmit={submitAuth}>
              {authMode === "register" && (
                <label>Display name<input aria-label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Kai Editor" /></label>
              )}
              <label>Email<input aria-label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" /></label>
              <label>Password<input aria-label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} placeholder="At least 8 characters" /></label>
              {authErr && <div className="error">{authErr}</div>}
              <button type="submit" className="primary" name={authMode === "signin" ? "Sign in" : "Create account"} aria-label={authMode === "signin" ? "Sign in" : "Create account"}>
                {authMode === "signin" ? "Sign in" : "Create account"} →
              </button>
            </form>
            <div className="switch">
              {authMode === "signin" ? "New to Boardloom?" : "Already have an account?"}{" "}
              <button type="button" name={authMode === "signin" ? "Register" : "Sign in"} onClick={() => { setAuthMode(authMode === "signin" ? "register" : "signin"); setAuthErr(""); }}>
                {authMode === "signin" ? "Register" : "Sign in"}
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className={`board-page${sidebar && !readOnly ? " editor-sidebar-open" : ""}`}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" aria-label="Upload image"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }} />

      {!readOnly && (
        <header className="board-header">
          <div className="logo compact"><span>BL</span></div>
          <button type="button" onClick={renameBoard} className="board-title" title="Rename board" disabled={!boardId}
            style={{ maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {boardName || "Untitled board"}
          </button>
          <span className="saved"><span className="saved-check">✓</span> Saved</span>
          <div className="board-header-actions">
            <button type="button" className="icon" name={dark ? "Light theme" : "Dark theme"} aria-label={dark ? "Light theme" : "Dark theme"}
              onClick={() => setTheme(dark ? "light" : "dark")} title="Toggle theme">{dark ? "☀" : "☾"}</button>
            <button type="button" className="share-btn" name="Share" aria-label="Share" onClick={openShare} disabled={!boardId}>Share</button>
            <button type="button" className="logout-btn" name="Logout" aria-label="Logout" onClick={signOut}>Logout</button>
          </div>
        </header>
      )}

      {readOnly && boardId && (
        <header className="board-header">
          <div className="logo compact"><span>BL</span></div>
          <span className="board-title" style={{ cursor: "default" }}>{boardName}</span>
          <span className="view-badge">View only</span>
          <div className="board-header-actions">
            <button type="button" className="icon" name={dark ? "Light theme" : "Dark theme"} aria-label={dark ? "Light theme" : "Dark theme"}
              onClick={() => setTheme(dark ? "light" : "dark")} title="Toggle theme">{dark ? "☀" : "☾"}</button>
          </div>
        </header>
      )}

      <div className="editor">
        {!readOnly && sidebar ? (
          <aside className="workspace-sidebar">
            <div className="workspace-sidebar-head">
              <div>
                <div className="eyebrow">Workspace</div>
                <div className="title">Boardloom</div>
              </div>
              <button type="button" name="Hide sidebar" aria-label="Hide sidebar" onClick={() => setSidebar(false)} className="sidebar-btn" style={{ width: "auto", color: "#5b5bd6" }}>Hide sidebar</button>
            </div>
            <div className="workspace-sidebar-body">
              <button type="button" name="New board" aria-label="New board" onClick={newBoard} className="sidebar-btn">New board</button>
              <button type="button" name="Export JSON" aria-label="Export JSON" onClick={exportJson} disabled={!boardId} className="sidebar-btn">Save to...</button>
              <button type="button" name="Export image" aria-label="Export image" onClick={downloadPng} disabled={!boardId} className="sidebar-btn">Export image...</button>
              <button type="button" name="Download image" aria-label="Download image" onClick={downloadPng} disabled={!boardId} className="sidebar-btn">Download image</button>
              <button type="button" name="Share" aria-label="Share" onClick={openShare} disabled={!boardId} className="sidebar-btn">Share</button>
              <button type="button" name="Upload image" aria-label="Upload image" onClick={() => fileRef.current?.click()} disabled={!boardId} className="sidebar-btn">Upload image</button>
              <button type="button" name="Undo" aria-label="Undo" onClick={() => runHistory("undo")} className="sidebar-btn">Undo</button>
              <button type="button" name="Redo" aria-label="Redo" onClick={() => runHistory("redo")} className="sidebar-btn">Redo</button>
              <div className="sidebar-section">Theme</div>
              <div style={{ display: "flex", gap: 4, padding: "0 8px 8px" }}>
                {(["light", "dark", "system"] as const).map((t) => (
                  <button key={t} type="button" name={t === "light" ? "Light theme" : t === "dark" ? "Dark theme" : "System theme"}
                    aria-label={t === "light" ? "Light theme" : t === "dark" ? "Dark theme" : "System theme"}
                    onClick={() => setTheme(t)} className={`sidebar-btn ${themePref === t ? "active" : ""}`} style={{ flex: 1, textAlign: "center", padding: "6px 0", fontSize: 11 }}>{t}</button>
                ))}
              </div>
              <div className="sidebar-section">Canvas background</div>
              <div className="swatches" style={{ padding: "0 12px 8px" }}>
                {canvasSwatches.map((c) => (
                  <button key={c} type="button" aria-label="Canvas background" onClick={() => op("setBackground", { background: c })} style={{ background: c }} />
                ))}
              </div>
              <div className="sidebar-section">Open</div>
              {boards.filter((b) => b.status === "ACTIVE").length === 0 && (
                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>No boards yet. Click New board.</div>
              )}
              {boards.filter((b) => b.status === "ACTIVE").map((b) => (
                <button key={b.id} type="button" onClick={() => { setBoardId(b.id); nameLock.current = false; refresh(b.id); }}
                  className={`sidebar-btn ${b.id === boardId ? "active" : ""}`}>
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{b.name}</div>
                  <div style={{ fontSize: 10, opacity: 0.7, fontFamily: "monospace" }}>{b.id}</div>
                </button>
              ))}
              {boardId && (
                <button type="button" name="Archive board" aria-label="Archive board" className="sidebar-btn"
                  onClick={async () => { await op("archiveBoard", { id: boardId }); await refresh(boardId); }}>Archive board</button>
              )}
              {boards.filter((b) => b.status === "ARCHIVED").length > 0 && (
                <>
                  <div className="sidebar-section">Archived</div>
                  {boards.filter((b) => b.status === "ARCHIVED").map((b) => (
                    <div key={b.id} className="sidebar-btn" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{b.name}</span>
                      <button type="button" name="Restore board" aria-label="Restore board"
                        onClick={async () => { await op("restoreBoard", { id: b.id }); await refresh(boardId); }}>Restore</button>
                    </div>
                  ))}
                </>
              )}
              <div className="sidebar-section">Versions</div>
              <button type="button" name="Save version" aria-label="Save version" className="sidebar-btn"
                onClick={async () => { await op("createVersion", { name: `Version ${new Date().toISOString().slice(11, 19)}` }); await refresh(boardId); }}>Save version</button>
              {versions.filter((v: any) => v.board_id === boardId).length === 0 && (
                <div style={{ padding: "8px 12px", fontSize: 12, color: "var(--muted)" }}>No versions saved yet.</div>
              )}
              {versions.filter((v: any) => v.board_id === boardId).map((v: any) => (
                <div key={v.id} className="sidebar-btn" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis" }}>{v.name}</span>
                  <button type="button" name="Restore version" aria-label="Restore version"
                    onClick={async () => { await op("restoreVersion", { id: v.id }); await refresh(boardId); }}>Restore</button>
                </div>
              ))}
              <input aria-label="Board name" value={boardName} onFocus={() => { nameLock.current = true; }}
                onChange={(e) => setBoardName(e.target.value)}
                onBlur={() => { void persistBoardName(); }}
                style={{ width: "100%", marginTop: 8, padding: "8px 12px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--bg)", color: "inherit" }} />
              <button type="button" name="Rename" aria-label="Rename" onClick={renameBoard} className="sidebar-btn">Rename</button>
            </div>
          </aside>
        ) : !readOnly ? (
          <button type="button" className="show-sidebar-btn" name="Show sidebar" aria-label="Show sidebar" onClick={() => setSidebar(true)}>☰</button>
        ) : null}

        {boardId && !readOnly && (
          <div className="toolbar">
            {TOOLS.map(([id, label]) => (
              <button key={id} type="button" name={label} aria-label={label} className={tool === id ? "active" : ""}
                title={id === "hand" ? "Hand — drag shapes or pan canvas" : label} disabled={readOnly}
                onClick={() => { setTool(id); if (id === "image") fileRef.current?.click(); }}>
                <Icon d={ICONS[id]} />
              </button>
            ))}
          </div>
        )}

        {boardId && !readOnly && (
          <div className="top-actions">
            <button type="button" name="Undo" aria-label="Undo" onClick={() => runHistory("undo")}>↺</button>
            <button type="button" name="Export JSON" aria-label="Export JSON" onClick={exportJson}>JSON</button>
            <button type="button" name="Download image" aria-label="Download image" onClick={downloadPng}>PNG</button>
          </div>
        )}

        <svg
          ref={svgRef}
          className="canvas"
          style={{ cursor: canvasCursor(tool, !!boardId) }}
          onPointerDown={boardId ? onPointerDown : undefined}
          onPointerMove={boardId ? onPointerMove : undefined}
          onPointerUp={boardId ? onPointerUp : undefined}
          onDoubleClick={boardId ? onDoubleClick : undefined}
          onWheel={(e) => {
            e.preventDefault();
            const factor = e.deltaY > 0 ? 0.94 : 1.06;
            setPan((p) => ({ ...p, z: Math.min(4, Math.max(0.15, p.z * factor)) }));
          }}
        >
          <rect width="100%" height="100%" fill={canvasBg} />
          <rect width="100%" height="100%" fill="url(#grid)" pointerEvents="none" />
          <g transform={`translate(${pan.x} ${pan.y}) scale(${pan.z})`}>
            {connectors.map((c: any) => (
              <path key={c.id} d={`M ${c.start?.x} ${c.start?.y} L ${c.end?.x} ${c.end?.y}`} stroke={dark ? "#adb5bd" : "#343a40"} strokeWidth={2} fill="none" markerEnd="url(#arr)" />
            ))}
            {objects.filter((o: any) => !o.hidden).map(shapeEl)}
            {groupOutlines().map((g: any) => (
              <g key={`grp-${g.id}`}>
                <rect x={g.x - 10} y={g.y - 10} width={g.w + 20} height={g.h + 20}
                  fill="none" stroke="#6965db" strokeWidth={1.5} strokeDasharray="8 5" rx={10}
                  pointerEvents="none" />
                <text x={g.x - 10} y={g.y - 16} fill="#6965db" fontSize={11} fontWeight={600}
                  pointerEvents="none">Group of {g.count}</text>
              </g>
            ))}
            {preview?.type === "pencil" && preview.points?.length > 1 && (
              <path d={preview.points.map((p: any, i: number) => `${i ? "L" : "M"} ${p.x} ${p.y}`).join(" ")} fill="none" stroke={stroke} strokeWidth={2.4} strokeLinecap="round" />
            )}
            {preview && (preview.type === "line" || preview.type === "arrow") && (
              <line x1={preview.x} y1={preview.y} x2={preview.x + preview.width} y2={preview.y + preview.height}
                stroke={stroke} strokeWidth={2} strokeDasharray="6 4" markerEnd={preview.type === "arrow" ? "url(#arr)" : undefined} />
            )}
            {preview && preview.type !== "pencil" && preview.type !== "line" && preview.type !== "arrow" && (
              preview.type === "ellipse"
                ? <ellipse cx={preview.x + preview.width / 2} cy={preview.y + preview.height / 2} rx={preview.width / 2} ry={preview.height / 2} fill={fill} stroke={stroke} strokeDasharray="6 4" opacity={0.7} />
                : preview.type === "diamond"
                  ? <path d={`M ${preview.x + preview.width / 2} ${preview.y} L ${preview.x + preview.width} ${preview.y + preview.height / 2} L ${preview.x + preview.width / 2} ${preview.y + preview.height} L ${preview.x} ${preview.y + preview.height / 2} Z`} fill={fill} stroke={stroke} strokeDasharray="6 4" opacity={0.7} />
                  : <rect x={preview.x} y={preview.y} width={preview.width} height={preview.height} fill={preview.type === "text" || fill === "transparent" ? "none" : fill} stroke={stroke} strokeDasharray="6 4" opacity={0.7} rx={8} />
            )}
          </g>
          <defs>
            <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="1" cy="1" r="1" fill={dark ? "#393c45" : "#d6d6d1"} />
            </pattern>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={dark ? "#adb5bd" : "#343a40"} />
            </marker>
          </defs>
        </svg>

        {!boardId && !readOnly && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: "var(--muted)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>Empty workspace</div>
              <div style={{ fontSize: 14 }}>Create a board to start drawing.</div>
            </div>
          </div>
        )}

        {boardId && objects.length === 0 && connectors.length === 0 && (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", pointerEvents: "none", color: "var(--muted)" }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 18, fontWeight: 600, marginBottom: 4, color: "var(--text)" }}>This board is empty</div>
              <div style={{ fontSize: 14 }}>Pick a tool and drag on the canvas to put something on it.</div>
            </div>
          </div>
        )}

        {edit && (
          <div style={{ position: "absolute", zIndex: 30, left: 360, top: 120 }}>
            <textarea aria-label="Edit text" value={edit.text} autoFocus
              onChange={(e) => setEdit({ ...edit, text: e.target.value })}
              onBlur={commitEdit}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commitEdit(); } }}
              style={{ width: 288, height: 112, borderRadius: 12, padding: 12, fontSize: 14, outline: "none", border: "1px solid var(--line)", background: "var(--surface)", color: "inherit" }} />
          </div>
        )}

        {sel && !readOnly && (
          <aside className="properties">
            <h3>Style</h3>
            {(sel.type === "text" || sel.type === "sticky") && (
              <button type="button" name="Edit text" aria-label="Edit text" disabled={isLocked(sel)}
                onClick={() => { if (!isLocked(sel)) setEdit({ id: sel.id, text: sel.text || "" }); }}
                className="primary" style={{ width: "100%", marginBottom: 8, padding: "8px 12px", fontSize: 12 }}>Edit text</button>
            )}
            <label>{sel.type === "text" ? "Text color" : "Fill"}</label>
            <div className="swatches">
              {fills.map((c) => (
                <button key={c} type="button" aria-label={c === "transparent" ? "Transparent" : "Fill"} name={c === "transparent" ? "Transparent" : "Fill"}
                  className={fill === c ? "chosen" : ""} disabled={isLocked(sel)}
                  onClick={() => {
                    if (isLocked(sel)) return;
                    setFill(c);
                    if (sel.type === "line" || sel.type === "arrow") {
                      const ink = c === "transparent" ? stroke : c;
                      setStroke(ink);
                      op("updateObject", { id: sel.id, style: { fill: c, border: ink } });
                    } else {
                      op("updateObject", { id: sel.id, style: { fill: c } });
                    }
                  }}
                  style={c === "transparent"
                    ? { backgroundImage: "linear-gradient(45deg,#ccc 25%,transparent 25%),linear-gradient(-45deg,#ccc 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#ccc 75%),linear-gradient(-45deg,transparent 75%,#ccc 75%)", backgroundSize: "8px 8px", backgroundPosition: "0 0,0 4px,4px -4px,-4px 0" }
                    : { background: c }} />
              ))}
            </div>
            {(sel.type === "sticky" || sel.type === "text") && (
              <>
                <label>Text color</label>
                <div className="swatches">
                  {fills.filter((c) => c !== "transparent").concat(strokes).filter((c, i, a) => a.indexOf(c) === i).map((c) => (
                    <button key={c} type="button" aria-label="Text color" name="Text color" disabled={isLocked(sel)}
                      onClick={() => { if (!isLocked(sel)) op("updateObject", { id: sel.id, style: { color: c } }); }} style={{ background: c }} />
                  ))}
                </div>
              </>
            )}
            <label>Stroke</label>
            <div className="swatches">
              {strokes.map((c) => (
                <button key={c} type="button" disabled={isLocked(sel)}
                  onClick={() => { if (isLocked(sel)) return; setStroke(c); op("updateObject", { id: sel.id, style: { border: c } }); }} style={{ background: c }} />
              ))}
            </div>
            <div className="property-actions">
              <button type="button" name={isLocked(sel) ? "Unlock" : "Lock"} aria-label={isLocked(sel) ? "Unlock" : "Lock"}
                onClick={() => op(isLocked(sel) ? "unlock" : "lock", { id: sel.id })}>{isLocked(sel) ? "Unlock" : "Lock"}</button>
              <button type="button" name="Duplicate" aria-label="Duplicate" onClick={async () => {
                const r = await op("duplicate", { id: sel.id });
                if (r.body?.targetId) setSelected(r.body.targetId);
              }}>Duplicate</button>
              <button type="button" name="Delete" aria-label="Delete" disabled={isLocked(sel)}
                onClick={() => { if (!isLocked(sel)) op("deleteObject", { id: sel.id }); }} style={{ color: "#c92a2a" }}>Delete</button>
            </div>
            <div className="sidebar-section">Layers</div>
            <div className="property-actions">
              <button type="button" name="Bring to front" aria-label="Bring to front"
                onClick={() => {
                  const rest = objects.map((o: any) => o.id).filter((id: string) => id !== sel.id);
                  op("reorder", { ids: rest.concat([sel.id]) });
                }}>Bring to front</button>
              <button type="button" name="Send to back" aria-label="Send to back"
                onClick={() => {
                  const rest = objects.map((o: any) => o.id).filter((id: string) => id !== sel.id);
                  op("reorder", { ids: [sel.id].concat(rest) });
                }}>Send to back</button>
              <button type="button" name={sel.hidden ? "Show" : "Hide"} aria-label={sel.hidden ? "Show" : "Hide"}
                onClick={() => op(sel.hidden ? "show" : "hide", { id: sel.id })}>{sel.hidden ? "Show" : "Hide"}</button>
            </div>
            <div className="sidebar-section">Group</div>
            <div className="property-hint">
              {selectedIds.length > 1
                ? `${selectedIds.length} shapes selected`
                : "Shift-click another shape, or use Select all, to group more than one"}
            </div>
            <div className="property-actions">
              <button type="button" name="Select all" aria-label="Select all"
                onClick={() => {
                  const all = objects.map((o: any) => o.id);
                  setSelected(all[0] ?? null);
                  setAlsoSelected(all.slice(1));
                }}>Select all</button>
              <button type="button" name="Group" aria-label="Group" disabled={selectedIds.length < 2}
                onClick={() => {
                  const ids = Array.from(new Set(
                    selectedIds.concat(objects.filter((o: any) => o.group_id && o.group_id === sel.group_id).map((o: any) => o.id))
                  ));
                  op("group", { ids });
                }}>Group</button>
              <button type="button" name="Ungroup" aria-label="Ungroup" disabled={!sel.group_id}
                onClick={() => { if (sel.group_id) op("ungroup", { id: sel.group_id }); }}>Ungroup</button>
            </div>
            <div className="sidebar-section">Component</div>
            <div className="property-actions">
              <button type="button" name="Make component" aria-label="Make component"
                onClick={() => op("createComponent", {
                  id: sel.id,
                  name: sel.name || "Component",
                  text: sel.text || labelOf(sel) || sel.name || "Component",
                  width: sel.width, height: sel.height,
                  fill: sel.style?.fill && sel.style.fill !== "transparent" ? sel.style.fill : undefined,
                })}>Make component</button>
              <button type="button" name="Place instance" aria-label="Place instance"
                disabled={!sel.component_id && components.length === 0}
                onClick={() => {
                  const componentId = sel.component_id || components[components.length - 1]?.id;
                  if (componentId) op("createInstance", { componentId, x: (sel.x || 0) + 40, y: (sel.y || 0) + 40 });
                }}>Place instance</button>
              <button type="button" name="Set component fill" aria-label="Set component fill"
                disabled={!sel.component_id && components.length === 0}
                onClick={() => {
                  const componentId = sel.component_id || components[components.length - 1]?.id;
                  if (componentId) op("updateComponent", { id: componentId, fill });
                }}>Set component fill</button>
              <button type="button" name="Reset override" aria-label="Reset override" disabled={sel.type !== "instance"}
                onClick={() => { if (sel.type === "instance") op("resetOverride", { id: sel.id }); }}>Reset override</button>
            </div>
          </aside>
        )}

        {boardId && (
          <div className="zoom">
            <button type="button" aria-label="Zoom out" onClick={() => setPan((p) => ({ ...p, z: Math.max(0.15, p.z * 0.9) }))}>−</button>
            <button type="button" name="Zoom" aria-label="Zoom" onClick={() => setPan((p) => ({ ...p, z: 1 }))}><span>{Math.round(pan.z * 100)}%</span></button>
            <button type="button" aria-label="Zoom in" onClick={() => setPan((p) => ({ ...p, z: Math.min(4, p.z * 1.1) }))}>+</button>
            <button type="button" name="Undo" aria-label="Undo" onClick={() => runHistory("undo")}>↺</button>
            <button type="button" name="Redo" aria-label="Redo" onClick={() => runHistory("redo")}>↻</button>
          </div>
        )}

        {archived && <div className="toast" style={{ top: 80, bottom: "auto", color: "#e67700", background: "var(--surface)", border: "1px solid var(--line)" }}>Read-only · BOARD_ARCHIVED</div>}
        {notice && <div className="toast" style={{ top: 80, bottom: "auto", background: noticeOk ? "#2f9e44" : "#e03131" }}>{notice}</div>}

        {shareOpen && (
          <div className="share-overlay" onClick={() => setShareOpen(false)}>
            <div className="share-modal" onClick={(e) => e.stopPropagation()}>
              <h2>Share board</h2>
              <p>Anyone with the link can view this board. Send the link (and a PNG) to an email.</p>
              <input aria-label="Share link" readOnly value={shareUrl} />
              <button type="button" className="primary" name="Copy link" aria-label="Copy link" onClick={copyShare} style={{ width: "100%", marginBottom: 12 }}>Copy link</button>
              <input aria-label="Share email" placeholder="name@example.com" value={shareEmail} onChange={(e) => setShareEmail(e.target.value)} />
              <button type="button" className="primary" name="Send share" aria-label="Send share" onClick={sendShare} style={{ width: "100%", marginBottom: 8, background: "var(--surface)", color: "var(--text)", border: "1px solid var(--line)" }}>Send share</button>
              <button type="button" name="Download image" aria-label="Download image" onClick={downloadPng} style={{ width: "100%", padding: 10, borderRadius: 9, border: "1px solid var(--line)", background: "var(--bg)", cursor: "pointer" }}>Download image</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
