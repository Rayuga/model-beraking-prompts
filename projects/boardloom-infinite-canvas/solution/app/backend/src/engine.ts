import { randomBytes } from "node:crypto";
import { Store, type Row } from "./db";

const COLORS = ["#F43F5E", "#2563EB", "#059669", "#7C3AED", "#D97706", "#0D9488"];

function fail(reason: string, status = 400): never {
  throw Object.assign(new Error(reason), { reason, status });
}

function now() {
  return new Date().toISOString();
}

function nid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function roundGrid(n: number, grid: number, snap: boolean) {
  if (!snap) return n;
  return Math.round(n / grid) * grid;
}

function validNum(n: any) {
  return typeof n === "number" && Number.isFinite(n);
}

function validSize(type: string, w: number, h: number) {
  if (!validNum(w) || !validNum(h)) return false;
  if (type === "line" || type === "arrow") return Math.hypot(w, h) >= 20;
  return w >= 20 && h >= 20;
}

function anchorPoint(o: Row, anchor: string) {
  const x = Number(o.x), y = Number(o.y), w = Number(o.width), h = Number(o.height);
  if (anchor === "TOP") return { x: x + w / 2, y };
  if (anchor === "RIGHT") return { x: x + w, y: y + h / 2 };
  if (anchor === "BOTTOM") return { x: x + w / 2, y: y + h };
  if (anchor === "LEFT") return { x, y: y + h / 2 };
  return { x: x + w / 2, y: y + h / 2 };
}

export class Engine {
  constructor(public store: Store) {
    if (!this.store.one("SELECT value FROM kv WHERE key='seeded'")) this.store.seed();
    else this.store.ready = true;
  }

  snapshot() {
    return {
      users: this.store.all("SELECT id,email,display_name,color,created_at FROM users ORDER BY created_at"),
      boards: this.store.all("SELECT * FROM boards ORDER BY created_at"),
      objects: this.store.all("SELECT * FROM objects WHERE tombstone=0 ORDER BY z_order"),
      connectors: this.store.all("SELECT * FROM connectors ORDER BY id"),
      groups: this.store.all("SELECT * FROM groups ORDER BY id"),
      components: this.store.all("SELECT * FROM components ORDER BY id"),
      comments: this.store.all("SELECT * FROM comments ORDER BY id"),
      replies: this.store.all("SELECT * FROM replies ORDER BY id"),
      versions: this.store.all("SELECT id,board_id,name,revision,actor,created_at FROM versions ORDER BY id"),
      shares: this.store.all("SELECT id,board_id,email,delivered,via,at,share_url, length(image_png) AS image_bytes FROM shares ORDER BY at"),
      share_links: this.store.all("SELECT token,board_id,owner_id,created_at FROM share_links ORDER BY created_at"),
      counts: {
        users: this.store.one("SELECT COUNT(*) n FROM users")?.n || 0,
        boards: this.store.one("SELECT COUNT(*) n FROM boards")?.n || 0,
        objects: this.store.one("SELECT COUNT(*) n FROM objects WHERE tombstone=0")?.n || 0,
        shares: this.store.one("SELECT COUNT(*) n FROM shares")?.n || 0,
      },
    };
  }

  userByEmail(email: string) {
    return this.store.one("SELECT * FROM users WHERE lower(email)=lower(?)", [email.trim()]);
  }

  userById(id: string) {
    return this.store.one("SELECT * FROM users WHERE id=?", [id]);
  }

  userFromToken(token?: string) {
    const t = String(token || "").trim();
    if (!t) return undefined;
    const row = this.store.one("SELECT * FROM tokens WHERE token=?", [t]);
    if (!row) return undefined;
    return this.userById(row.user_id);
  }

  registerUser(opts: { email: string; passwordHash: string; displayName: string }) {
    const email = opts.email.trim().toLowerCase();
    if (this.userByEmail(email)) fail("EMAIL_ALREADY_REGISTERED", 409);
    const id = nid("USR");
    const color = COLORS[Math.abs([...email].reduce((a, c) => a + c.charCodeAt(0), 0)) % COLORS.length];
    this.store.run(
      "INSERT INTO users(id,email,display_name,password_hash,color,created_at) VALUES(?,?,?,?,?,?)",
      [id, email, opts.displayName.trim() || email.split("@")[0], opts.passwordHash, color, now()],
    );
    this.ensureHomeBoard(id);
    return this.userById(id)!;
  }

  issueToken(userId: string) {
    const token = randomBytes(24).toString("hex");
    this.store.run("INSERT INTO tokens VALUES(?,?,?)", [token, userId, now()]);
    return token;
  }

  publicUser(u: Row) {
    return { id: u.id, email: u.email, displayName: u.display_name, color: u.color };
  }

  board(id: string) {
    const b = this.store.one("SELECT * FROM boards WHERE id=?", [id]);
    if (!b) fail("OBJECT_NOT_FOUND", 404);
    return b!;
  }

  assertOwner(userId: string, boardId: string) {
    const b = this.board(boardId);
    if (b.owner_id !== userId) fail("ACCESS_DENIED", 403);
    return b;
  }

  boardsFor(userId: string) {
    return this.store.all("SELECT * FROM boards WHERE owner_id=? ORDER BY created_at", [userId]);
  }

  ensureHomeBoard(userId: string) {
    const active = this.boardsFor(userId).find((b) => b.status === "ACTIVE");
    if (active) return active;
    const created = this.createBoard(userId, { name: "Untitled board" });
    this.bump(created.boardId);
    return this.board(created.boardId);
  }

  bump(boardId: string) {
    this.store.run("UPDATE boards SET revision=revision+1, updated_at=? WHERE id=?", [now(), boardId]);
    return Number(this.board(boardId).revision);
  }

  applyOp(userId: string, body: any) {
    const user = this.userById(userId);
    if (!user) fail("ACCESS_DENIED", 401);
    const opId = String(body.opId || body.id || nid("op"));
    const existing = this.store.one("SELECT * FROM ops WHERE id=?", [opId]);
    if (existing) return { ok: true, duplicate: true, reason: "DUPLICATE_OPERATION", revision: existing.revision };
    const type = String(body.type || body.op || "");
    const payload = body.payload || body;
    const requestedBoard = String(body.boardId || body.board_id || payload.id || payload.boardId || "");
    this.store.db.exec("BEGIN IMMEDIATE");
    try {
      const result = this.dispatch(userId, requestedBoard, type, payload);
      const boardId = String(result.boardId || requestedBoard);
      if (!boardId) fail("OBJECT_NOT_FOUND", 400);
      const rev = this.bump(boardId);
      this.store.run(
        "INSERT INTO ops VALUES(?,?,?,?,?,?,?,?,?)",
        [opId, boardId, userId, type, JSON.stringify(payload), result.before || null, result.after || null, rev, now()],
      );
      this.store.run(
        "INSERT INTO activity VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        [nid("ACT"), user.display_name, boardId, type, result.targetType || "object",
          result.targetId || boardId, result.before || null, result.after || null, rev, now(), opId],
      );
      this.store.db.exec("COMMIT");
      return { ok: true, ...result, revision: rev, opId };
    } catch (e: any) {
      this.store.db.exec("ROLLBACK");
      throw e;
    }
  }

  dispatch(userId: string, boardId: string, type: string, p: any): any {
    const skipBoard = type === "createBoard" || type === "importBoard";
    let board: Row | undefined;
    if (!skipBoard) {
      if (!boardId) fail("OBJECT_NOT_FOUND", 400);
      board = this.assertOwner(userId, boardId);
      const allowedOnArchived = ["restoreBoard", "deleteBoard", "duplicateBoard", "favoriteBoard"];
      if (board.status === "ARCHIVED" && !allowedOnArchived.includes(type)) fail("BOARD_ARCHIVED", 403);
    }
    const map: Record<string, () => any> = {
      createObject: () => this.createObject(userId, boardId, p),
      updateObject: () => this.updateObject(userId, boardId, p),
      deleteObject: () => this.deleteObject(userId, boardId, p),
      move: () => this.move(userId, boardId, p),
      groupMove: () => this.groupMove(userId, boardId, p),
      lock: () => this.setFlag(userId, boardId, p, "locked", 1),
      unlock: () => this.setFlag(userId, boardId, p, "locked", 0),
      hide: () => this.setFlag(userId, boardId, p, "hidden", 1),
      show: () => this.setFlag(userId, boardId, p, "hidden", 0),
      reorder: () => this.reorder(userId, boardId, p),
      group: () => this.group(userId, boardId, p),
      ungroup: () => this.ungroup(userId, boardId, p),
      duplicate: () => this.duplicate(userId, boardId, p),
      createConnector: () => this.createConnector(userId, boardId, p),
      createComponent: () => this.createComponent(userId, boardId, p),
      createInstance: () => this.createInstance(userId, boardId, p),
      updateComponent: () => this.updateComponent(userId, boardId, p),
      resetOverride: () => this.resetOverride(userId, boardId, p),
      detachInstance: () => this.detachInstance(userId, boardId, p),
      createBoard: () => this.createBoard(userId, p),
      renameBoard: () => this.patchBoard(userId, p, { name: p.name }),
      favoriteBoard: () => this.patchBoard(userId, p, { favorite: p.favorite ? 1 : 0 }),
      archiveBoard: () => this.patchBoard(userId, p, { status: "ARCHIVED" }),
      restoreBoard: () => this.patchBoard(userId, p, { status: "ACTIVE" }),
      duplicateBoard: () => this.duplicateBoard(userId, p),
      deleteBoard: () => this.deleteBoard(userId, p),
      createVersion: () => this.createVersion(userId, boardId, p),
      restoreVersion: () => this.restoreVersion(userId, boardId, p),
      undo: () => this.undo(userId, boardId),
      redo: () => this.redo(userId, boardId),
      setBackground: () => this.patchBoard(userId, { id: boardId }, { background: p.background }),
      importBoard: () => this.importBoard(userId, p),
    };
    const fn = map[type];
    if (!fn) fail("OBJECT_NOT_FOUND", 400);
    return fn();
  }

  obj(id: string) {
    const o = this.store.one("SELECT * FROM objects WHERE id=? AND tombstone=0", [id]);
    if (!o) fail("OBJECT_NOT_FOUND", 404);
    return o!;
  }

  createObject(userId: string, boardId: string, p: any) {
    const type = String(p.type || "rectangle");
    let w = Number(p.width ?? 120), h = Number(p.height ?? 80);
    const x = Number(p.x ?? 200), y = Number(p.y ?? 200);
    if (type === "text") {
      const fs = Number(p.style?.fontSize || 28);
      const text = String(p.text ?? "Text");
      w = Math.max(w, text.length * fs * 0.55, 48);
      h = Math.max(h, fs + 16, 36);
    }
    if (!validNum(w) || !validNum(h) || !validNum(x) || !validNum(y) || !validSize(type, w, h)) fail("INVALID_GEOMETRY");
    const board = this.board(boardId);
    const id = String(p.id || nid("OBJ"));
    const z = Number(this.store.one("SELECT COALESCE(MAX(z_order),0)+1 n FROM objects WHERE board_id=?", [boardId])?.n);
    const style = {
      fill: p.fill ?? p.style?.fill ?? "#ffffff",
      border: p.border ?? p.style?.border ?? "#1e1e1e",
      borderWidth: Number(p.borderWidth || 2),
      opacity: 1,
      fontSize: p.style?.fontSize,
      fontWeight: p.style?.fontWeight,
      color: p.color ?? p.style?.color,
    };
    const name = p.name != null ? String(p.name) : "";
    this.store.run(
      `INSERT INTO objects(id,board_id,type,name,x,y,width,height,rotation,style_json,z_order,parent_frame,group_id,locked,hidden,text,created_at,updated_at,creator,editor,obj_revision,tombstone)
       VALUES(?,?,?,?,?,?,?,?,0,?,?,NULL,NULL,0,0,?,?,?,?,?,1,0)`,
      [id, boardId, type, name,
        roundGrid(x, board.grid, !!board.snap), roundGrid(y, board.grid, !!board.snap),
        w, h, JSON.stringify(style), z, p.text ?? null, now(), now(), userId, userId],
    );
    return { boardId, targetType: "object", targetId: id, after: JSON.stringify({ id }) };
  }

  updateObject(userId: string, boardId: string, p: any) {
    const o = this.obj(p.id);
    if (o.locked) fail("OBJECT_LOCKED", 403);
    const patch: string[] = [];
    const vals: any[] = [];
    if (p.name != null) { patch.push("name=?"); vals.push(p.name); }
    if (p.text != null) { patch.push("text=?"); vals.push(p.text); }
    if (p.style) {
      const style = { ...JSON.parse(o.style_json || "{}"), ...p.style };
      patch.push("style_json=?"); vals.push(JSON.stringify(style));
    }
    if (p.width != null || p.height != null) {
      const w = Number(p.width ?? o.width), h = Number(p.height ?? o.height);
      if (!validNum(w) || !validNum(h) || !validSize(String(o.type), w, h)) fail("INVALID_GEOMETRY");
      patch.push("width=?"); vals.push(w);
      patch.push("height=?"); vals.push(h);
    }
    patch.push("editor=?", "updated_at=?", "obj_revision=obj_revision+1");
    vals.push(userId, now(), o.id);
    this.store.run(`UPDATE objects SET ${patch.join(",")} WHERE id=?`, vals);
    if (o.type === "instance" && p.text != null) {
      const ov = { ...(JSON.parse(o.overrides_json || "{}")), text: p.text };
      this.store.run("UPDATE objects SET overrides_json=? WHERE id=?", [JSON.stringify(ov), o.id]);
    }
    return { boardId, targetId: o.id, before: JSON.stringify({ style: o.style_json }), after: JSON.stringify(p) };
  }

  move(userId: string, boardId: string, p: any) {
    const o = this.obj(p.id);
    if (o.locked) fail("OBJECT_LOCKED", 403);
    const board = this.board(boardId);
    const dx = Number(p.dx ?? (Number(p.x) - o.x));
    const dy = Number(p.dy ?? (Number(p.y) - o.y));
    if (!validNum(dx) || !validNum(dy)) fail("INVALID_GEOMETRY");
    if (o.group_id) {
      return this.groupMove(userId, boardId, { id: o.group_id, dx, dy, snap: p.snap });
    }
    const nx = roundGrid(Number(o.x) + dx, board.grid, p.snap === false ? false : !!board.snap);
    const ny = roundGrid(Number(o.y) + dy, board.grid, p.snap === false ? false : !!board.snap);
    const before = { x: o.x, y: o.y };
    this.store.run("UPDATE objects SET x=?, y=?, editor=?, updated_at=? WHERE id=?", [nx, ny, userId, now(), o.id]);
    if (o.type === "frame") {
      this.store.all("SELECT * FROM objects WHERE parent_frame=? AND tombstone=0", [o.id]).forEach((c) => {
        this.store.run("UPDATE objects SET x=x+?, y=y+? WHERE id=?", [nx - o.x, ny - o.y, c.id]);
      });
    }
    return { boardId, targetId: o.id, before: JSON.stringify(before), after: JSON.stringify({ x: nx, y: ny }) };
  }

  groupMove(userId: string, boardId: string, p: any) {
    const g = this.store.one("SELECT * FROM groups WHERE id=?", [p.id]);
    if (!g) fail("OBJECT_NOT_FOUND", 404);
    const dx = Number(p.dx), dy = Number(p.dy);
    if (!validNum(dx) || !validNum(dy)) fail("INVALID_GEOMETRY");
    const kids = this.store.all("SELECT * FROM objects WHERE group_id=? AND tombstone=0", [g.id]);
    if (!kids.length) fail("OBJECT_NOT_FOUND", 404);
    if (kids.some((k) => k.locked)) fail("OBJECT_LOCKED", 403);
    const board = this.board(boardId);
    const snap = p.snap === false ? false : !!board.snap;
    const beforeMembers = kids.map((k) => ({ id: k.id, x: k.x, y: k.y }));
    const afterMembers = kids.map((k) => {
      const nx = roundGrid(Number(k.x) + dx, board.grid, snap);
      const ny = roundGrid(Number(k.y) + dy, board.grid, snap);
      this.store.run(
        "UPDATE objects SET x=?, y=?, editor=?, updated_at=? WHERE id=?",
        [nx, ny, userId, now(), k.id],
      );
      return { id: k.id, x: nx, y: ny };
    });
    const head = afterMembers[0];
    return {
      boardId,
      targetId: g.id,
      before: JSON.stringify({ x: beforeMembers[0].x, y: beforeMembers[0].y, members: beforeMembers }),
      after: JSON.stringify({ x: head.x, y: head.y, dx, dy, members: afterMembers }),
    };
  }

  setFlag(userId: string, boardId: string, p: any, col: string, val: number) {
    const o = this.obj(p.id);
    this.store.run(`UPDATE objects SET ${col}=?, editor=?, updated_at=? WHERE id=?`, [val, userId, now(), o.id]);
    return { boardId, targetId: o.id, after: JSON.stringify({ [col]: val }) };
  }

  reorder(userId: string, boardId: string, p: any) {
    const ids: string[] = p.ids || [];
    ids.forEach((id, i) => this.store.run("UPDATE objects SET z_order=? WHERE id=?", [i + 1, id]));
    return { boardId, targetId: boardId, after: JSON.stringify({ ids }) };
  }

  group(userId: string, boardId: string, p: any) {
    const ids: string[] = p.ids || [];
    if (ids.length < 2) fail("INVALID_GEOMETRY");
    const kids = ids.map((id) => this.obj(id));
    if (kids.some((k) => k.locked)) fail("OBJECT_LOCKED", 403);
    if (ids.some((id) => kids.some((k) => k.group_id === id))) fail("CIRCULAR_GROUP");
    const gid = String(p.id || nid("GRP"));
    this.store.run("INSERT INTO groups VALUES(?,?,?)", [gid, boardId, p.name || "Group"]);
    kids.forEach((k) => this.store.run("UPDATE objects SET group_id=? WHERE id=?", [gid, k.id]));
    return { boardId, targetId: gid };
  }

  ungroup(userId: string, boardId: string, p: any) {
    this.store.run("UPDATE objects SET group_id=NULL WHERE group_id=?", [p.id]);
    this.store.run("DELETE FROM groups WHERE id=?", [p.id]);
    return { boardId, targetId: p.id };
  }

  duplicate(userId: string, boardId: string, p: any) {
    const ids: string[] = p.ids || (p.id ? [p.id] : []);
    const map: Record<string, string> = {};
    ids.forEach((id, i) => {
      const o = this.obj(id);
      const nidObj = nid("DUP") + i;
      map[id] = nidObj;
      this.store.run(
        `INSERT INTO objects(id,board_id,type,name,x,y,width,height,rotation,style_json,z_order,parent_frame,group_id,locked,hidden,text,component_id,overrides_json,created_at,updated_at,creator,editor,obj_revision,tombstone)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,0)`,
        [nidObj, boardId, o.type, o.name, Number(o.x) + 20, Number(o.y) + 20, o.width, o.height, o.rotation,
          o.style_json, o.z_order, o.parent_frame, null, 0, 0, o.text, o.component_id, o.overrides_json,
          now(), now(), userId, userId],
      );
    });
    return { boardId, targetId: Object.values(map)[0], after: JSON.stringify(map) };
  }

  createConnector(userId: string, boardId: string, p: any) {
    const start = this.obj(p.startId || p.start_id);
    const end = this.obj(p.endId || p.end_id);
    const id = String(p.id || nid("CON"));
    this.store.run(
      "INSERT INTO connectors VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
      [id, boardId, start.id, p.startAnchor || p.start_anchor || "RIGHT",
        end.id, p.endAnchor || p.end_anchor || "LEFT", null, null, null, null,
        p.decoration || "ARROW", p.color || "#334155", 1],
    );
    return { boardId, targetId: id };
  }

  createComponent(userId: string, boardId: string, p: any) {
    const id = String(p.id || nid("CMP"));
    this.store.run("INSERT INTO components VALUES(?,?,?,?,?,?,?)",
      [id, boardId, p.name || "Component", Number(p.width || 160), Number(p.height || 48),
        p.fill || "#2563EB", p.text || "Continue"]);
    return { boardId, targetId: id };
  }

  createInstance(userId: string, boardId: string, p: any) {
    const c = this.store.one("SELECT * FROM components WHERE id=?", [p.componentId || p.component_id]);
    if (!c) fail("OBJECT_NOT_FOUND", 404);
    const id = String(p.id || nid("INS"));
    const ov = p.text != null ? { text: p.text } : {};
    const style = { fill: c.fill, border: "#1D4ED8", borderWidth: 0, opacity: 1 };
    this.store.run(
      `INSERT INTO objects(id,board_id,type,name,x,y,width,height,rotation,style_json,z_order,parent_frame,group_id,locked,hidden,text,component_id,overrides_json,created_at,updated_at,creator,editor,obj_revision,tombstone)
       VALUES(?,?,?,?,?,?,?,?,0,?,?,NULL,NULL,0,0,?,?,?,?,?,?,?,1,0)`,
      [id, boardId, "instance", p.name || c.name, Number(p.x ?? 200), Number(p.y ?? 200),
        c.width, c.height, JSON.stringify(style), 9, ov.text ?? c.text, c.id,
        Object.keys(ov).length ? JSON.stringify(ov) : null, now(), now(), userId, userId],
    );
    return { boardId, targetId: id };
  }

  detachInstance(userId: string, boardId: string, p: any) {
    const o = this.obj(p.id);
    this.store.run("UPDATE objects SET type='rectangle', component_id=NULL, overrides_json=NULL WHERE id=?", [o.id]);
    return { boardId, targetId: o.id };
  }

  deleteObject(userId: string, boardId: string, p: any) {
    const o = this.obj(p.id);
    if (o.locked) fail("OBJECT_LOCKED", 403);
    this.store.run("UPDATE objects SET tombstone=1, updated_at=? WHERE id=?", [now(), o.id]);
    this.store.all("SELECT * FROM connectors WHERE start_id=? OR end_id=?", [o.id, o.id]).forEach((c) => {
      const pt = anchorPoint(o, c.start_id === o.id ? c.start_anchor : c.end_anchor);
      if (c.start_id === o.id) {
        this.store.run("UPDATE connectors SET start_id=NULL, start_x=?, start_y=? WHERE id=?", [pt.x, pt.y, c.id]);
      } else {
        this.store.run("UPDATE connectors SET end_id=NULL, end_x=?, end_y=? WHERE id=?", [pt.x, pt.y, c.id]);
      }
    });
    this.store.run("UPDATE comments SET object_id=NULL, x=?, y=? WHERE object_id=?", [o.x, o.y, o.id]);
    return { boardId, targetId: o.id };
  }

  updateComponent(userId: string, boardId: string, p: any) {
    const c = this.store.one("SELECT * FROM components WHERE id=?", [p.id]);
    if (!c) fail("OBJECT_NOT_FOUND", 404);
    if (p.fill != null) this.store.run("UPDATE components SET fill=? WHERE id=?", [p.fill, c.id]);
    if (p.text != null) this.store.run("UPDATE components SET text=? WHERE id=?", [p.text, c.id]);
    const master = this.store.one("SELECT * FROM components WHERE id=?", [c.id])!;
    this.store.all("SELECT * FROM objects WHERE component_id=? AND tombstone=0", [c.id]).forEach((inst) => {
      const ov = JSON.parse(inst.overrides_json || "{}");
      const style = JSON.parse(inst.style_json || "{}");
      if (p.fill != null) style.fill = master.fill;
      this.store.run("UPDATE objects SET style_json=?, text=? WHERE id=?",
        [JSON.stringify(style), ov.text ?? master.text, inst.id]);
    });
    return { boardId, targetId: c.id, after: JSON.stringify(master) };
  }

  resetOverride(userId: string, boardId: string, p: any) {
    const o = this.obj(p.id);
    const c = this.store.one("SELECT * FROM components WHERE id=?", [o.component_id]);
    const ov = JSON.parse(o.overrides_json || "{}");
    delete ov[p.field || "text"];
    this.store.run("UPDATE objects SET overrides_json=?, text=? WHERE id=?",
      [JSON.stringify(ov), c?.text, o.id]);
    return { boardId, targetId: o.id };
  }

  addComment(userId: string, boardId: string, p: any) {
    const id = String(p.id || nid("CMT"));
    const me = this.userById(userId)!;
    this.store.run("INSERT INTO comments VALUES(?,?,?,?,?,?,?,?,?)",
      [id, boardId, p.objectId || null, p.x || 0, p.y || 0, me.display_name, p.text, "OPEN", now()]);
    return { boardId, targetId: id };
  }

  patchBoard(userId: string, p: any, fields: Record<string, any>) {
    const id = p.id || p.boardId;
    this.assertOwner(userId, id);
    for (const [k, v] of Object.entries(fields)) this.store.run(`UPDATE boards SET ${k}=?, updated_at=? WHERE id=?`, [v, now(), id]);
    return { boardId: id, targetType: "board", targetId: id, after: JSON.stringify(fields) };
  }

  createBoard(userId: string, p: any) {
    const id = String(p.id || nid("BRD"));
    this.store.run(
      `INSERT INTO boards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, userId, p.name || "Untitled board", "ACTIVE", 0, now(), now(), p.background || "", 10, 1, 0, 0, 1, 1],
    );
    return { boardId: id, targetType: "board", targetId: id };
  }

  duplicateBoard(userId: string, p: any) {
    const src = this.assertOwner(userId, p.id);
    const id = nid("BRD");
    this.store.run(
      `INSERT INTO boards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, userId, `${src.name} copy`, "ACTIVE", 0, now(), now(), src.background, src.grid, src.snap, 0, 0, 1, 1],
    );
    return { boardId: id, targetType: "board", targetId: id };
  }

  deleteBoard(userId: string, p: any) {
    this.assertOwner(userId, p.id);
    this.store.run("DELETE FROM boards WHERE id=?", [p.id]);
    return { boardId: p.id, targetType: "board", targetId: p.id };
  }

  createVersion(userId: string, boardId: string, p: any) {
    const b = this.board(boardId);
    const id = String(p.id || nid("VER"));
    const snap = JSON.stringify({ objects: this.store.all("SELECT * FROM objects WHERE board_id=?", [boardId]) });
    const me = this.userById(userId)!;
    this.store.run("INSERT INTO versions VALUES(?,?,?,?,?,?,?)",
      [id, boardId, p.name || "Named version", b.revision, me.display_name, now(), snap]);
    return { boardId, targetId: id };
  }

  restoreVersion(userId: string, boardId: string, p: any) {
    const v = this.store.one("SELECT * FROM versions WHERE id=?", [p.id]);
    if (!v) fail("OBJECT_NOT_FOUND", 404);
    const snap = JSON.parse(v.snapshot_json);
    this.store.run("DELETE FROM objects WHERE board_id=?", [boardId]);
    for (const o of snap.objects || []) {
      const cols = Object.keys(o);
      this.store.run(
        `INSERT INTO objects(${cols.join(",")}) VALUES(${cols.map(() => "?").join(",")})`,
        cols.map((c) => o[c]),
      );
    }
    return { boardId, targetId: v.id, after: JSON.stringify({ restored: v.revision }) };
  }

  undo(userId: string, boardId: string) {
    const { applied, mutating } = this.appliedOpIds(boardId, userId);
    const last = [...mutating].reverse().find((c) => applied.has(c.id));
    if (!last) return { boardId, targetId: boardId, after: JSON.stringify({ noop: true }) };
    this.applyOpEffect(last, "inverse");
    return { boardId, targetId: last.id, after: JSON.stringify({ targetOp: last.id, undoneType: last.type }) };
  }

  redo(userId: string, boardId: string) {
    const { applied } = this.appliedOpIds(boardId, userId);
    const undos = this.store.all(
      "SELECT * FROM ops WHERE board_id=? AND client_id=? AND type='undo' ORDER BY revision DESC",
      [boardId, userId],
    );
    const pending = undos.find((u) => {
      const targetOp = this.parseOpJson(u.after_json).targetOp;
      return targetOp && !applied.has(targetOp);
    });
    if (!pending) return { boardId, targetId: boardId, after: JSON.stringify({ noop: true }) };
    const targetId = this.parseOpJson(pending.after_json).targetOp;
    const target = this.store.one("SELECT * FROM ops WHERE id=?", [targetId]);
    if (!target) return { boardId, targetId: boardId, after: JSON.stringify({ noop: true }) };
    this.applyOpEffect(target, "forward");
    return { boardId, targetId: target.id, after: JSON.stringify({ targetOp: target.id }) };
  }

  mutatingOps(boardId: string, userId: string) {
    return this.store.all(
      "SELECT * FROM ops WHERE board_id=? AND client_id=? AND type IN ('move','groupMove','updateObject','createObject','deleteObject','hide','show') ORDER BY revision ASC",
      [boardId, userId],
    );
  }

  appliedOpIds(boardId: string, userId: string) {
    const mutating = this.mutatingOps(boardId, userId);
    const applied = new Set(mutating.map((o) => o.id));
    const metas = this.store.all(
      "SELECT * FROM ops WHERE board_id=? AND client_id=? AND type IN ('undo','redo') ORDER BY revision ASC",
      [boardId, userId],
    );
    for (const m of metas) {
      const targetOp = this.parseOpJson(m.after_json).targetOp;
      if (!targetOp) continue;
      if (m.type === "undo") applied.delete(targetOp);
      else applied.add(targetOp);
    }
    return { applied, mutating };
  }

  parseOpJson(raw?: string | null) {
    try { return JSON.parse(raw || "{}"); } catch { return {}; }
  }

  applyOpEffect(target: Row, direction: "forward" | "inverse") {
    const payload = this.parseOpJson(target.payload_json);
    const before = target.before_json ? this.parseOpJson(target.before_json) : null;
    const after = target.after_json ? this.parseOpJson(target.after_json) : null;
    const type = String(target.type);

    if (type === "move" || type === "groupMove") {
      const pos = direction === "forward" ? after : before;
      if (Array.isArray(pos?.members)) {
        pos.members.forEach((m: any) => this.store.run("UPDATE objects SET x=?, y=? WHERE id=?", [m.x, m.y, m.id]));
      } else if (payload.id && pos) {
        if (direction === "inverse") {
          const o = this.store.one("SELECT * FROM objects WHERE id=?", [payload.id]);
          if (o && after && Number(o.x) !== Number(after.x)) fail("UNDO_CONFLICT", 409);
        }
        this.store.run("UPDATE objects SET x=?, y=? WHERE id=?", [pos.x, pos.y, payload.id]);
      }
      return;
    }

    if (type === "createObject" && after?.id) {
      this.store.run("UPDATE objects SET tombstone=? WHERE id=?", [direction === "forward" ? 0 : 1, after.id]);
      return;
    }

    if (type === "deleteObject" && payload.id) {
      this.store.run("UPDATE objects SET tombstone=? WHERE id=?", [direction === "forward" ? 1 : 0, payload.id]);
      return;
    }

    if (type === "updateObject" && payload.id) {
      if (direction === "inverse" && before?.style != null) {
        this.store.run("UPDATE objects SET style_json=? WHERE id=?", [before.style, payload.id]);
      } else if (direction === "forward" && payload.style) {
        const o = this.store.one("SELECT * FROM objects WHERE id=?", [payload.id]);
        if (!o) return;
        const style = { ...this.parseOpJson(o.style_json), ...payload.style };
        this.store.run("UPDATE objects SET style_json=? WHERE id=?", [JSON.stringify(style), payload.id]);
      }
      return;
    }

    if (type === "hide" && payload.id) {
      this.store.run("UPDATE objects SET hidden=? WHERE id=?", [direction === "forward" ? 1 : 0, payload.id]);
      return;
    }

    if (type === "show" && payload.id) {
      this.store.run("UPDATE objects SET hidden=? WHERE id=?", [direction === "forward" ? 0 : 1, payload.id]);
    }
  }

  importBoard(userId: string, p: any) {
    const data = p.data || p;
    if (!data || !Array.isArray(data.objects)) fail("INVALID_IMPORT");
    const allowed = new Set(["rectangle", "ellipse", "diamond", "line", "arrow", "text", "sticky", "frame", "instance", "ortho", "image", "pencil"]);
    const ids = new Set<string>();
    for (const o of data.objects) {
      if (!o?.id || ids.has(o.id)) fail("INVALID_IMPORT");
      ids.add(o.id);
      if (o.type && !allowed.has(String(o.type))) fail("INVALID_IMPORT");
      const x = Number(o.x), y = Number(o.y), w = Number(o.width), h = Number(o.height ?? 20);
      if (!validNum(x) || !validNum(y) || !validNum(w) || !validNum(h) || !validSize(String(o.type || "rectangle"), w, h)) fail("INVALID_IMPORT");
    }
    for (const c of data.connectors || []) {
      if (c.start_id && !ids.has(c.start_id)) fail("INVALID_IMPORT");
      if (c.end_id && !ids.has(c.end_id)) fail("INVALID_IMPORT");
    }
    const id = nid("BRD");
    const remap: Record<string, string> = {};
    this.store.run(
      `INSERT INTO boards VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, userId, data.name || data.board?.name || "Imported", "ACTIVE", 0, now(), now(), "", 10, 1, 0, 0, 1, 1],
    );
    data.objects.forEach((o: any, i: number) => {
      const oid = nid("IMP") + i;
      remap[o.id] = oid;
      const style = o.style_json || JSON.stringify(o.style || { fill: "#ffffff", border: "#1e1e1e" });
      this.store.run(
        `INSERT INTO objects(id,board_id,type,name,x,y,width,height,rotation,style_json,z_order,parent_frame,group_id,locked,hidden,text,created_at,updated_at,creator,editor,obj_revision,tombstone)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,NULL,0,0,?,?,?,?,?,1,0)`,
        [oid, id, o.type, o.name || "", o.x, o.y, o.width, o.height, o.rotation || 0, style, o.z_order || i + 1,
          o.parent_frame ? remap[o.parent_frame] || null : null, o.text || null, now(), now(), userId, userId],
      );
    });
    return { boardId: id, targetType: "board", targetId: id, after: JSON.stringify(remap) };
  }

  exportBoard(userId: string, boardId: string) {
    this.assertOwner(userId, boardId);
    return this.boardGraph(boardId);
  }

  boardGraph(boardId: string) {
    const board = this.board(boardId);
    const objects = this.store.all("SELECT * FROM objects WHERE board_id=? AND tombstone=0 ORDER BY z_order", [boardId]);
    const connectors = this.store.all("SELECT * FROM connectors WHERE board_id=?", [boardId]).map((c) => {
      const start = c.start_id ? this.store.one("SELECT * FROM objects WHERE id=?", [c.start_id]) : null;
      const end = c.end_id ? this.store.one("SELECT * FROM objects WHERE id=?", [c.end_id]) : null;
      const s = start ? anchorPoint(start, c.start_anchor) : { x: c.start_x, y: c.start_y };
      const e = end ? anchorPoint(end, c.end_anchor) : { x: c.end_x, y: c.end_y };
      return { ...c, start: s, end: e };
    });
    const instances = objects.filter((o) => o.type === "instance").map((o) => {
      const master = this.store.one("SELECT * FROM components WHERE id=?", [o.component_id]);
      const ov = JSON.parse(o.overrides_json || "{}");
      const style = JSON.parse(o.style_json || "{}");
      return { ...o, style, text: ov.text ?? master?.text, fill: style.fill || master?.fill };
    });
    return {
      board,
      objects: objects.map((o) => ({ ...o, style: JSON.parse(o.style_json || "{}") })),
      connectors,
      groups: this.store.all("SELECT * FROM groups WHERE board_id=?", [boardId]),
      versions: this.store.all(
        "SELECT id,board_id,name,revision,actor,created_at FROM versions WHERE board_id=? ORDER BY id DESC",
        [boardId]),
      components: this.store.all("SELECT * FROM components WHERE board_id=?", [boardId]),
      comments: this.store.all("SELECT * FROM comments WHERE board_id=?", [boardId]),
      replies: this.store.all(
        "SELECT r.* FROM replies r JOIN comments c ON c.id=r.thread_id WHERE c.board_id=?",
        [boardId],
      ),
      versions: this.store.all("SELECT id,board_id,name,revision,actor,created_at FROM versions WHERE board_id=?", [boardId]),
      instances,
    };
  }

  boardState(userId: string, boardId: string) {
    this.assertOwner(userId, boardId);
    return this.boardGraph(boardId);
  }

  ensureShareLink(userId: string, boardId: string) {
    this.assertOwner(userId, boardId);
    const existing = this.store.one("SELECT * FROM share_links WHERE board_id=? AND owner_id=?", [boardId, userId]);
    if (existing) return existing;
    const token = randomBytes(12).toString("hex");
    this.store.run("INSERT INTO share_links VALUES(?,?,?,?)", [token, boardId, userId, now()]);
    return this.store.one("SELECT * FROM share_links WHERE token=?", [token])!;
  }

  publicByToken(token: string) {
    const row = this.store.one("SELECT * FROM share_links WHERE token=?", [token]);
    if (!row) fail("OBJECT_NOT_FOUND", 404);
    return { token: row.token, ...this.boardGraph(row.board_id) };
  }

  recordShare(boardId: string, email: string, imagePng: string, delivered: boolean, via: string, shareUrl: string) {
    const id = nid("SHR");
    this.store.run(
      "INSERT INTO shares VALUES(?,?,?,?,?,?,?,?)",
      [id, boardId, email, imagePng || "", delivered ? 1 : 0, via, now(), shareUrl],
    );
    return { id, email, delivered, via, shareUrl };
  }
}
