const path = require("node:path");

const rootDir = path.resolve(__dirname, "..");
const baseDomain = normalizeDomain(process.env.BASE_DOMAIN || "localhost");

const config = {
  rootDir,
  port: parsePositiveInteger(process.env.PORT || "3000", "PORT"),
  baseDomain,
  publicProtocol:
    process.env.PUBLIC_PROTOCOL || (baseDomain === "localhost" ? "http" : "https"),
  adminUser: (process.env.ADMIN_USER || "admin").trim(),
  adminPassword: process.env.ADMIN_PASSWORD || "changeme",
  sessionSecret:
    process.env.SESSION_SECRET ||
    "replace-this-secret-before-running-in-production",
  dataDir: path.resolve(process.env.DATA_DIR || path.join(rootDir, "data")),
  maxUploadMb: parsePositiveInteger(process.env.MAX_UPLOAD_MB || "100", "MAX_UPLOAD_MB")
};

config.maxUploadBytes = config.maxUploadMb * 1024 * 1024;
config.sitesDir = path.join(config.dataDir, "sites");
config.tmpDir = path.join(config.dataDir, "tmp");
config.registryPath = path.join(config.dataDir, "sites.json");
config.isDefaultPassword = config.adminPassword === "changeme";
validateConfig(config);

function normalizeDomain(value) {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "")
    .toLowerCase();
}

function parsePositiveInteger(value, name) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer.`);
  }
  return parsed;
}

function validateConfig(value) {
  if (!value.adminUser) {
    throw new Error("ADMIN_USER cannot be empty.");
  }
  if (!["http", "https"].includes(value.publicProtocol)) {
    throw new Error("PUBLIC_PROTOCOL must be http or https.");
  }
  if (value.port > 65535) {
    throw new Error("PORT must be 65535 or lower.");
  }
  if (value.maxUploadMb > 1024) {
    throw new Error("MAX_UPLOAD_MB must be 1024 or lower.");
  }
  if (!isValidBaseDomain(value.baseDomain)) {
    throw new Error("BASE_DOMAIN must be localhost or a valid domain name.");
  }

  if (value.baseDomain !== "localhost") {
    if (value.adminPassword.length < 12 || value.adminPassword === "change-this-password") {
      throw new Error("Set ADMIN_PASSWORD to at least 12 characters before public deployment.");
    }
    if (
      value.sessionSecret.length < 32
      || value.sessionSecret === "replace-this-secret-before-running-in-production"
      || value.sessionSecret === "change-this-secret"
    ) {
      throw new Error("Set SESSION_SECRET to a random value of at least 32 characters.");
    }
  }
}

function isValidBaseDomain(value) {
  if (value === "localhost") return true;
  if (value.length > 253 || !value.includes(".")) return false;
  return value.split(".").every((label) =>
    /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)
  );
}

module.exports = {
  config,
  isValidBaseDomain,
  normalizeDomain,
  parsePositiveInteger,
  validateConfig
};
