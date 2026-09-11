import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import express from "express";
import cors from "cors";
import fs from "node:fs";
import path from "node:path";
import { Store } from "./db";
import { Engine } from "./engine";
import { sendBoardShare, validEmail } from "./mail";

function loadDotEnv() {
  for (const p of [path.resolve(".env"), path.resolve("backend/.env"), path.resolve("../.env")]) {
    try {
      for (const line of fs.readFileSync(p, "utf8").split("\n")) {
        const t = line.trim();
        if (!t || t.startsWith("#")) continue;
        const i = t.indexOf("=");
        if (i < 1) continue;
        const k = t.slice(0, i).trim();
        const v = t.slice(i + 1).trim().replace(/^['"]|['"]$/g, "");
        if (k && process.env[k] == null) process.env[k] = v;
      }
    } catch { /* optional */ }
  }
}
loadDotEnv();

const PORT = Number(process.env.PORT || 4000);
const SQLITE_PATH = process.env.SQLITE_PATH || "./data/boardloom.db";
const RESET = process.env.BOARDLOOM_ADMIN_RESET === "1";
const PUBLIC_ORIGIN = process.env.BOARDLOOM_PUBLIC_ORIGIN || "http://127.0.0.1:5173";

function buildShareViewUrl(token: string, opts?: { theme?: string; name?: string }) {
  const u = new URL(`${PUBLIC_ORIGIN}/s/${token}`);
  const theme = opts?.theme === "dark" ? "dark" : opts?.theme === "light" ? "light" : "";
  if (theme) u.searchParams.set("theme", theme);
  const name = String(opts?.name || "").trim();
  if (name) u.searchParams.set("name", name);
  return u.toString();
}

fs.mkdirSync(path.dirname(SQLITE_PATH), { recursive: true });
const store = new Store(SQLITE_PATH);
if (RESET) {
  store.seed();
  console.log("[Boardloom] verifier reset: empty database on startup");
}
const engine = new Engine(store);

const app = express();
app.use(cors());
app.use(express.json({ limit: "16mb" }));

function deny(res: any, e: any) {
  const status = Number(e.status || 400);
  res.status(status).json({ ok: false, reason: e.reason || e.message || "ERROR" });
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

function checkPassword(password: string, stored: string) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function bearer(req: express.Request) {
  const h = String(req.headers.authorization || "");
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return String(req.headers["x-access-token"] || "");
}

function requireUser(req: express.Request, res: express.Response) {
  const user = engine.userFromToken(bearer(req));
  if (!user) {
    res.status(401).json({ ok: false, reason: "UNAUTHORIZED" });
    return null;
  }
  return user;
}

app.get("/health", (_q, res) => res.json({ ok: true, db: store.ready }));

app.post("/api/auth/register", (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    const displayName = String(req.body?.displayName || req.body?.name || "").trim();
    if (!validEmail(email)) return res.status(400).json({ ok: false, reason: "INVALID_EMAIL" });
    if (password.length < 8) return res.status(400).json({ ok: false, reason: "PASSWORD_TOO_SHORT" });
    const user = engine.registerUser({ email, passwordHash: hashPassword(password), displayName });
    const access_token = engine.issueToken(user.id);
    res.status(201).json({ ok: true, access_token, token: access_token, user: engine.publicUser(user) });
  } catch (e: any) { deny(res, e); }
});

app.post("/api/auth/signin", (req, res) => {
  try {
    const email = String(req.body?.email || "").trim();
    const password = String(req.body?.password || "");
    const user = engine.userByEmail(email);
    if (!user || !checkPassword(password, user.password_hash)) {
      return res.status(401).json({ ok: false, reason: "INVALID_CREDENTIALS" });
    }
    engine.ensureHomeBoard(user.id);
    const access_token = engine.issueToken(user.id);
    res.json({ ok: true, access_token, token: access_token, user: engine.publicUser(user) });
  } catch (e: any) { deny(res, e); }
});

app.get("/api/me", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json(engine.publicUser(user));
});

app.get("/api/boards", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  res.json(engine.boardsFor(user.id));
});

app.get("/api/boards/:id", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try { res.json(engine.boardState(user.id, req.params.id)); }
  catch (e: any) { deny(res, e); }
});

app.post("/api/ops", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try { res.json(engine.applyOp(user.id, req.body)); }
  catch (e: any) { deny(res, e); }
});

app.get("/api/boards/:id/export", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try { res.json(engine.exportBoard(user.id, req.params.id)); }
  catch (e: any) { deny(res, e); }
});

app.post("/api/share/link", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const boardId = String(req.body?.boardId || "");
    const row = engine.ensureShareLink(user.id, boardId);
    const theme = req.body?.theme === "dark" ? "dark" : req.body?.theme === "light" ? "light" : "";
    const name = String(req.body?.name || "").trim();
    const url = buildShareViewUrl(row.token, { theme: theme || undefined, name: name || undefined });
    res.json({ ok: true, token: row.token, url });
  } catch (e: any) { deny(res, e); }
});

app.get("/api/s/:token", (req, res) => {
  try { res.json(engine.publicByToken(req.params.token)); }
  catch (e: any) { deny(res, e); }
});

app.get("/api/shares", (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  const ids = engine.boardsFor(user.id).map((b) => b.id);
  const rows = engine.store.all("SELECT id,board_id,email,delivered,via,at,share_url, length(image_png) AS image_bytes FROM shares ORDER BY at DESC")
    .filter((s) => ids.includes(s.board_id));
  res.json(rows);
});

app.post("/api/share", async (req, res) => {
  const user = requireUser(req, res);
  if (!user) return;
  try {
    const email = String(req.body?.email || req.body?.to || "").trim();
    const boardId = String(req.body?.boardId || "");
    const image = String(req.body?.image || req.body?.png || "");
    if (!validEmail(email)) return res.status(400).json({ ok: false, reason: "INVALID_SHARE" });
    const board = engine.assertOwner(user.id, boardId);
    const link = engine.ensureShareLink(user.id, boardId);
    const theme = req.body?.theme === "dark" ? "dark" : req.body?.theme === "light" ? "light" : "";
    const name = String(req.body?.name || board.name || "").trim();
    const shareUrl = buildShareViewUrl(link.token, { theme: theme || undefined, name: name || undefined });
    let sent: { delivered: boolean; via: string; error?: string } = { delivered: false, via: "outbox" };
    try { sent = await sendBoardShare({ to: email, boardName: name || String(board.name), shareUrl, pngDataUrl: image }); }
    catch (e: any) { sent = { delivered: false, via: "outbox", error: e?.message || "send failed" }; }
    const row = engine.recordShare(boardId, email, image, sent.delivered, sent.via, shareUrl);
    res.json({ ok: true, ...row, ...sent });
  } catch (e: any) { deny(res, e); }
});

app.get("/api/admin/snapshot", (_q, res) => res.json(engine.snapshot()));
app.all("/api/admin/reset", (_q, res) => {
  if (!RESET) return res.status(404).json({ error: "not_found" });
  store.seed();
  res.json({ ok: true, variant: "default", counts: { users: 0, boards: 0, objects: 0 } });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`[Boardloom] API :${PORT} db=${SQLITE_PATH}`);
});
