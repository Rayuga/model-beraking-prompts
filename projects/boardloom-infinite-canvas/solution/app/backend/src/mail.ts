import nodemailer from "nodemailer";
import dns from "node:dns/promises";
import fs from "node:fs";
import path from "node:path";

const SKIP_LIVE = /(^|\.)(example\.com|example\.org|example\.net|localhost|board\.demo|desk\.demo)$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function skipLiveSend(to: string) {
  return SKIP_LIVE.test(String(to.split("@")[1] || ""));
}

export function validEmail(to: string) {
  return EMAIL.test(String(to || "").trim());
}

function pngBuffer(dataUrl: string) {
  const raw = String(dataUrl || "").replace(/^data:image\/\w+;base64,/, "");
  return Buffer.from(raw, "base64");
}

function fromAddress() {
  return process.env.SMTP_FROM || process.env.RESEND_FROM || "Boardloom <boardloom@localhost>";
}

function mailContent(opts: { to: string; boardName: string; shareUrl: string; pngDataUrl?: string }) {
  const attachments = opts.pngDataUrl && opts.pngDataUrl.length > 32
    ? [{ filename: "boardloom.png", content: pngBuffer(opts.pngDataUrl), contentType: "image/png" as const }]
    : [];
  return {
    from: fromAddress(),
    to: opts.to,
    subject: `${opts.boardName} — Boardloom`,
    text: `Someone shared the Boardloom board “${opts.boardName}” with you.\n\nOpen: ${opts.shareUrl}\n`,
    html: `<p>Someone shared the Boardloom board <strong>${opts.boardName}</strong> with you.</p>
<p><a href="${opts.shareUrl}">${opts.shareUrl}</a></p>`,
    attachments,
  };
}

function writeOutbox(opts: { to: string; boardName: string; shareUrl: string; pngDataUrl?: string }) {
  const outDir = process.env.BOARDLOOM_OUTBOX || path.resolve("data/outbox");
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = Date.now();
  fs.writeFileSync(path.join(outDir, `${stamp}.json`), JSON.stringify({
    to: opts.to, boardName: opts.boardName, shareUrl: opts.shareUrl, at: new Date().toISOString(),
  }, null, 2));
  if (opts.pngDataUrl && opts.pngDataUrl.length > 32) {
    fs.writeFileSync(path.join(outDir, `${stamp}.png`), pngBuffer(opts.pngDataUrl));
  }
}

async function sendResend(opts: { to: string; boardName: string; shareUrl: string; pngDataUrl?: string }) {
  const key = process.env.RESEND_API_KEY || "";
  if (!key) return null;
  const from = process.env.RESEND_FROM || process.env.SMTP_FROM || "Boardloom <onboarding@resend.dev>";
  const testTo = (process.env.RESEND_TO || "").trim().toLowerCase();
  if (/resend\.dev/i.test(from) && testTo && opts.to.trim().toLowerCase() !== testTo) return null;
  const attachments = opts.pngDataUrl && opts.pngDataUrl.length > 32
    ? [{ filename: "boardloom.png", content: pngBuffer(opts.pngDataUrl).toString("base64") }]
    : [];
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject: `${opts.boardName} — Boardloom`,
      html: `<p>Someone shared the Boardloom board <strong>${opts.boardName}</strong> with you.</p>
<p><a href="${opts.shareUrl}">${opts.shareUrl}</a></p>`,
      attachments,
    }),
  });
  if (!r.ok) throw new Error(`resend ${r.status} ${await r.text()}`);
  return { delivered: true, via: "resend" as const };
}

async function sendSmtp(opts: { to: string; boardName: string; shareUrl: string; pngDataUrl?: string }) {
  const host = process.env.SMTP_HOST || "";
  const service = process.env.SMTP_SERVICE || "";
  const user = process.env.SMTP_USER || "";
  if (!host && !service && !user) return null;
  const auth = user ? { user, pass: process.env.SMTP_PASS || "" } : undefined;
  const transport = service || (!host && user)
    ? nodemailer.createTransport({
      service: service || (user.includes("@gmail.com") ? "gmail" : undefined),
      auth,
    })
    : nodemailer.createTransport({
      host,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === "1",
      auth,
    });
  await transport.sendMail(mailContent(opts));
  return { delivered: true, via: "smtp" as const };
}

async function sendMx(opts: { to: string; boardName: string; shareUrl: string; pngDataUrl?: string }) {
  const domain = String(opts.to.split("@")[1] || "");
  if (!domain) return null;
  const mx = await dns.resolveMx(domain);
  mx.sort((a, b) => a.priority - b.priority);
  const host = mx[0]?.exchange;
  if (!host) return null;
  let last = "";
  for (const port of [587, 25]) {
    try {
      const transport = nodemailer.createTransport({
        host,
        port,
        secure: false,
        tls: { rejectUnauthorized: false },
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 12000,
      });
      await transport.sendMail({
        ...mailContent(opts),
        from: process.env.SMTP_FROM || `Boardloom <share@${domain}>`,
      });
      return { delivered: true, via: "mx" as const };
    } catch (e: any) {
      last = e?.message || String(e);
    }
  }
  throw new Error(last || "mx failed");
}

async function sendFormSubmit(opts: { to: string; boardName: string; shareUrl: string; pngDataUrl?: string }) {
  const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(opts.to)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      name: "Boardloom",
      email: opts.to,
      _subject: `${opts.boardName} — Boardloom`,
      message: `Someone shared the Boardloom board “${opts.boardName}” with you.\n\nOpen: ${opts.shareUrl}\n`,
    }),
    signal: AbortSignal.timeout(8000),
  });
  const text = await r.text();
  let body: any;
  try { body = JSON.parse(text); } catch { body = { message: text }; }
  if (!r.ok || String(body?.success) === "false") throw new Error(body?.message || `formsubmit ${r.status}`);
  return { delivered: true, via: "smtp" as const };
}

export async function sendBoardShare(opts: {
  to: string;
  boardName: string;
  shareUrl: string;
  pngDataUrl?: string;
}) {
  writeOutbox(opts);
  const errors: string[] = [];
  const attempts = skipLiveSend(opts.to)
    ? [sendResend, sendSmtp]
    : [sendResend, sendSmtp, sendMx, sendFormSubmit];
  for (const attempt of attempts) {
    try {
      const result = await attempt(opts);
      if (result) return result;
    } catch (e: any) {
      errors.push(e?.message || String(e));
    }
  }
  return { delivered: false, via: "outbox", error: errors[0] || "no mail transport configured" };
}
