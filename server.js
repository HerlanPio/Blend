"use strict";

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { handler } = require("./netlify/functions/api");

const ROOT = __dirname;
const PORT = Number(process.env.PORT || 5173);
const MAX_API_BODY = 7 * 1024 * 1024;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".ico": "image/x-icon"
};

function loadLocalEnvironment() {
  const envPath = path.join(ROOT, ".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const entry = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!entry || entry[1] in process.env) continue;
    process.env[entry[1]] = entry[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

function sendApiResponse(response, result) {
  response.writeHead(result.statusCode, result.headers);
  response.end(result.body);
}

async function handleApi(request, response, url) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_API_BODY) {
      response.writeHead(413, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "Request body is too large." }));
      return;
    }
    chunks.push(chunk);
  }

  const result = await handler({
    httpMethod: request.method,
    headers: request.headers,
    queryStringParameters: Object.fromEntries(url.searchParams.entries()),
    body: chunks.length ? Buffer.concat(chunks).toString("utf8") : null
  });
  sendApiResponse(response, result);
}

loadLocalEnvironment();

http.createServer(async (request, response) => {
  let pathname;
  let url;
  try {
    url = new URL(request.url, "http://localhost");
    pathname = decodeURIComponent(url.pathname);
  } catch {
    response.writeHead(400).end("Bad request");
    return;
  }
  if (pathname === "/api") {
    try {
      await handleApi(request, response, url);
    } catch (error) {
      console.error("Could not handle API request:", error);
      if (!response.headersSent) response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ error: "The backend could not complete this request." }));
    }
    return;
  }
  const requestedPath = pathname === "/" ? "index.html" : pathname.replace(/^[/\\]+/, "");
  if (requestedPath.split(/[\\/]/).some(segment => segment.startsWith("."))) {
    response.writeHead(404).end("404 Not Found");
    return;
  }
  const filePath = path.resolve(ROOT, requestedPath);
  if (filePath !== ROOT && !filePath.startsWith(`${ROOT}${path.sep}`)) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, contents) => {
    if (error) {
      response.writeHead(error.code === "ENOENT" ? 404 : 500, { "Content-Type": "text/plain; charset=utf-8" });
      response.end(error.code === "ENOENT" ? "404 Not Found" : "Could not read requested file");
      if (error.code !== "ENOENT") console.error(`Could not read ${filePath}:`, error);
      return;
    }
    response.writeHead(200, {
      "Content-Type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff"
    });
    response.end(contents);
  });
}).listen(PORT, "0.0.0.0", () => {
  console.log(`\n  Blend running at http://localhost:${PORT}\n  API endpoint: http://localhost:${PORT}/api\n  Open from a phone on the same Wi-Fi using this computer's local IP.\n  Ctrl+C to stop\n`);
});
