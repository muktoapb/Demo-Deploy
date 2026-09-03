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
  assert.match(html, /href="\/" aria-current="page"/);
  assert.match(html, /Recent deployments/);
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
  assert.match(html, /class="nav-icon"/);
  assert.match(html, /<span>Preview site<\/span>/);
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
