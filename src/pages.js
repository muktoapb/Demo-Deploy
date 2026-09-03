function loginPage({ error = "" } = {}) {
  return layout({
    title: "Sign in | Demo Deploy",
    bodyClass: "login-body",
    body: `
      <main class="login-shell">
        <form class="login-panel" method="post" action="/login">
          <div class="brand-lockup login-brand">
            <span class="brand-mark" aria-hidden="true">D</span>
            <span>Demo Deploy</span>
          </div>
          <div class="login-heading">
            <h1>Welcome back</h1>
            <p>Your self-hosted static deployment workspace.</p>
          </div>
          ${error ? `<p class="alert" role="alert">${escapeHtml(error)}</p>` : ""}
          <label>
            <span>Username</span>
            <input name="username" autocomplete="username" required autofocus>
          </label>
          <label>
            <span>Password</span>
            <input name="password" type="password" autocomplete="current-password" required>
          </label>
          <button class="button button-primary button-full" type="submit">Sign in</button>
        </form>
      </main>`
  });
}

function dashboardPage(options) {
  const { sites, siteUrl } = options;
  const groups = uniqueGroups(sites);
  const recentSites = [...sites]
    .sort((a, b) => siteTimestamp(b) - siteTimestamp(a))
    .slice(0, 5);
  const latestSite = recentSites[0];

  return appPage({
    ...options,
    activePage: "overview",
    pageTitle: "Overview",
    overline: "Workspace",
    action: `<a class="button button-primary" href="/sites/new">Deploy site</a>`,
    content: `
      <section class="summary-grid" aria-label="Deployment summary">
        <article class="metric">
          <span>Live sites</span>
          <strong>${sites.length}</strong>
        </article>
        <article class="metric">
          <span>Client groups</span>
          <strong>${groups.length}</strong>
        </article>
        <article class="metric metric-wide">
          <span>Last published</span>
          <strong>${latestSite ? escapeHtml(latestSite.title || latestSite.slug) : "No deployments"}</strong>
          <small>${latestSite ? formatDate(latestSite.deployedAt || latestSite.updatedAt) : ""}</small>
        </article>
      </section>

      <section class="workspace-section">
        <div class="section-heading">
          <div>
            <p class="overline">Activity</p>
            <h2>Recent deployments</h2>
          </div>
          ${sites.length ? `<a class="section-link" href="/sites">View all sites</a>` : ""}
        </div>
        ${recentSites.length ? recentList(recentSites, siteUrl) : overviewEmptyState()}
      </section>

      <section class="workspace-section quick-actions">
        <div class="section-heading">
          <div>
            <p class="overline">Shortcuts</p>
            <h2>Quick actions</h2>
          </div>
        </div>
        <div class="action-grid">
          <a href="/sites/new"><strong>Deploy a site</strong><span>Upload a ZIP archive or website folder.</span></a>
          <a href="/sites"><strong>Manage sites</strong><span>Preview, organize, update, or remove deployments.</span></a>
          <a href="/settings"><strong>Account settings</strong><span>Review server details and update your password.</span></a>
        </div>
      </section>`
  });
}

function sitesPage(options) {
  const { sites, siteUrl, csrfToken = "" } = options;
  const groups = uniqueGroups(sites);

  return appPage({
    ...options,
    activePage: "sites",
    pageTitle: "Sites",
    overline: "Deployments",
    action: `<a class="button button-primary" href="/sites/new">New deployment</a>`,
    content: `
      <section class="workspace-section page-section">
        <div class="section-heading">
          <div>
            <h2>All sites</h2>
            <p class="section-description">Organized by client or project group.</p>
          </div>
          <span class="section-count"><b data-visible-count>${sites.length}</b> of ${sites.length}</span>
        </div>

        ${sites.length ? `
          <div class="site-toolbar">
            <label class="search-field">
              <span class="sr-only">Search sites</span>
              <input type="search" placeholder="Search sites or subdomains" data-site-search>
            </label>
            <label>
              <span class="sr-only">Filter by client group</span>
              <select data-group-filter>
                <option value="">All groups</option>
                ${groups.map((group) => `<option value="${escapeHtml(group)}">${escapeHtml(group)}</option>`).join("")}
                ${sites.some((site) => !site.group) ? `<option value="__ungrouped">Ungrouped</option>` : ""}
              </select>
            </label>
          </div>
          <datalist id="group-options">
            ${groups.map((group) => `<option value="${escapeHtml(group)}"></option>`).join("")}
          </datalist>
          <div class="site-groups">
            ${siteGroups(sites, siteUrl, groups, csrfToken)}
          </div>
          <div class="empty empty-filter" data-filter-empty hidden>
            <h3>No matching sites</h3>
            <p>Try another search or group.</p>
          </div>` : sitesEmptyState()}
      </section>
      ${previewDialog()}`
  });
}

function newSitePage(options) {
  const { sites, baseDomain, csrfToken = "" } = options;
  const groups = uniqueGroups(sites);

  return appPage({
    ...options,
    activePage: "new-site",
    pageTitle: "New deployment",
    overline: "Publish",
    content: `
      <section class="workspace-section page-section narrow-section">
        <div class="section-heading">
          <div>
            <h2>Upload a static site</h2>
            <p class="section-description">The upload must contain an index.html file.</p>
          </div>
        </div>
        <form class="form-surface upload-form" method="post" action="/sites" enctype="multipart/form-data" data-deploy-form>
          ${csrfField(csrfToken)}
          <div class="form-grid form-grid-three">
            <label>
              <span>Site name</span>
              <input name="title" placeholder="Acme homepage" maxlength="120" data-site-title required>
            </label>
            <label>
              <span>Subdomain</span>
              <div class="domain-input">
                <input name="slug" placeholder="acme-homepage" maxlength="63" data-site-slug required>
                <span>.${escapeHtml(baseDomain)}</span>
              </div>
            </label>
            <label>
              <span>Client / group</span>
              <input name="group" placeholder="Acme" list="group-options" maxlength="60">
            </label>
          </div>
          <datalist id="group-options">
            ${groups.map((group) => `<option value="${escapeHtml(group)}"></option>`).join("")}
          </datalist>
          <div class="upload-grid">
            <label class="file-choice">
              <span class="file-choice-title">ZIP archive</span>
              <span class="file-choice-value">Choose one .zip file</span>
              <input name="archive" type="file" accept=".zip,application/zip">
            </label>
            <span class="upload-or">or</span>
            <label class="file-choice">
              <span class="file-choice-title">Website folder</span>
              <span class="file-choice-value">Choose a folder with index.html</span>
              <input name="files" type="file" webkitdirectory directory multiple>
            </label>
          </div>
          <div class="form-footer">
            <label class="check-row">
              <input name="spaFallback" type="checkbox" value="1" checked>
              <span>Use index.html for app routes</span>
            </label>
            <button class="button button-primary" type="submit" data-deploy-button>Deploy site</button>
          </div>
        </form>
      </section>`
  });
}

function settingsPage(options) {
  const {
    adminUser,
    baseDomain,
    maxUploadMb,
    csrfToken = ""
  } = options;

  return appPage({
    ...options,
    activePage: "settings",
    pageTitle: "Settings",
    overline: "Account",
    content: `
      <section class="workspace-section page-section">
        <div class="settings-layout">
          <div class="settings-summary">
            <p class="overline">Server</p>
            <h2>Installation details</h2>
            <dl>
              <div><dt>Username</dt><dd>${escapeHtml(adminUser)}</dd></div>
              <div><dt>Base domain</dt><dd>${escapeHtml(baseDomain)}</dd></div>
              <div><dt>Upload limit</dt><dd>${maxUploadMb} MB per file</dd></div>
              <div><dt>Storage</dt><dd>Persistent local volume</dd></div>
            </dl>
          </div>
          <form class="form-surface settings-form" method="post" action="/settings/password">
            ${csrfField(csrfToken)}
            <div>
              <p class="overline">Security</p>
              <h2>Change password</h2>
              <p>Use at least 12 characters.</p>
            </div>
            <label>
              <span>Current password</span>
              <input name="currentPassword" type="password" autocomplete="current-password" required>
            </label>
            <div class="form-grid">
              <label>
                <span>New password</span>
                <input name="newPassword" type="password" autocomplete="new-password" minlength="12" required>
              </label>
              <label>
                <span>Confirm new password</span>
                <input name="confirmPassword" type="password" autocomplete="new-password" minlength="12" required>
              </label>
            </div>
            <button class="button button-secondary" type="submit">Update password</button>
          </form>
        </div>
        <div class="settings-session">
          <div>
            <p class="overline">Session</p>
            <h2>Signed in as ${escapeHtml(adminUser)}</h2>
            <p>End your current dashboard session on this device.</p>
          </div>
          <form method="post" action="/logout">
            ${csrfField(csrfToken)}
            <button class="button button-secondary" type="submit">Sign out</button>
          </form>
        </div>
      </section>`
  });
}

function appPage({
  activePage,
  pageTitle,
  overline,
  action = "",
  content,
  sites = [],
  message = "",
  error = "",
  needsPasswordChange = false,
  adminUser,
  csrfToken = ""
}) {
  return layout({
    title: `${pageTitle} | Demo Deploy`,
    bodyClass: "app-body",
    script: true,
    body: `
      <div class="app-shell">
        <aside class="sidebar">
          <a class="brand-lockup" href="/" aria-label="Demo Deploy overview">
            <span class="brand-mark" aria-hidden="true">D</span>
            <span>Demo Deploy</span>
          </a>

          <nav class="main-nav" aria-label="Dashboard navigation">
            ${navLink("/", "Overview", activePage === "overview")}
            ${navLink("/sites", "Sites", activePage === "sites", { count: sites.length })}
            ${navLink("/sites/new", "New deployment", activePage === "new-site", { mobileLabel: "Deploy" })}
            ${navLink("/settings", "Settings", activePage === "settings")}
          </nav>

          <div class="sidebar-account">
            <span class="avatar" aria-hidden="true">${escapeHtml(adminUser.charAt(0).toUpperCase())}</span>
            <div>
              <strong>${escapeHtml(adminUser)}</strong>
              <span>Administrator</span>
            </div>
            <form method="post" action="/logout">
              ${csrfField(csrfToken)}
              <button class="text-button" type="submit">Sign out</button>
            </form>
          </div>
        </aside>

        <main class="main-content">
          <header class="page-header">
            <div>
              <p class="overline">${escapeHtml(overline)}</p>
              <h1>${escapeHtml(pageTitle)}</h1>
            </div>
            ${action}
          </header>

          <div class="notice-stack" aria-live="polite">
            ${needsPasswordChange ? `<p class="warning">Change the default password in <a href="/settings">Settings</a> before publishing this dashboard.</p>` : ""}
            ${message ? `<p class="success">${escapeHtml(message)}</p>` : ""}
            ${error ? `<p class="alert" role="alert">${escapeHtml(error)}</p>` : ""}
          </div>

          ${content}
        </main>
      </div>`
  });
}

function navLink(href, label, active, { count, mobileLabel = label } = {}) {
  return `
    <a href="${href}"${active ? ` aria-current="page"` : ""}>
      <span class="nav-label">
        <span class="nav-full">${escapeHtml(label)}</span>
        <span class="nav-short">${escapeHtml(mobileLabel)}</span>
      </span>
      ${Number.isInteger(count) ? `<span class="nav-count">${count}</span>` : ""}
    </a>`;
}

function recentList(sites, siteUrl) {
  return `
    <div class="recent-list">
      ${sites.map((site) => {
        const url = siteUrl(site.slug);
        return `
          <article class="recent-row">
            <span class="recent-mark" aria-hidden="true">${escapeHtml((site.title || site.slug).charAt(0).toUpperCase())}</span>
            <div>
              <h3>${escapeHtml(site.title || site.slug)}</h3>
              <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(urlLabel(url))}</a>
            </div>
            <span>${escapeHtml(site.group || "Ungrouped")}</span>
            <time datetime="${escapeHtml(site.deployedAt || site.updatedAt || site.createdAt || "")}">
              ${formatDate(site.deployedAt || site.updatedAt || site.createdAt)}
            </time>
            <a class="button button-quiet" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open</a>
          </article>`;
      }).join("")}
    </div>`;
}

function siteGroups(sites, siteUrl, groups, csrfToken) {
  const orderedGroups = [
    ...groups,
    ...(sites.some((site) => !site.group) ? [""] : [])
  ];

  return orderedGroups.map((group) => {
    const groupedSites = sites.filter((site) => (site.group || "") === group);
    const groupKey = group || "__ungrouped";
    return `
      <section class="site-group" data-site-group="${escapeHtml(groupKey)}">
        <div class="group-heading">
          <h3>${escapeHtml(group || "Ungrouped")}</h3>
          <span>${groupedSites.length}</span>
        </div>
        <div class="site-grid">
          ${groupedSites.map((site) => siteCard(site, siteUrl(site.slug), csrfToken)).join("")}
        </div>
      </section>`;
  }).join("");
}

function siteCard(site, url, csrfToken) {
  const groupKey = site.group || "__ungrouped";
  const title = site.title || site.slug;
  return `
    <article class="site-card" data-site-card data-title="${escapeHtml(title.toLowerCase())}" data-slug="${escapeHtml(site.slug)}" data-group="${escapeHtml(groupKey)}">
      <div class="preview-canvas">
        <iframe src="${escapeHtml(url)}" title="${escapeHtml(title)} thumbnail" loading="lazy" sandbox="allow-scripts" tabindex="-1"></iframe>
        <button type="button" data-preview-url="${escapeHtml(url)}" data-preview-name="${escapeHtml(title)}" aria-label="Preview ${escapeHtml(title)}"><span>Preview site</span></button>
      </div>
      <div class="site-card-body">
        <div class="site-title-row">
          <div>
            <h4>${escapeHtml(title)}</h4>
            <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(urlLabel(url))}</a>
          </div>
          <span class="status"><i></i>Live</span>
        </div>
        <p class="site-date">Published ${formatDate(site.deployedAt || site.updatedAt || site.createdAt)}</p>
        <div class="site-actions">
          <button class="button button-secondary" type="button" data-preview-url="${escapeHtml(url)}" data-preview-name="${escapeHtml(title)}">Preview</button>
          <button class="button button-quiet" type="button" data-copy-url="${escapeHtml(url)}">Copy URL</button>
          <a class="button button-quiet" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">Open</a>
        </div>
        <details class="manage-box">
          <summary>Manage site</summary>
          <div class="manage-content">
            <form class="manage-form" method="post" action="/sites/${encodeURIComponent(site.slug)}/settings">
              ${csrfField(csrfToken)}
              <h5>Site details</h5>
              <label>
                <span>Name</span>
                <input name="title" value="${escapeHtml(title)}" maxlength="120" required>
              </label>
              <label>
                <span>Client / group</span>
                <input name="group" value="${escapeHtml(site.group || "")}" list="group-options" maxlength="60" placeholder="Ungrouped">
              </label>
              <label class="check-row">
                <input name="spaFallback" type="checkbox" value="1" ${site.spaFallback ? "checked" : ""}>
                <span>Use index.html for app routes</span>
              </label>
              <button class="button button-secondary" type="submit">Save details</button>
            </form>
            <form class="manage-form" method="post" action="/sites/${encodeURIComponent(site.slug)}/redeploy" enctype="multipart/form-data">
              ${csrfField(csrfToken)}
              <h5>Replace files</h5>
              <label class="compact-file">
                <span>ZIP archive</span>
                <input name="archive" type="file" accept=".zip,application/zip">
              </label>
              <label class="compact-file">
                <span>Website folder</span>
                <input name="files" type="file" webkitdirectory directory multiple>
              </label>
              <input name="spaFallback" type="hidden" value="${site.spaFallback ? "1" : "0"}">
              <button class="button button-secondary" type="submit">Redeploy</button>
            </form>
            <form class="delete-form" method="post" action="/sites/${encodeURIComponent(site.slug)}/delete" data-delete-form="${escapeHtml(title)}">
              ${csrfField(csrfToken)}
              <button class="button button-danger" type="submit">Delete site</button>
            </form>
          </div>
        </details>
      </div>
    </article>`;
}

function previewDialog() {
  return `
    <dialog class="preview-dialog" data-preview-dialog>
      <div class="preview-bar">
        <div>
          <strong data-preview-title>Site preview</strong>
          <span data-preview-address></span>
        </div>
        <div class="preview-actions">
          <a class="button button-secondary" href="#" target="_blank" rel="noreferrer" data-preview-open>Open site</a>
          <button class="button button-secondary" type="button" data-preview-close>Close</button>
        </div>
      </div>
      <iframe title="Site preview" sandbox="allow-scripts" data-preview-frame></iframe>
    </dialog>`;
}

function overviewEmptyState() {
  return `
    <div class="empty empty-compact">
      <h3>No deployments yet</h3>
      <p>Publish your first static site to get started.</p>
      <a class="button button-primary" href="/sites/new">New deployment</a>
    </div>`;
}

function sitesEmptyState() {
  return `
    <div class="empty">
      <h3>No sites yet</h3>
      <p>Your first deployment will appear here.</p>
      <a class="button button-primary" href="/sites/new">New deployment</a>
    </div>`;
}

function layout({ title, body, bodyClass = "", script = false }) {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${escapeHtml(title)}</title>
  <link rel="stylesheet" href="/assets/dashboard.css">
  ${script ? `<script src="/assets/dashboard.js" defer></script>` : ""}
</head>
<body class="${escapeHtml(bodyClass)}">
  ${body}
</body>
</html>`;
}

function uniqueGroups(sites) {
  return [...new Set(sites.map((site) => String(site.group || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b));
}

function csrfField(token) {
  return `<input type="hidden" name="_csrf" value="${escapeHtml(token)}">`;
}

function siteTimestamp(site) {
  return new Date(site.deployedAt || site.updatedAt || site.createdAt || 0).getTime();
}

function urlLabel(url) {
  return String(url).replace(/^https?:\/\//, "").replace(/\/$/, "");
}

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

module.exports = {
  dashboardPage,
  loginPage,
  newSitePage,
  settingsPage,
  sitesPage
};
