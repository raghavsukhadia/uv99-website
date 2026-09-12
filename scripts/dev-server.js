/* UV99 Glazing — local dev server.
   ----------------------------------------------------------------------------
   The site is a static folder, but a few clean URLs (/QR/, /QR/hindi,
   /about.html, ...) are served through the "rewrites" in vercel.json. Plain
   static servers (VS Code Live Preview / Live Server, `python -m http.server`,
   `http-server`, ...) don't read vercel.json, so /QR/hindi 404s locally.

   This script serves the repo root with the SAME rewrite rules as production
   by reading them straight out of vercel.json — nothing to keep in sync.

       npm run dev            # http://localhost:3000
       PORT=8080 npm run dev

   Zero dependencies (Node's http/fs only). Production is unaffected: Vercel
   still applies vercel.json itself. */

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PORT = Number(process.env.PORT) || 3000;

const vercel = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
const REWRITES = (vercel.rewrites || []).map((r) => ({
  ...compile(r.source),
  destination: r.destination,
}));

/* Compile a vercel/path-to-regexp `source` into a RegExp + ordered param names.
   Supports: literal segments, :name, :name(regexp), :name* (catch-all). */
function compile(source) {
  const keys = [];
  let re = "^";
  const segments = source.split("/");
  segments.forEach((seg, i) => {
    if (i > 0) re += "/";
    if (seg === "") return;
    const m = seg.match(/^:([A-Za-z0-9_]+)(?:\(([^)]+)\))?(\*)?$/);
    if (!m) {
      re += seg.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return;
    }
    const [, name, pattern, star] = m;
    keys.push(name);
    re += star ? `(${pattern || ".*"})` : `(${pattern || "[^/]+"})`;
  });
  re += "/?$";
  return { regex: new RegExp(re), keys };
}

function applyRewrites(pathname) {
  for (const rule of REWRITES) {
    const match = rule.regex.exec(pathname);
    if (!match) continue;
    const out = rule.destination.replace(/:([A-Za-z0-9_]+)\*?/g, (_, name) => {
      const idx = rule.keys.indexOf(name);
      return idx === -1 ? "" : decodeURIComponent(match[idx + 1] || "");
    });
    return out || pathname;
  }
  return pathname;
}

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
};

function resolveFile(pathname) {
  // decode + strip query/hash (already stripped by caller, decode here)
  let rel = decodeURIComponent(pathname);
  if (rel.endsWith("/")) rel += "index.html";
  // block path traversal
  const abs = path.join(ROOT, rel);
  if (!abs.startsWith(ROOT)) return null;
  try {
    const stat = fs.statSync(abs);
    if (stat.isDirectory()) {
      const idx = path.join(abs, "index.html");
      return fs.existsSync(idx) ? idx : null;
    }
    return abs;
  } catch {
    return null;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";

  const rewritten = applyRewrites(pathname);
  let file = resolveFile(rewritten);

  // bare "/name" with no extension -> try "/name.html" (matches Vercel's
  // clean-URL behaviour for the top-level pages), re-running it through the
  // rewrites so e.g. /films -> /films.html -> /pages/films.html
  if (!file && !path.extname(rewritten)) {
    const withExt = rewritten + ".html";
    file = resolveFile(applyRewrites(withExt)) || resolveFile(withExt);
  }

  if (!file) {
    res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    res.end(`404 — no route or file for ${pathname}`);
    console.log(`404  ${pathname}`);
    return;
  }

  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, { "content-type": type, "cache-control": "no-cache" });
  fs.createReadStream(file).pipe(res);
  const shown = path.relative(ROOT, file).replace(/\\/g, "/");
  console.log(`200  ${pathname}${rewritten !== pathname ? ` -> /${shown}` : ""}`);
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log(`\nUV99 dev server  ${base}\n`);
  console.log("  /                 -> index.html");
  console.log("  /QR/              -> pages/qr.html  (English)");
  ["hindi", "kannada", "odia", "telugu", "tamil", "malayalam"].forEach((l) =>
    console.log(`  /QR/${l}${" ".repeat(13 - l.length)}-> pages/qr-${l}.html`)
  );
  console.log("\n  Ctrl+C to stop.\n");
});
