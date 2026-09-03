const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const path = require("node:path");
const mime = require("mime-types");
const { config } = require("./config");
const { verifyPassword } = require("./auth");
const { findSite, recordSiteView, siteCurrentDir } = require("./storage");

const SITE_ACCESS_COOKIE = "demo_deploy_site_access";
const SITE_ACCESS_MAX_AGE = 60 * 60 * 24 * 7;

async function serveSite(req, res, slug) {
  const site = await findSite(slug);
  if (!site) {
    res.status(404).type("html").send(siteNotFound(slug));
    return;
  }

  if (site.access?.paused) {
    res.status(503).type("html").send(sitePaused(site));
    return;
  }

  if (site.access?.password && !hasSiteAccess(req, site)) {
    await requestSiteAccess(req, res, site);
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

  if (req.method === "GET") {
    await recordSiteView(slug, req.ip);
  }

  res.setHeader("Content-Type", mime.lookup(filePath) || "application/octet-stream");
  res.setHeader("Cache-Control", cacheHeader(filePath));
  res.sendFile(filePath);
}

async function requestSiteAccess(req, res, site) {
  const isUnlockRequest = req.method === "POST" && req.path === "/__demo-deploy/unlock";
  if (isUnlockRequest && await verifyPassword(String(req.body?.password || ""), site.access.password)) {
    setSiteAccessCookie(res, site);
    res.redirect(303, "/");
    return;
  }

  const invalid = isUnlockRequest;
  res.status(401).type("html").send(sitePasswordPage(site, invalid));
}

function hasSiteAccess(req, site) {
  const token = readCookie(req.headers?.cookie || "", SITE_ACCESS_COOKIE);
  return safeEqual(token, siteAccessToken(site));
}

function setSiteAccessCookie(res, site) {
  const parts = [
    `${SITE_ACCESS_COOKIE}=${siteAccessToken(site)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${SITE_ACCESS_MAX_AGE}`
  ];
  if (config.publicProtocol === "https" && config.baseDomain !== "localhost") {
    parts.push("Secure");
  }
  res.setHeader("Set-Cookie", parts.join("; "));
}

function siteAccessToken(site) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(`site:${site.slug}:${site.access.password.key}`)
    .digest("base64url");
}

function readCookie(header, name) {
  const cookies = String(header).split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function safeEqual(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
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

function sitePaused(site) {
  return accessPage({
    title: "Site paused",
    heading: "This demo is paused",
    message: `${site.title || site.slug} is not available right now. Contact the site owner for access.`
  });
}

function sitePasswordPage(site, invalid) {
  return accessPage({
    title: `Open ${site.title || site.slug}`,
    heading: "This demo is protected",
    message: "Enter the password shared by the site owner to continue.",
    form: `
      ${invalid ? `<p class="error" role="alert">That password is not correct.</p>` : ""}
      <form method="post" action="/__demo-deploy/unlock">
        <label><span>Password</span><input name="password" type="password" autocomplete="current-password" required autofocus></label>
        <button type="submit">Open demo</button>
      </form>`
  });
}

function accessPage({ title, heading, message, form = "" }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 1rem; color: #14201c; background: #f3f6f5; font-family: Inter, ui-sans-serif, system-ui, sans-serif; }
    main { width: min(100%, 390px); padding: 1.5rem; border: 1px solid #d9e2de; border-radius: 8px; background: #fff; box-shadow: 0 18px 45px rgba(18,31,26,.1); }
    .mark { width: 2.6rem; height: 2.6rem; display: grid; place-items: center; margin-bottom: 1.2rem; border-radius: 7px; color: #096047; background: #dff3eb; font-weight: 850; }
    h1 { margin: 0; font-size: 1.35rem; }
    p { margin: .45rem 0 0; color: #68756f; font-size: .88rem; }
    form { display: grid; gap: .85rem; margin-top: 1.25rem; }
    label { display: grid; gap: .35rem; font-size: .78rem; font-weight: 700; }
    input { width: 100%; min-height: 2.8rem; padding: .7rem .75rem; border: 1px solid #c5d0cb; border-radius: 6px; font: inherit; }
    input:focus { border-color: #0f7a5f; outline: 3px solid rgba(15,122,95,.14); }
    button { min-height: 2.75rem; border: 0; border-radius: 6px; color: #fff; background: #0f7a5f; font: inherit; font-weight: 750; cursor: pointer; }
    button:hover { background: #096047; }
    .error { padding: .65rem .75rem; border: 1px solid #f3c6cc; border-radius: 6px; color: #b42334; background: #fff0f2; font-size: .78rem; font-weight: 650; }
  </style>
</head>
<body>
  <main>
    <div class="mark" aria-hidden="true">D</div>
    <h1>${escapeHtml(heading)}</h1>
    <p>${escapeHtml(message)}</p>
    ${form}
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
