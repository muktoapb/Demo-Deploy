const fs = require("node:fs/promises");
const path = require("node:path");
const { config } = require("./config");

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
  const nextSite = {
    ...site,
    ...metadata,
    updatedAt: new Date().toISOString()
  };

  if (index === -1) {
    sites.unshift({
      ...nextSite,
      createdAt: nextSite.updatedAt
    });
  } else {
    sites[index] = {
      ...sites[index],
      ...nextSite,
      createdAt: sites[index].createdAt
    };
  }

  await saveSites(sites);
  return nextSite;
}

async function updateSiteMetadata(slug, updates) {
  const sites = await loadSites();
  const index = sites.findIndex((site) => site.slug === slug);
  if (index === -1) throw new Error("Site not found.");

  sites[index] = {
    ...sites[index],
    ...normalizeSiteMetadata(updates, slug),
    updatedAt: new Date().toISOString()
  };
  await saveSites(sites);
  return sites[index];
}

async function removeSite(slug) {
  const sites = await loadSites();
  await saveSites(sites.filter((site) => site.slug !== slug));
  await fs.rm(path.join(config.sitesDir, slug), { recursive: true, force: true });
}

function siteCurrentDir(slug) {
  return path.join(config.sitesDir, slug, "current");
}

function siteUrl(slug, req) {
  const host = config.baseDomain === "localhost"
    ? `localhost:${config.port}`
    : config.baseDomain;
  return `${config.publicProtocol}://${slug}.${host}`;
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

module.exports = {
  ensureStorage,
  findSite,
  loadSites,
  removeSite,
  siteCurrentDir,
  siteUrl,
  updateSiteMetadata,
  upsertSite
};
