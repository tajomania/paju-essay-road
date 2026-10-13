import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import worker from "../src/worker.js";
import { openDatabase } from "./database.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function addresses(port, protocol) {
  const values = [];
  for (const [name, items] of Object.entries(os.networkInterfaces()))
    for (const a of items || [])
      if (
        a.family === "IPv4" &&
        !a.internal &&
        /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address) &&
        !/vEthernet|virtual|vmware/i.test(name)
      )
        values.push({ label: name, url: `${protocol}://${a.address}:${port}` });
  return values;
}
export function createLocalServer({
  dataDir,
  port = 8788,
  host = "0.0.0.0",
  tlsCert,
  tlsKey,
} = {}) {
  dataDir = path.resolve(
    dataDir ||
      process.env.LOCAL_DATA_DIR ||
      path.join(process.env.LOCALAPPDATA || os.homedir(), "PajuEssayRoad"),
  );
  fs.mkdirSync(dataDir, { recursive: true });
  const secretFile = path.join(dataDir, "encryption.key");
  if (!fs.existsSync(secretFile))
    fs.writeFileSync(secretFile, randomBytes(32).toString("base64"), {
      mode: 0o600,
      flag: "wx",
    });
  const DB = openDatabase(
    path.join(dataDir, "essay.sqlite"),
    path.join(root, "migrations"),
  );
  const protocol = tlsCert && tlsKey ? "https" : "http";
  const localAddresses = addresses(port, protocol);
  const allowed = new Set([
    "localhost",
    "127.0.0.1",
    "[::1]",
    ...localAddresses.map((a) => new URL(a.url).hostname),
    ...(process.env.LOCAL_ALLOWED_HOSTS || "").split(",").filter(Boolean),
  ]);
  const publicDir = path.join(root, "public");
  const env = {
    DB,
    AI_ENABLED: "true",
    LOCAL_MODE: true,
    AI_KEY_ENCRYPTION_SECRET: fs.readFileSync(secretFile, "utf8"),
    LOCAL_ADDRESSES: localAddresses,
    LOCAL_BASE_URL: localAddresses[0]?.url || `${protocol}://localhost:${port}`,
    CLASS_AI_DAILY_LIMIT: "150",
    AI_DAILY_LIMIT: "1000",
    ASSETS: {
      async fetch(request) {
        if (!["GET", "HEAD"].includes(request.method))
          return new Response("Method not allowed", { status: 405 });
        let pathname;
        try {
          pathname = decodeURIComponent(new URL(request.url).pathname);
        } catch {
          return new Response("Invalid path", { status: 400 });
        }
        const filename = path.resolve(
          publicDir,
          "." + (pathname === "/" ? "/index.html" : pathname),
        );
        if (
          !filename.startsWith(publicDir + path.sep) ||
          !fs.existsSync(filename) ||
          !fs.statSync(filename).isFile()
        )
          return new Response("Not found", { status: 404 });
        const type =
          {
            ".html": "text/html; charset=utf-8",
            ".js": "text/javascript; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".svg": "image/svg+xml",
            ".json": "application/json",
            ".txt": "text/plain",
          }[path.extname(filename)] || "application/octet-stream";
        return new Response(
          request.method === "HEAD" ? null : fs.readFileSync(filename),
          { headers: { "Content-Type": type } },
        );
      },
    },
  };
  async function handler(req, res) {
    try {
      const url = new URL(
        `${protocol}://${req.headers.host || "localhost"}` + req.url,
      );
      if (!allowed.has(url.hostname)) {
        res.writeHead(403);
        res.end("Host not allowed");
        return;
      }
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > 8500000) {
          res.writeHead(413);
          res.end("Request too large");
          return;
        }
        chunks.push(chunk);
      }
      const remote = req.socket.remoteAddress || "";
      const loopback = ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(
        remote,
      );
      const headers = new Headers();
      for (const [name, value] of Object.entries(req.headers))
        if (value)
          headers.set(name, Array.isArray(value) ? value.join(",") : value);
      headers.set("CF-Connecting-IP", remote);
      const request = new Request(url, {
        method: req.method,
        headers,
        body: ["GET", "HEAD"].includes(req.method)
          ? undefined
          : Buffer.concat(chunks),
      });
      const response = await worker.fetch(request, {
        ...env,
        LOCAL_IS_LOOPBACK: loopback,
      });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "로컬 서버 처리에 실패했습니다." }));
    }
  }
  const server =
    protocol === "https"
      ? https.createServer(
          { cert: fs.readFileSync(tlsCert), key: fs.readFileSync(tlsKey) },
          handler,
        )
      : http.createServer(handler);
  server.on("close", () => DB.close());
  return {
    server,
    env,
    dataDir,
    start() {
      return new Promise((resolve, reject) => {
        server.once("error", reject);
        server.listen(port, host, () => {
          const actualPort = server.address().port;
          env.LOCAL_ADDRESSES = addresses(actualPort, protocol);
          env.LOCAL_BASE_URL =
            env.LOCAL_ADDRESSES[0]?.url ||
            `${protocol}://localhost:${actualPort}`;
          resolve(server.address());
        });
      });
    },
  };
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.LOCAL_PORT || 8788);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error("Invalid LOCAL_PORT");
  const app = createLocalServer({
    port,
    tlsCert: process.env.LOCAL_TLS_CERT,
    tlsKey: process.env.LOCAL_TLS_KEY,
  });
  await app.start();
  fs.writeFileSync(path.join(app.dataDir, "server.pid"), String(process.pid));
  console.log(
    `Teacher: http://localhost:${port}\nStudents: ${app.env.LOCAL_BASE_URL}`,
  );
  const shutdown = () => app.server.close(() => process.exit(0));
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
