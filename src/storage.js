const fs = require("node:fs/promises");
const crypto = require("node:crypto");
const path = require("node:path");
const { config } = require("./config");
const { hashPassword } = require("./auth");

async function ensureStorage() {
  await fs.mkdir(config.sitesDir, { recursive: true });
  await fs.mkdir(config.tmpDir, { recursive: true });
  try {
    await fs.access(config.registryPath);
  } catch {
    await saveSites([]);
  }
}

async function loadSites() {
  await ensureStorage();
  const content = await fs.readFile(config.registryPath, "utf8");
  return JSON.parse(content);
}

async function saveSites(sites) {
  await fs.mkdir(path.dirname(config.registryPath), { recursive: true });
  // A temp file per save, so two saves never write into the same file.
  const tmpPath = `${config.registryPath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    await fs.writeFile(tmpPath, `${JSON.stringify(sites, null, 2)}\n`);
    await fs.rename(tmpPath, config.registryPath);
  } catch (error) {
    await fs.rm(tmpPath, { force: true });
    throw error;
  }
}

let registryQueue = Promise.resolve();

// Runs registry read-modify-write steps one at a time, so simultaneous
// requests (such as visits being counted) cannot overwrite each other.
function withRegistryLock(task) {
  const run = registryQueue.then(task, task);
  registryQueue = run.catch(() => {});
  return run;
}

async function findSite(slug) {
  const sites = await loadSites();
  return sites.find((site) => site.slug === slug) || null;
}

async function upsertSite(site) {
  return withRegistryLock(() => upsertSiteUnlocked(site));
}

async function upsertSiteUnlocked(site) {
  const sites = await loadSites();
  const index = sites.findIndex((item) => item.slug === site.slug);
  const metadata = normalizeSiteMetadata(site, site.slug);
  const {
    passwordProtected: _passwordProtected,
    sitePassword: _sitePassword,
    paused: _paused,
    ...persistedSite
  } = site;
  const nextSite = {
    ...persistedSite,
    ...metadata,
    updatedAt: new Date().toISOString()
  };

  if (index === -1) {
    const createdSite = {
      ...nextSite,
      access: await normalizeSiteAccess(site),
      createdAt: nextSite.updatedAt
    };
    sites.unshift(createdSite);
    await saveSites(sites);
    return createdSite;
  } else {
    sites[index] = {
      ...sites[index],
      ...nextSite,
      createdAt: sites[index].createdAt
    };
  }

  await saveSites(sites);
  return sites[index];
}

async function updateSiteMetadata(slug, updates) {
  return withRegistryLock(() => updateSiteMetadataUnlocked(slug, updates));
}

async function updateSiteMetadataUnlocked(slug, updates) {
  const sites = await loadSites();
  const index = sites.findIndex((site) => site.slug === slug);
  if (index === -1) throw new Error("Site not found.");

  const access = await normalizeSiteAccess(updates, sites[index].access);
  sites[index] = {
    ...sites[index],
    ...normalizeSiteMetadata(updates, slug),
    access,
    updatedAt: new Date().toISOString()
  };
  await saveSites(sites);
  return sites[index];
}

async function recordSiteView(slug, ipAddress, details = {}) {
  const visitorHash = hashVisitor(ipAddress);
  if (!visitorHash) return false;

  return withRegistryLock(() => recordSiteViewUnlocked(slug, visitorHash, details));
}

async function recordSiteViewUnlocked(slug, visitorHash, details) {
  const sites = await loadSites();
  const index = sites.findIndex((site) => site.slug === slug);
  if (index === -1) return false;

  const existingHashes = Array.isArray(sites[index].views?.visitorHashes)
    ? sites[index].views.visitorHashes
    : [];
  const visitorHashes = new Set(existingHashes);
  const isUniqueVisitor = !visitorHashes.has(visitorHash);
  if (isUniqueVisitor) visitorHashes.add(visitorHash);

  const now = new Date();
  const currentViews = sites[index].views || {};
  sites[index] = {
    ...sites[index],
    views: {
      ...currentViews,
      count: visitorHashes.size,
      visitorHashes: [...visitorHashes],
      total: siteVisitCount(sites[index]) + 1,
      lastVisitedAt: now.toISOString(),
      daily: incrementDailyViews(currentViews.daily, now),
      paths: incrementNamedMetric(currentViews.paths, normalizeAnalyticsPath(details.path), 20),
      referrers: incrementNamedMetric(currentViews.referrers, normalizeReferrer(details.referrer), 20),
      updatedAt: now.toISOString()
    }
  };

  await saveSites(sites);
  return isUniqueVisitor;
}

async function removeSite(slug) {
  await withRegistryLock(async () => {
    const sites = await loadSites();
    await saveSites(sites.filter((site) => site.slug !== slug));
  });
  await fs.rm(path.join(config.sitesDir, slug), { recursive: true, force: true });
}

function siteCurrentDir(slug) {
  return path.join(config.sitesDir, slug, "current");
}

function siteViewCount(site) {
  if (Number.isInteger(site.views?.count)) return site.views.count;
  if (Array.isArray(site.views?.visitorHashes)) return site.views.visitorHashes.length;
  return 0;
}

function siteVisitCount(site) {
  if (Number.isInteger(site.views?.total)) return site.views.total;
  return siteViewCount(site);
}

function siteUrl(slug, req) {
  const host = config.baseDomain === "localhost"
    ? `localhost:${config.port}`
    : config.baseDomain;
  return `${config.publicProtocol}://${slug}.${host}`;
}

function hashVisitor(ipAddress) {
  const normalized = String(ipAddress || "").trim();
  if (!normalized) return "";

  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(normalized)
    .digest("base64url");
}

function incrementDailyViews(daily, now) {
  const date = now.toISOString().slice(0, 10);
  const nextDaily = Array.isArray(daily) ? daily.map((item) => ({
    date: String(item.date || ""),
    count: Number.isInteger(item.count) ? item.count : 0
  })).filter((item) => item.date) : [];
  const existing = nextDaily.find((item) => item.date === date);

  if (existing) existing.count += 1;
  else nextDaily.push({ date, count: 1 });

  return nextDaily
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);
}

function incrementNamedMetric(metrics, name, limit) {
  const metricName = name || "Unknown";
  const nextMetrics = Array.isArray(metrics) ? metrics.map((item) => ({
    name: String(item.name || ""),
    count: Number.isInteger(item.count) ? item.count : 0
  })).filter((item) => item.name) : [];
  const existing = nextMetrics.find((item) => item.name === metricName);

  if (existing) existing.count += 1;
  else nextMetrics.push({ name: metricName, count: 1 });

  return nextMetrics
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
    .slice(0, limit);
}

function normalizeAnalyticsPath(value) {
  const pathValue = String(value || "/").split("?")[0].split("#")[0] || "/";
  return pathValue.startsWith("/") ? pathValue : `/${pathValue}`;
}

function normalizeReferrer(value) {
  const referrer = String(value || "").trim();
  if (!referrer) return "Direct";

  try {
    const url = new URL(referrer);
    const baseHost = config.baseDomain === "localhost" ? "localhost" : config.baseDomain;
    if (url.hostname === baseHost || url.hostname.endsWith(`.${baseHost}`)) {
      return "Internal";
    }
    return url.hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

function normalizeSiteMetadata(value, slug) {
  const title = String(value.title || slug).trim();
  const group = String(value.group || "").trim();

  if (!title) throw new Error("Site name is required.");
  if (title.length > 120) throw new Error("Site name must be 120 characters or less.");
  if (group.length > 60) throw new Error("Client or group must be 60 characters or less.");

  return {
    title,
    group,
    spaFallback: Boolean(value.spaFallback)
  };
}

async function normalizeSiteAccess(value, currentAccess = {}) {
  const paused = Boolean(value.paused);
  const passwordProtected = Boolean(value.passwordProtected);
  const password = String(value.sitePassword || "");

  if (!passwordProtected) return { paused, password: null };
  if (!password && currentAccess?.password) {
    return { paused, password: currentAccess.password };
  }
  if (password.length < 8) {
    throw new Error("Site password must be at least 8 characters.");
  }

  return {
    paused,
    password: await hashPassword(password)
  };
}

module.exports = {
  ensureStorage,
  findSite,
  loadSites,
  recordSiteView,
  removeSite,
  siteCurrentDir,
  siteVisitCount,
  siteViewCount,
  siteUrl,
  updateSiteMetadata,
  upsertSite
};
