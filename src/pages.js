function loginPage({ error = "" } = {}) {
  return layout({
    title: "Sign in | Demo Deploy",
    bodyClass: "login-body",
    body: `
      <main class="login-shell">
        <form class="login-panel" method="post" action="/login">
          <div class="brand-lockup login-brand">
            <img class="brand-logo" src="/assets/logo-generated.png" alt="" width="36" height="36">
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
          <button class="button button-primary button-full" type="submit"><span>Sign in</span>${iconSvg("arrow-right")}</button>
        </form>
      </main>`
  });
}

function dashboardPage(options) {
  const { sites, siteUrl } = options;
  const groups = uniqueGroups(sites);
  const totalViews = sites.reduce((sum, site) => sum + siteViewCount(site), 0);
  const recentSites = [...sites]
    .sort((a, b) => siteTimestamp(b) - siteTimestamp(a))
    .slice(0, 5);
  const latestSite = recentSites[0];

  return appPage({
    ...options,
    activePage: "overview",
    pageTitle: "Overview",
    overline: "Workspace",
    action: `<a class="button button-primary" href="/sites/new">${iconSvg("upload")}<span>Deploy site</span></a>`,
    content: `
      <section class="summary-grid" aria-label="Deployment summary">
        <article class="metric">
          <div class="metric-heading"><span>Live sites</span><i>${iconSvg("panels")}</i></div>
          <strong>${sites.length}</strong>
        </article>
        <article class="metric">
          <div class="metric-heading"><span>Client groups</span><i>${iconSvg("users")}</i></div>
          <strong>${groups.length}</strong>
        </article>
        <article class="metric">
          <div class="metric-heading"><span>Unique views</span><i>${iconSvg("eye")}</i></div>
          <strong>${formatInteger(totalViews)}</strong>
        </article>
        <article class="metric metric-wide">
          <div class="metric-heading"><span>Last published</span><i>${iconSvg("clock")}</i></div>
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
          ${actionLink("/sites/new", "upload", "Deploy a site", "Upload a ZIP archive or website folder.")}
          ${actionLink("/sites", "panels", "Manage sites", "Preview, organize, update, or remove deployments.")}
          ${actionLink("/settings", "settings", "Account settings", "Review server details and update your password.")}
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
    action: `<a class="button button-primary" href="/sites/new">${iconSvg("upload")}<span>New deployment</span></a>`,
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
              <i aria-hidden="true">${iconSvg("search")}</i>
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
          <fieldset class="deployment-access">
            <legend>Visitor access</legend>
            <div class="deployment-access-row">
              <label class="manage-switch">
                <input name="passwordProtected" type="checkbox" value="1" data-protection-toggle>
                <span class="switch-control" aria-hidden="true"></span>
                <span><strong>Password protect this site</strong><small>Require a password before clients can view it.</small></span>
              </label>
              <label class="manage-password-field" data-protection-field hidden>
                <span>Visitor password</span>
                <input name="sitePassword" type="password" autocomplete="new-password" minlength="8" placeholder="At least 8 characters" disabled data-protection-password data-has-password="false">
                <small>Share this password only with people who should see the demo.</small>
              </label>
            </div>
          </fieldset>
          <div class="upload-grid">
            <label class="file-choice">
              <span class="file-choice-icon" aria-hidden="true">${iconSvg("archive")}</span>
              <span class="file-choice-title">ZIP archive</span>
              <span class="file-choice-value">Choose one .zip file</span>
              <input name="archive" type="file" accept=".zip,application/zip">
            </label>
            <span class="upload-or">or</span>
            <label class="file-choice">
              <span class="file-choice-icon" aria-hidden="true">${iconSvg("folder")}</span>
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
            <button class="button button-primary" type="submit" data-deploy-button>${iconSvg("upload")}<span>Deploy site</span></button>
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
          <div class="settings-summary form-surface">
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
            <button class="button button-secondary" type="submit">${iconSvg("key")}<span>Update password</span></button>
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
            <button class="button button-secondary" type="submit">${iconSvg("log-out")}<span>Sign out</span></button>
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
            <img class="brand-logo" src="/assets/logo-generated.png" alt="" width="36" height="36">
            <span>Demo Deploy</span>
          </a>

          <nav class="main-nav" aria-label="Dashboard navigation">
            ${navLink("/", "Overview", activePage === "overview", { icon: "home" })}
            ${navLink("/sites", "Sites", activePage === "sites", { count: sites.length, icon: "panels" })}
            ${navLink("/sites/new", "New deployment", activePage === "new-site", { icon: "upload", mobileLabel: "Deploy" })}
            ${navLink("/settings", "Settings", activePage === "settings", { icon: "settings" })}
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

        <header class="mobile-brandbar">
          <a class="brand-lockup" href="/" aria-label="Demo Deploy overview">
            <img class="brand-logo" src="/assets/logo-generated.png" alt="" width="32" height="32">
            <span>Demo Deploy</span>
          </a>
        </header>

        <main class="main-content">
          <header class="page-header">
            <div>
              <p class="overline">${escapeHtml(overline)}</p>
              <h1>${escapeHtml(pageTitle)}</h1>
            </div>
            ${action}
          </header>

          <div class="notice-stack" aria-live="polite">
            ${needsPasswordChange ? `<p class="notice warning">${iconSvg("triangle-alert")}<span>Change the default password in <a href="/settings">Settings</a> before publishing this dashboard.</span></p>` : ""}
            ${message ? `<p class="notice success">${iconSvg("circle-check")}<span>${escapeHtml(message)}</span></p>` : ""}
            ${error ? `<p class="notice alert" role="alert">${iconSvg("circle-alert")}<span>${escapeHtml(error)}</span></p>` : ""}
          </div>

          ${content}
        </main>
      </div>`
  });
}

function navLink(href, label, active, { count, icon, mobileLabel = label } = {}) {
  return `
    <a href="${href}"${active ? ` aria-current="page"` : ""}>
      <span class="nav-icon" aria-hidden="true">${iconSvg(icon)}</span>
      <span class="nav-label">
        <span class="nav-full">${escapeHtml(label)}</span>
        <span class="nav-short">${escapeHtml(mobileLabel)}</span>
      </span>
      ${Number.isInteger(count) ? `<span class="nav-count">${count}</span>` : ""}
    </a>`;
}

function actionLink(href, icon, title, description) {
  return `
    <a href="${href}">
      <span class="action-icon" aria-hidden="true">${iconSvg(icon)}</span>
      <span class="action-copy"><strong>${title}</strong><span>${description}</span></span>
      <span class="action-arrow" aria-hidden="true">${iconSvg("arrow-right")}</span>
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
            <a class="button button-quiet" href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${iconSvg("external-link")}<span>Open</span></a>
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
          ${groupedSites.map((site) => siteCard(site, siteUrl(site.slug))).join("")}
        </div>
        ${groupedSites.map((site) => manageDialog(site, site.title || site.slug, siteUrl(site.slug), csrfToken)).join("")}
      </section>`;
  }).join("");
}

function siteCard(site, url) {
  const groupKey = site.group || "__ungrouped";
  const title = site.title || site.slug;
  const views = siteViewCount(site);
  const paused = Boolean(site.access?.paused);
  const passwordProtected = Boolean(site.access?.password);
  const manageId = manageDialogId(site.slug);
  return `
    <article class="site-card" data-site-card data-title="${escapeHtml(title.toLowerCase())}" data-slug="${escapeHtml(site.slug)}" data-group="${escapeHtml(groupKey)}">
      <div class="preview-canvas">
        <iframe src="${escapeHtml(url)}" title="${escapeHtml(title)} thumbnail" loading="lazy" sandbox="allow-scripts" tabindex="-1"></iframe>
      </div>
      <div class="site-card-body">
        <div class="site-title-row">
          <div>
            <h4>${escapeHtml(title)}</h4>
            <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(urlLabel(url))}</a>
          </div>
          <div class="site-statuses">
            ${passwordProtected ? `<span class="access-badge" title="Password protected" aria-label="Password protected">${iconSvg("lock")}</span>` : ""}
            <span class="status${paused ? " status-paused" : ""}"><i></i>${paused ? "Paused" : "Live"}</span>
          </div>
        </div>
        <div class="site-meta">
          <p class="site-date">Published ${formatDate(site.deployedAt || site.updatedAt || site.createdAt)}</p>
          <p class="site-views">${iconSvg("eye")}<span>${formatInteger(views)} ${views === 1 ? "view" : "views"}</span></p>
        </div>
        <div class="site-actions">
          <button class="button button-secondary site-preview-button" type="button" data-preview-url="${escapeHtml(url)}" data-preview-name="${escapeHtml(title)}">${iconSvg("eye")}<span>Preview</span></button>
          <div class="site-action-icons">
            <button class="icon-button" type="button" data-copy-url="${escapeHtml(url)}" aria-label="Copy ${escapeHtml(title)} URL" title="Copy URL">${iconSvg("copy")}<span class="sr-only">Copy URL</span></button>
            <a class="icon-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" aria-label="Open ${escapeHtml(title)} in a new tab" title="Open site">${iconSvg("external-link")}</a>
            <button class="icon-button manage-button" type="button" data-manage-open="${escapeHtml(site.slug)}" aria-haspopup="dialog" aria-controls="${escapeHtml(manageId)}" aria-label="Manage ${escapeHtml(title)}" title="Manage site">${iconSvg("settings")}</button>
          </div>
        </div>
      </div>
    </article>`;
}

function manageDialog(site, title, url, csrfToken) {
  const manageId = manageDialogId(site.slug);
  const titleId = `${manageId}-title`;
  const paused = Boolean(site.access?.paused);
  const passwordProtected = Boolean(site.access?.password);
  return `
    <dialog class="manage-dialog" id="${escapeHtml(manageId)}" data-manage-dialog="${escapeHtml(site.slug)}" aria-labelledby="${escapeHtml(titleId)}">
      <div class="manage-bar">
        <div class="manage-site">
          <span class="manage-site-mark" aria-hidden="true">${escapeHtml(title.charAt(0).toUpperCase())}</span>
          <div>
            <span class="manage-eyebrow">Site settings</span>
            <strong id="${escapeHtml(titleId)}">${escapeHtml(title)}</strong>
            <a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(urlLabel(url))}</a>
          </div>
        </div>
        <div class="manage-bar-actions">
          <span class="status${paused ? " status-paused" : ""}"><i></i>${paused ? "Paused" : "Live"}</span>
          <a class="icon-button" href="${escapeHtml(url)}" target="_blank" rel="noreferrer" aria-label="Open ${escapeHtml(title)} in a new tab" title="Open site">${iconSvg("external-link")}</a>
          <button class="icon-button" type="button" data-manage-close aria-label="Close manage dialog" title="Close manage dialog">${iconSvg("x")}</button>
        </div>
      </div>
      <div class="manage-content">
        <section class="manage-section">
          <div class="manage-section-heading">
            <div>
              <h3>Site details</h3>
              <p>Update how this deployment appears in your workspace.</p>
            </div>
          </div>
          <form class="manage-form" method="post" action="/sites/${encodeURIComponent(site.slug)}/settings">
            ${csrfField(csrfToken)}
            <div class="manage-field-grid">
              <label>
                <span>Name</span>
                <input name="title" value="${escapeHtml(title)}" maxlength="120" required>
              </label>
              <label>
                <span>Client / group</span>
                <input name="group" value="${escapeHtml(site.group || "")}" list="group-options" maxlength="60" placeholder="Ungrouped">
              </label>
            </div>
            <div class="manage-access-grid">
              <label class="manage-switch">
                <input name="active" type="checkbox" value="1" ${paused ? "" : "checked"}>
                <span class="switch-control" aria-hidden="true"></span>
                <span><strong>Site is live</strong><small>Turn off to pause public access.</small></span>
              </label>
              <label class="manage-switch">
                <input name="passwordProtected" type="checkbox" value="1" ${passwordProtected ? "checked" : ""} data-protection-toggle>
                <span class="switch-control" aria-hidden="true"></span>
                <span><strong>Password protection</strong><small>Require a password before viewing.</small></span>
              </label>
            </div>
            <label class="manage-password-field" data-protection-field ${passwordProtected ? "" : "hidden"}>
              <span>${passwordProtected ? "New visitor password" : "Visitor password"}</span>
              <input name="sitePassword" type="password" autocomplete="new-password" minlength="8" placeholder="${passwordProtected ? "Leave blank to keep current password" : "At least 8 characters"}" ${passwordProtected ? "" : "disabled"} data-protection-password data-has-password="${passwordProtected}">
              <small>${passwordProtected ? "Leave blank to keep the existing password." : "Share this password with people who should see the demo."}</small>
            </label>
            <label class="check-row manage-toggle">
              <input name="spaFallback" type="checkbox" value="1" ${site.spaFallback ? "checked" : ""}>
              <span><strong>Single-page app fallback</strong><small>Use index.html when a requested route is not found.</small></span>
            </label>
            <div class="manage-form-actions">
              <button class="button button-primary" type="submit">Save changes</button>
            </div>
          </form>
        </section>

        <section class="manage-section">
          <div class="manage-section-heading">
            <div>
              <h3>Replace deployment</h3>
              <p>Publish a new ZIP archive or website folder to this address.</p>
            </div>
          </div>
          <form class="manage-form" method="post" action="/sites/${encodeURIComponent(site.slug)}/redeploy" enctype="multipart/form-data">
            ${csrfField(csrfToken)}
            <div class="manage-upload-grid">
              <label class="compact-file">
                <span class="compact-file-heading">
                  ${iconSvg("archive")}
                  <span><strong>ZIP archive</strong><small>Choose one .zip file</small></span>
                </span>
                <input name="archive" type="file" accept=".zip,application/zip">
              </label>
              <label class="compact-file">
                <span class="compact-file-heading">
                  ${iconSvg("folder")}
                  <span><strong>Website folder</strong><small>Select a folder containing index.html</small></span>
                </span>
                <input name="files" type="file" webkitdirectory directory multiple>
              </label>
            </div>
            <input name="spaFallback" type="hidden" value="${site.spaFallback ? "1" : "0"}">
            <div class="manage-form-actions">
              <button class="button button-secondary" type="submit">${iconSvg("upload")}<span>Redeploy site</span></button>
            </div>
          </form>
        </section>

        <section class="manage-section manage-danger">
          <div>
            <h3>Delete site</h3>
            <p>Permanently remove this deployment and all uploaded files.</p>
          </div>
          <form class="delete-form" method="post" action="/sites/${encodeURIComponent(site.slug)}/delete" data-delete-form="${escapeHtml(title)}">
            ${csrfField(csrfToken)}
            <button class="button button-danger" type="submit">Delete site</button>
          </form>
        </section>
      </div>
    </dialog>`;
}

function manageDialogId(slug) {
  return `manage-${slug}`;
}

function previewDialog() {
  return `
    <dialog class="preview-dialog" data-preview-dialog data-preview-viewport="desktop">
      <div class="preview-bar">
        <div class="preview-meta">
          <strong data-preview-title>Site preview</strong>
          <span data-preview-address></span>
        </div>
        <div class="preview-toolbar">
          <div class="preview-sizes" role="group" aria-label="Preview viewport">
            <button type="button" data-preview-size="desktop" aria-label="Desktop preview" aria-pressed="true" title="Desktop preview">
              ${iconSvg("monitor")}
            </button>
            <button type="button" data-preview-size="tablet" aria-label="Tablet preview" aria-pressed="false" title="Tablet preview">
              ${iconSvg("tablet")}
            </button>
            <button type="button" data-preview-size="mobile" aria-label="Mobile preview" aria-pressed="false" title="Mobile preview">
              ${iconSvg("smartphone")}
            </button>
          </div>
          <div class="preview-actions">
            <a class="button button-secondary" href="#" target="_blank" rel="noreferrer" data-preview-open>
              ${iconSvg("external-link")}<span>Open site</span>
            </a>
            <button class="icon-button" type="button" data-preview-close aria-label="Close preview" title="Close preview">
              ${iconSvg("x")}
            </button>
          </div>
        </div>
      </div>
      <div class="preview-stage">
        <iframe title="Site preview" sandbox="allow-scripts allow-forms allow-same-origin" data-preview-frame></iframe>
      </div>
    </dialog>`;
}

function iconSvg(name) {
  const icons = {
    archive: `<path d="M10 12h4"/><path d="M10 8h4"/><path d="M4 4v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4"/><path d="M2 2h20v4H2z"/>`,
    "arrow-right": `<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>`,
    "circle-alert": `<circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/>`,
    "circle-check": `<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>`,
    clock: `<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`,
    copy: `<rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>`,
    eye: `<path d="M2.06 12.35a1 1 0 0 1 0-.7C3.75 7.6 7.6 5 12 5c4.4 0 8.25 2.6 9.94 6.65a1 1 0 0 1 0 .7C20.25 16.4 16.4 19 12 19c-4.4 0-8.25-2.6-9.94-6.65"/><circle cx="12" cy="12" r="3"/>`,
    "external-link": `<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>`,
    folder: `<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"/>`,
    home: `<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>`,
    key: `<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>`,
    "log-out": `<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/>`,
    lock: `<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>`,
    monitor: `<rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/>`,
    panels: `<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>`,
    settings: `<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.51a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>`,
    smartphone: `<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>`,
    tablet: `<rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="12" x2="12.01" y1="18" y2="18"/>`,
    "triangle-alert": `<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>`,
    upload: `<path d="M12 3v12"/><path d="m7 8 5-5 5 5"/><path d="M5 21h14a2 2 0 0 0 2-2v-4"/><path d="M3 15v4a2 2 0 0 0 2 2"/>`,
    users: `<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>`,
    x: `<path d="M18 6 6 18"/><path d="m6 6 12 12"/>`
  };

  return `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${icons[name] || ""}</svg>`;
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
  <link rel="icon" href="/assets/logo-generated.png" type="image/png">
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

function siteViewCount(site) {
  if (Number.isInteger(site.views?.count)) return site.views.count;
  if (Array.isArray(site.views?.visitorHashes)) return site.views.visitorHashes.length;
  return 0;
}

function formatInteger(value) {
  return new Intl.NumberFormat("en").format(value);
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
