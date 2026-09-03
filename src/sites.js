const fs = require("node:fs/promises");
const path = require("node:path");
const mime = require("mime-types");
const { findSite, siteCurrentDir } = require("./storage");

async function serveSite(req, res, slug) {
  const site = await findSite(slug);
  if (!site) {
    res.status(404).type("html").send(siteNotFound(slug));
    return;
  }

  const root = siteCurrentDir(slug);
  const requestedPath = cleanRequestPath(req.path);
  if (!requestedPath) {
    res.status(400).send("Bad request");
    return;
  }

  let filePath;
  try {
    filePath = await resolveFile(root, requestedPath);
  } catch {
    res.status(400).send("Bad request");
    return;
  }
  if (!filePath && site.spaFallback) {
    filePath = path.join(root, "index.html");
  }

  if (!filePath) {
    res.status(404).send("Not found");
    return;
  }

  res.setHeader("Content-Type", mime.lookup(filePath) || "application/octet-stream");
  res.setHeader("Cache-Control", cacheHeader(filePath));
  res.sendFile(filePath);
}

async function resolveFile(root, requestedPath) {
  const target = safeJoin(root, requestedPath === "/" ? "index.html" : requestedPath);

  try {
    const stat = await fs.stat(target);
    if (stat.isDirectory()) {
      const indexPath = safeJoin(target, "index.html");
      return await fileExists(indexPath) ? indexPath : null;
    }
    if (stat.isFile()) return target;
  } catch {
    return null;
  }

  return null;
}

async function fileExists(filePath) {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

function cleanRequestPath(value) {
  try {
    const decoded = decodeURIComponent(value || "/");
    if (decoded.includes("\0")) return null;
    return decoded;
  } catch {
    return null;
  }
}

function safeJoin(root, requestPath) {
  const relativePath = requestPath.replace(/^\/+/, "");
  const target = path.resolve(root, relativePath);
  const safeRoot = path.resolve(root);

  if (target !== safeRoot && !target.startsWith(`${safeRoot}${path.sep}`)) {
    throw new Error("Unsafe path");
  }
  return target;
}

function cacheHeader(filePath) {
  return path.basename(filePath) === "index.html"
    ? "no-cache"
    : "public, max-age=3600";
}

function siteNotFound(slug) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Site not found</title>
  <style>
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; font-family: system-ui, sans-serif; color: #17202a; background: #f6f7f9; }
    main { width: min(92vw, 420px); }
    h1 { font-size: 1.5rem; margin: 0 0 .5rem; }
    p { margin: 0; color: #5d6875; }
  </style>
</head>
<body>
  <main>
    <h1>Site not found</h1>
    <p>No deployment exists for ${escapeHtml(slug)}.</p>
  </main>
</body>
</html>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

module.exports = { serveSite };
