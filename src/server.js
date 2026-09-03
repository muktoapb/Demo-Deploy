const fs = require("node:fs/promises");
const express = require("express");
const multer = require("multer");
const { config } = require("./config");
const {
  changeAdminPassword,
  clearLoginCookie,
  createCsrfToken,
  needsPasswordChange,
  requireAuth,
  requireCsrf,
  setLoginCookie,
  verifyAdminCredentials
} = require("./auth");
const { deploySite, makeSlug } = require("./deploy");
const {
  dashboardPage,
  loginPage,
  newSitePage,
  settingsPage,
  sitesPage
} = require("./pages");
const {
  ensureStorage,
  loadSites,
  removeSite,
  siteUrl,
  updateSiteMetadata
} = require("./storage");
const { serveSite } = require("./sites");

const app = express();

app.set("trust proxy", true);
app.use(express.urlencoded({ extended: false }));

const upload = multer({
  dest: config.tmpDir,
  preservePath: true,
  limits: {
    fileSize: config.maxUploadBytes,
    files: 5000
  }
});

app.use(async (req, res, next) => {
  const subdomain = getSubdomain(req);
  if (subdomain && subdomain !== "admin") {
    try {
      await serveSite(req, res, subdomain);
    } catch (error) {
      next(error);
    }
    return;
  }
  next();
});

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src http: https:",
    "img-src 'self' data:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self'"
  ].join("; "));
  res.setHeader("Referrer-Policy", "same-origin");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  next();
});

app.use("/assets", express.static(`${config.rootDir}/public`, { immutable: false }));

app.get("/healthz", (req, res) => {
  res.json({ status: "ok" });
});

app.get("/login", (req, res) => {
  sendAdminPage(res, loginPage());
});

app.post("/login", async (req, res, next) => {
  try {
    if (!(await verifyAdminCredentials(req.body.username, req.body.password))) {
      res.status(401);
      sendAdminPage(res, loginPage({ error: "Invalid username or password." }));
      return;
    }

    setLoginCookie(res);
    res.redirect("/");
  } catch (error) {
    next(error);
  }
});

app.use(requireAuth);
app.use((req, res, next) => {
  if (req.is("multipart/form-data")) {
    next();
    return;
  }
  requireCsrf(req, res, next);
});

app.post("/logout", (req, res) => {
  clearLoginCookie(res);
  res.redirect("/login");
});

app.get("/", async (req, res, next) => {
  try {
    sendAdminPage(res, dashboardPage(await adminPageData(req)));
  } catch (error) {
    next(error);
  }
});

app.get("/sites", async (req, res, next) => {
  try {
    sendAdminPage(res, sitesPage(await adminPageData(req)));
  } catch (error) {
    next(error);
  }
});

app.get("/sites/new", async (req, res, next) => {
  try {
    sendAdminPage(res, newSitePage(await adminPageData(req)));
  } catch (error) {
    next(error);
  }
});

app.get("/settings", async (req, res, next) => {
  try {
    sendAdminPage(res, settingsPage(await adminPageData(req)));
  } catch (error) {
    next(error);
  }
});

app.post("/sites", upload.any(), requireCsrf, async (req, res) => {
  await withUploadedFiles(req.files, res, "/sites/new", async () => {
    const title = req.body.title?.trim() || "Untitled site";
    const slug = makeSlug(req.body.slug || title);
    await deploySite({
      slug,
      title,
      group: req.body.group,
      files: req.files,
      spaFallback: req.body.spaFallback === "1"
    });
    res.redirect(`/sites?ok=${encodeURIComponent(`${slug} is live.`)}`);
  });
});

app.post("/sites/:slug/redeploy", upload.any(), requireCsrf, async (req, res) => {
  await withUploadedFiles(req.files, res, "/sites", async () => {
    const sites = await loadSites();
    const site = sites.find((item) => item.slug === req.params.slug);
    if (!site) throw new Error("Site not found.");

    await deploySite({
      slug: site.slug,
      title: site.title,
      group: site.group,
      files: req.files,
      spaFallback: req.body.spaFallback === "1",
      replaceExisting: true
    });
    res.redirect(`/sites?ok=${encodeURIComponent(`${site.slug} was updated.`)}`);
  });
});

app.post("/sites/:slug/settings", async (req, res) => {
  try {
    await updateSiteMetadata(req.params.slug, {
      title: req.body.title,
      group: req.body.group,
      spaFallback: req.body.spaFallback === "1"
    });
    res.redirect(`/sites?ok=${encodeURIComponent(`${req.params.slug} settings saved.`)}`);
  } catch (error) {
    res.redirect(`/sites?error=${encodeURIComponent(error.message || "Settings update failed.")}`);
  }
});

app.post("/settings/password", async (req, res, next) => {
  try {
    await changeAdminPassword({
      currentPassword: req.body.currentPassword,
      newPassword: req.body.newPassword,
      confirmPassword: req.body.confirmPassword
    });
    setLoginCookie(res);
    res.redirect(`/settings?ok=${encodeURIComponent("Password changed.")}`);
  } catch (error) {
    res.redirect(`/settings?error=${encodeURIComponent(error.message || "Password change failed.")}`);
  }
});

app.post("/sites/:slug/delete", async (req, res, next) => {
  try {
    await removeSite(req.params.slug);
    res.redirect(`/sites?ok=${encodeURIComponent(`${req.params.slug} was deleted.`)}`);
  } catch (error) {
    next(error);
  }
});

app.use((req, res) => {
  res.status(404).send("Not found");
});

app.use(async (error, req, res, next) => {
  if (res.headersSent) {
    next(error);
    return;
  }

  await cleanupUploads(req.files || []);

  const message = error instanceof multer.MulterError
    ? uploadErrorMessage(error)
    : error.message || "Something went wrong.";

  if (error.status === 403) {
    res.status(403).send(message);
    return;
  }

  res.redirect(`${errorRedirectPath(req)}?error=${encodeURIComponent(message)}`);
});

async function withUploadedFiles(files, res, errorPath, callback) {
  try {
    await callback();
  } catch (error) {
    res.redirect(`${errorPath}?error=${encodeURIComponent(error.message || "Deployment failed.")}`);
  } finally {
    await cleanupUploads(files || []);
  }
}

async function adminPageData(req) {
  const sites = await loadSites();
  return {
    sites,
    message: req.query.ok,
    error: req.query.error,
    needsPasswordChange: await needsPasswordChange(),
    adminUser: config.adminUser,
    baseDomain: config.baseDomain,
    maxUploadMb: config.maxUploadMb,
    csrfToken: createCsrfToken(req),
    siteUrl: (slug) => siteUrl(slug, req)
  };
}

function sendAdminPage(res, html) {
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(html);
}

function errorRedirectPath(req) {
  if (req.path === "/sites") return "/sites/new";
  if (req.path.startsWith("/settings")) return "/settings";
  if (req.path.startsWith("/sites/")) return "/sites";
  return "/";
}

async function cleanupUploads(files) {
  await Promise.allSettled(files.map((file) => fs.rm(file.path, { force: true })));
}

function uploadErrorMessage(error) {
  if (error.code === "LIMIT_FILE_SIZE") {
    return `Uploads are limited to ${config.maxUploadMb} MB per file.`;
  }
  if (error.code === "LIMIT_FILE_COUNT") {
    return "Too many files in this upload.";
  }
  return error.message;
}

function getSubdomain(req) {
  const host = String(req.headers.host || "")
    .split(":")[0]
    .toLowerCase();
  const base = config.baseDomain;

  if (!host || host === base) return "";
  if (host.endsWith(`.${base}`)) {
    return host.slice(0, -(base.length + 1));
  }
  return "";
}

async function start() {
  await ensureStorage();
  app.listen(config.port, () => {
    console.log(`Demo Deploy listening on http://localhost:${config.port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { app, getSubdomain };
