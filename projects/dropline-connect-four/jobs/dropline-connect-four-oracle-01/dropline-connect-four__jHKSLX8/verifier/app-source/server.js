import express from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

function readSeed() {
  const candidates = [
    process.env.SEED_PATH,
    "/assets/dropline_seed.json",
    path.join(root, "dropline_seed.json"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(fs.readFileSync(candidate, "utf8"));
      if (parsed.rows === 6 && parsed.columns === 7 && parsed.storageKey === "dropline:v1") {
        return parsed;
      }
    } catch {
      // Try the next seed location.
    }
  }
  throw new Error("DropLine seed data is unavailable");
}

const seed = readSeed();
const app = express();

app.disable("x-powered-by");
app.get("/health", (_request, response) => response.json({ ok: true }));
app.get("/api/config", (_request, response) => response.json(seed));
app.use(express.static(path.join(root, "public"), { extensions: ["html"] }));
app.get("/{*path}", (_request, response) => {
  response.sendFile(path.join(root, "public", "index.html"));
});

app.listen(port, host, () => {
  console.log(`DropLine listening on http://${host}:${port}`);
});
