const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATA_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "demo-deploy-data-"));

const yauzl = require("yauzl");
const { cleanUploadPath, createSiteArchive, deploySite, validateSlug } = require("../src/deploy");
const { verifyPassword } = require("../src/auth");
const {
  findSite,
  recordSiteView,
  siteCurrentDir,
  siteVisitCount,
  siteViewCount,
  updateSiteMetadata,
  upsertSite
} = require("../src/storage");

test("validates slugs used for subdomains", () => {
  assert.equal(validateSlug("client-demo"), true);
  assert.equal(validateSlug("admin"), false);
  assert.equal(validateSlug("-bad"), false);
  assert.equal(validateSlug("bad.name"), false);
});

test("rejects unsafe upload paths", () => {
  assert.equal(cleanUploadPath("demo/index.html"), "demo/index.html");
  assert.equal(cleanUploadPath("../index.html"), null);
  assert.equal(cleanUploadPath("/index.html"), null);
  assert.equal(cleanUploadPath("demo/.git/config"), null);
});

test("deploys a browser folder upload and promotes one root folder", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "demo-deploy-test-"));
  const filePath = path.join(tmp, "upload-index");
  await fs.writeFile(filePath, "<h1>Hello</h1>");

  await deploySite({
    slug: "folder-demo",
    title: "Folder Demo",
    group: "Acme",
    spaFallback: true,
    passwordProtected: true,
    sitePassword: "client-access",
    files: [
      {
        fieldname: "files",
        originalname: "client-site/index.html",
        path: filePath,
        size: 14
      }
    ]
  });

  const site = await findSite("folder-demo");
  const html = await fs.readFile(path.join(siteCurrentDir("folder-demo"), "index.html"), "utf8");

  assert.equal(site.title, "Folder Demo");
  assert.equal(site.group, "Acme");
  assert.equal(site.spaFallback, true);
  assert.equal(await verifyPassword("client-access", site.access.password), true);
  assert.equal(JSON.stringify(site).includes("client-access"), false);
  assert.equal(html, "<h1>Hello</h1>");

  await assert.rejects(
    deploySite({
      slug: "folder-demo",
      title: "Accidental overwrite",
      files: [{
        fieldname: "files",
        originalname: "index.html",
        path: filePath,
        size: 14
      }]
    }),
    /already exists/
  );
});

test("updates site details without replacing deployment metadata", async () => {
  await upsertSite({
    slug: "metadata-demo",
    title: "Original title",
    group: "",
    spaFallback: false,
    deployedAt: "2026-01-01T00:00:00.000Z"
  });

  const updated = await updateSiteMetadata("metadata-demo", {
    title: "Client launch",
    group: "Northwind",
    spaFallback: true
  });

  assert.equal(updated.title, "Client launch");
  assert.equal(updated.group, "Northwind");
  assert.equal(updated.spaFallback, true);
  assert.equal(updated.deployedAt, "2026-01-01T00:00:00.000Z");
});

test("stores site access controls without persisting the visitor password", async () => {
  await upsertSite({
    slug: "private-demo",
    title: "Private demo",
    group: "",
    spaFallback: false
  });

  const protectedSite = await updateSiteMetadata("private-demo", {
    title: "Private demo",
    group: "Client",
    spaFallback: false,
    paused: true,
    passwordProtected: true,
    sitePassword: "client-access"
  });

  assert.equal(protectedSite.access.paused, true);
  assert.equal(await verifyPassword("client-access", protectedSite.access.password), true);
  assert.equal(JSON.stringify(protectedSite).includes("client-access"), false);

  const retainedPassword = await updateSiteMetadata("private-demo", {
    title: "Private demo",
    group: "Client",
    spaFallback: false,
    paused: false,
    passwordProtected: true,
    sitePassword: ""
  });
  assert.equal(retainedPassword.access.password.key, protectedSite.access.password.key);
});

test("records one unique view per site IP", async () => {
  await upsertSite({
    slug: "view-demo",
    title: "View Demo",
    group: "",
    spaFallback: false
  });

  assert.equal(await recordSiteView("view-demo", "203.0.113.10"), true);
  assert.equal(await recordSiteView("view-demo", "203.0.113.10", {
    path: "/pricing",
    referrer: "https://example.net/source"
  }), false);
  assert.equal(await recordSiteView("view-demo", "203.0.113.11", {
    path: "/pricing",
    referrer: ""
  }), true);

  const site = await findSite("view-demo");
  assert.equal(siteViewCount(site), 2);
  assert.equal(siteVisitCount(site), 3);
  assert.equal(site.views.visitorHashes.length, 2);
  assert.equal(site.views.visitorHashes.includes("203.0.113.10"), false);
  assert.deepEqual(site.views.paths, [{ name: "/pricing", count: 2 }, { name: "/", count: 1 }]);
  assert.deepEqual(site.views.referrers, [{ name: "Direct", count: 2 }, { name: "example.net", count: 1 }]);
  assert.equal(site.views.daily.length, 1);
});

test("creates a downloadable ZIP archive of an existing site", async () => {
  const tmp = await fs.mkdtemp(path.join(os.tmpdir(), "demo-deploy-zip-"));
  const indexPath = path.join(tmp, "index-file");
  const stylePath = path.join(tmp, "style-file");
  await fs.writeFile(indexPath, "<h1>Archive me</h1>");
  await fs.writeFile(stylePath, "body{color:red}");

  await deploySite({
    slug: "zip-demo",
    title: "Zip Demo",
    files: [
      { fieldname: "files", originalname: "index.html", path: indexPath, size: 19 },
      { fieldname: "files", originalname: "assets/style.css", path: stylePath, size: 15 }
    ]
  });

  const entries = await readZipEntries(await streamToBuffer(await createSiteArchive("zip-demo")));

  assert.deepEqual(Object.keys(entries).sort(), ["assets/style.css", "index.html"]);
  assert.equal(entries["index.html"], "<h1>Archive me</h1>");
  assert.equal(entries["assets/style.css"], "body{color:red}");

  await assert.rejects(createSiteArchive("missing-site"), /no files to download/);
});

test("rejects invalid persisted site metadata", async () => {
  await assert.rejects(
    upsertSite({
      slug: "bad-metadata",
      title: "x".repeat(121),
      group: "",
      spaFallback: false
    }),
    /120 characters/
  );
});

function streamToBuffer(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.once("end", () => resolve(Buffer.concat(chunks)));
    stream.once("error", reject);
  });
}

function readZipEntries(buffer) {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(buffer, { lazyEntries: true }, (error, zipFile) => {
      if (error) return reject(error);

      const entries = {};
      zipFile.readEntry();
      zipFile.on("entry", (entry) => {
        zipFile.openReadStream(entry, async (streamError, readStream) => {
          if (streamError) return reject(streamError);
          entries[entry.fileName] = (await streamToBuffer(readStream)).toString("utf8");
          zipFile.readEntry();
        });
      });
      zipFile.once("end", () => resolve(entries));
      zipFile.once("error", reject);
    });
  });
}
