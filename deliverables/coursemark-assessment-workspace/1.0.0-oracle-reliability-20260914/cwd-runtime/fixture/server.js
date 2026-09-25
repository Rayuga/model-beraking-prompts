const http = require("node:http");
const fs = require("node:fs");
const seed = JSON.parse(fs.readFileSync("seed_data.json", "utf8"));
const database = process.env.DB_PATH;
const previous = fs.existsSync(database) ? JSON.parse(fs.readFileSync(database, "utf8")) : { launches: 0 };
const state = { launches: previous.launches + 1, seed: seed.marker };
fs.writeFileSync(database, JSON.stringify(state));
http.createServer((request, response) => {
  if (request.url === "/api/health") {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify({ healthy: true, cwd: process.cwd(), ...state }));
  } else if (request.url === "/") {
    response.setHeader("content-type", "text/html");
    response.end(fs.readFileSync("public/index.html", "utf8"));
  } else {
    response.writeHead(404).end("Missing route");
  }
}).listen(Number(process.env.PORT || 3000), "0.0.0.0");
