const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATA_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "demo-deploy-data-"));

const { cleanUploadPath, deploySite, validateSlug } = require("../src/deploy");
const {
  findSite,
  siteCurrentDir,
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
