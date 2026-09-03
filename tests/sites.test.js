const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATA_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "demo-deploy-sites-"));

const { serveSite } = require("../src/sites");
const {
  findSite,
  siteCurrentDir,
  siteViewCount,
  updateSiteMetadata,
  upsertSite
} = require("../src/storage");

test("serving a site records only one view for each IP", async () => {
  await upsertSite({
    slug: "served-demo",
    title: "Served Demo",
    group: "",
    spaFallback: false
  });
  await fs.mkdir(siteCurrentDir("served-demo"), { recursive: true });
  await fs.writeFile(path.join(siteCurrentDir("served-demo"), "index.html"), "<h1>Hello</h1>");

  await serveSite(request("198.51.100.20"), response(), "served-demo");
  await serveSite(request("198.51.100.20"), response(), "served-demo");
  await serveSite(request("198.51.100.21"), response(), "served-demo");

  assert.equal(siteViewCount(await findSite("served-demo")), 2);
});

test("paused sites do not serve uploaded files", async () => {
  await createSite("paused-demo");
  await updateSiteMetadata("paused-demo", siteSettings({ paused: true }));

  const res = response();
  await serveSite(request("198.51.100.30"), res, "paused-demo");

  assert.equal(res.statusCode, 503);
  assert.match(res.body, /This demo is paused/);
  assert.equal(res.filePath, undefined);
});

test("password-protected sites unlock with a signed cookie", async () => {
  await createSite("protected-demo");
  await updateSiteMetadata("protected-demo", siteSettings({
    passwordProtected: true,
    sitePassword: "client-access"
  }));

  const locked = response();
  await serveSite(request("198.51.100.40"), locked, "protected-demo");
  assert.equal(locked.statusCode, 401);
  assert.match(locked.body, /This demo is protected/);

  const rejected = response();
  await serveSite(request("198.51.100.40", {
    method: "POST",
    path: "/__demo-deploy/unlock",
    body: { password: "wrong-password" }
  }), rejected, "protected-demo");
  assert.equal(rejected.statusCode, 401);
  assert.match(rejected.body, /not correct/);

  const unlocked = response();
  await serveSite(request("198.51.100.40", {
    method: "POST",
    path: "/__demo-deploy/unlock",
    body: { password: "client-access" }
  }), unlocked, "protected-demo");
  assert.equal(unlocked.statusCode, 303);
  assert.equal(unlocked.redirectPath, "/");
  assert.match(unlocked.headers["Set-Cookie"], /HttpOnly/);

  const cookie = unlocked.headers["Set-Cookie"].split(";")[0];
  const served = response();
  await serveSite(request("198.51.100.40", { headers: { cookie } }), served, "protected-demo");
  assert.match(served.filePath, /protected-demo\/current\/index\.html$/);
});

async function createSite(slug) {
  await upsertSite({ slug, title: slug, group: "", spaFallback: false });
  await fs.mkdir(siteCurrentDir(slug), { recursive: true });
  await fs.writeFile(path.join(siteCurrentDir(slug), "index.html"), "<h1>Hello</h1>");
}

function siteSettings(overrides = {}) {
  return {
    title: "Demo",
    group: "",
    spaFallback: false,
    paused: false,
    passwordProtected: false,
    sitePassword: "",
    ...overrides
  };
}

function request(ip, overrides = {}) {
  return {
    method: "GET",
    path: "/",
    ip,
    headers: {},
    body: {},
    ...overrides
  };
}

function response() {
  return {
    headers: {},
    setHeader(name, value) {
      this.headers[name] = value;
    },
    sendFile(filePath) {
      this.filePath = filePath;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    type(value) {
      this.contentType = value;
      return this;
    },
    send(value) {
      this.body = value;
      return this;
    },
    redirect(status, redirectPath) {
      this.statusCode = status;
      this.redirectPath = redirectPath;
    }
  };
}
