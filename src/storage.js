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
  const tmpPath = `${config.registryPath}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(sites, null, 2)}\n`);
  await fs.rename(tmpPath, config.registryPath);
}

async function findSite(slug) {
  const sites = await loadSites();
  return sites.find((site) => site.slug === slug) || null;
}

async function upsertSite(site) {
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

async function recordSiteView(slug, ipAddress) {
  const visitorHash = hashVisitor(ipAddress);
  if (!visitorHash) return false;

  const sites = await loadSites();
  const index = sites.findIndex((site) => site.slug === slug);
  if (index === -1) return false;

  const existingHashes = Array.isArray(sites[index].views?.visitorHashes)
    ? sites[index].views.visitorHashes
    : [];
  const visitorHashes = new Set(existingHashes);
  if (visitorHashes.has(visitorHash)) return false;

  visitorHashes.add(visitorHash);
  sites[index] = {
    ...sites[index],
    views: {
      count: visitorHashes.size,
      visitorHashes: [...visitorHashes],
      updatedAt: new Date().toISOString()
    }
  };

  await saveSites(sites);
  return true;
}

async function removeSite(slug) {
  const sites = await loadSites();
  await saveSites(sites.filter((site) => site.slug !== slug));
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
  siteViewCount,
  siteUrl,
  updateSiteMetadata,
  upsertSite
};
