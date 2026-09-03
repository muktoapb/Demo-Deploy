const test = require("node:test");
const assert = require("node:assert/strict");
const {
  dashboardPage,
  newSitePage,
  settingsPage,
  sitesPage
} = require("../src/pages");

const context = {
  sites: [{
    slug: "acme-demo",
    title: "<Acme>",
    group: "Launches",
    spaFallback: true,
    views: {
      count: 1,
      visitorHashes: ["visitor-hash"]
    },
    access: {
      paused: true,
      password: { algorithm: "scrypt", salt: "salt", key: "key" }
    },
    deployedAt: "2026-01-01T00:00:00.000Z"
  }],
  adminUser: "admin",
  baseDomain: "example.com",
  maxUploadMb: 100,
  csrfToken: "signed-form-token",
  siteUrl: (slug) => `https://${slug}.example.com`
};

test("renders the overview as its own active page", () => {
  const html = dashboardPage(context);

  assert.match(html, /<h1>Overview<\/h1>/);
  assert.match(html, /src="\/assets\/logo-generated\.png"/);
  assert.match(html, /rel="icon" href="\/assets\/logo-generated\.png"/);
  assert.match(html, /href="\/" aria-current="page"/);
  assert.match(html, /Recent deployments/);
  assert.match(html, /Unique views/);
  assert.match(html, /href="\/sites\/new"/);
});

test("renders grouped site controls safely on the sites page", () => {
  const html = sitesPage(context);

  assert.match(html, /<h1>Sites<\/h1>/);
  assert.match(html, /href="\/sites" aria-current="page"/);
  assert.match(html, /data-site-group="Launches"/);
  assert.match(html, /data-preview-dialog/);
  assert.match(html, /data-preview-size="desktop"/);
  assert.match(html, /data-preview-size="tablet"/);
  assert.match(html, /data-preview-size="mobile"/);
  assert.match(html, /sandbox="allow-scripts allow-forms allow-same-origin" data-preview-frame/);
  assert.match(html, /class="nav-icon"/);
  assert.doesNotMatch(html, /<span>Preview site<\/span>/);
  assert.match(html, /data-manage-open/);
  assert.match(html, /data-manage-dialog/);
  assert.match(html, /Site settings/);
  assert.match(html, /Single-page app fallback/);
  assert.match(html, /Replace deployment/);
  assert.match(html, /data-upload-dropzone/);
  assert.match(html, /Drag a ZIP file or website folder here/);
  assert.match(html, /Choose one \.zip file/);
  assert.match(html, /Select a folder containing index\.html/);
  assert.match(html, /Site is live/);
  assert.match(html, /Password protection/);
  assert.match(html, /data-protection-toggle/);
  assert.match(html, /status-paused/);
  assert.match(html, /mobile-brandbar/);
  assert.doesNotMatch(html, /manage-box/);
  assert.match(html, /1 view/);
  assert.match(html, /name="_csrf" value="signed-form-token"/);
  assert.match(html, /&lt;Acme&gt;/);
  assert.doesNotMatch(html, /<Acme>/);
});

test("renders deployment controls only on the new deployment page", () => {
  const html = newSitePage(context);

  assert.match(html, /<h1>New deployment<\/h1>/);
  assert.match(html, /href="\/sites\/new" aria-current="page"/);
  assert.match(html, /action="\/sites" enctype="multipart\/form-data"/);
  assert.match(html, /Choose a folder with index.html/);
  assert.match(html, /data-upload-form/);
  assert.match(html, /data-upload-dropzone/);
  assert.match(html, /Drag a ZIP file or website folder here/);
  assert.match(html, /dashboard\.css\?v=[a-f0-9]{12}/);
  assert.match(html, /dashboard\.js\?v=[a-f0-9]{12}/);
  assert.match(html, /Password protect this site/);
  assert.match(html, /name="sitePassword" type="password"/);
  assert.match(html, /data-has-password="false"/);
  assert.doesNotMatch(html, /data-preview-dialog/);
});

test("renders account and password controls on the settings page", () => {
  const html = settingsPage(context);

  assert.match(html, /<h1>Settings<\/h1>/);
  assert.match(html, /href="\/settings" aria-current="page"/);
  assert.match(html, /Change password/);
  assert.match(html, /Signed in as admin/);
  assert.match(html, /End your current dashboard session/);
  assert.match(html, /example.com/);
  assert.match(html, /100 MB per file/);
});
