const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { config } = require("./config");

const COOKIE_NAME = "demo_deploy_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;
const SCRYPT_KEY_LENGTH = 64;
const CREDENTIALS_PATH = path.join(config.dataDir, "admin.json");

function loginToken() {
  const payload = JSON.stringify({
    user: config.adminUser,
    exp: Date.now() + MAX_AGE_SECONDS * 1000
  });
  const encoded = Buffer.from(payload).toString("base64url");
  return `${encoded}.${signature(encoded)}`;
}

function verifyToken(token) {
  if (!token || !token.includes(".")) return false;
  const [encoded, signed] = token.split(".");
  if (!safeEqual(signature(encoded), signed)) return false;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    return payload.user === config.adminUser && payload.exp > Date.now();
  } catch {
    return false;
  }
}

function requireAuth(req, res, next) {
  if (verifyToken(readCookie(req.headers.cookie || "", COOKIE_NAME))) {
    return next();
  }
  return res.redirect("/login");
}

function createCsrfToken(req) {
  const session = readCookie(req.headers.cookie || "", COOKIE_NAME);
  return verifyToken(session) ? signature(`csrf:${session}`) : "";
}

function requireCsrf(req, res, next) {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    next();
    return;
  }

  const expected = createCsrfToken(req);
  const provided = String(req.body?._csrf || "");
  if (expected && safeEqual(expected, provided)) {
    next();
    return;
  }

  const error = new Error("Invalid request token. Reload the dashboard and try again.");
  error.status = 403;
  next(error);
}

function setLoginCookie(res) {
  const secure = config.publicProtocol === "https" && config.baseDomain !== "localhost";
  const parts = [
    `${COOKIE_NAME}=${loginToken()}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${MAX_AGE_SECONDS}`
  ];
  if (secure) parts.push("Secure");
  res.setHeader("Set-Cookie", parts.join("; "));
}

function clearLoginCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
}

function readCookie(header, name) {
  const cookies = header.split(";").map((cookie) => cookie.trim());
  const match = cookies.find((cookie) => cookie.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : "";
}

function signature(value) {
  return crypto
    .createHmac("sha256", config.sessionSecret)
    .update(value)
    .digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function verifyAdminCredentials(username, password) {
  if (username !== config.adminUser) return false;

  const credentials = await loadCredentials();
  if (credentials) {
    return verifyPassword(password, credentials);
  }

  return safeEqual(password, config.adminPassword);
}

async function changeAdminPassword({ currentPassword, newPassword, confirmPassword }) {
  if (!(await verifyAdminCredentials(config.adminUser, currentPassword || ""))) {
    throw new Error("Current password is incorrect.");
  }
  if (!newPassword || newPassword.length < 12) {
    throw new Error("New password must be at least 12 characters.");
  }
  if (newPassword !== confirmPassword) {
    throw new Error("New passwords do not match.");
  }
  if (newPassword === currentPassword) {
    throw new Error("New password must be different from the current password.");
  }

  await saveCredentials(await hashPassword(newPassword));
}

async function needsPasswordChange() {
  return config.isDefaultPassword && !(await loadCredentials());
}

async function loadCredentials() {
  try {
    const credentials = JSON.parse(await fs.readFile(CREDENTIALS_PATH, "utf8"));
    return credentials.algorithm === "scrypt" ? credentials : null;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function saveCredentials(credentials) {
  await fs.mkdir(path.dirname(CREDENTIALS_PATH), { recursive: true });
  const tmpPath = `${CREDENTIALS_PATH}.tmp`;
  await fs.writeFile(tmpPath, `${JSON.stringify(credentials, null, 2)}\n`, { mode: 0o600 });
  await fs.rename(tmpPath, CREDENTIALS_PATH);
}

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("base64url");
  const key = await scrypt(password, salt);

  return {
    algorithm: "scrypt",
    salt,
    key,
    updatedAt: new Date().toISOString()
  };
}

async function verifyPassword(password, credentials) {
  const expected = Buffer.from(credentials.key, "base64url");
  const actual = Buffer.from(await scrypt(password, credentials.salt), "base64url");
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function scrypt(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, SCRYPT_KEY_LENGTH, (error, key) => {
      if (error) reject(error);
      else resolve(key.toString("base64url"));
    });
  });
}

module.exports = {
  changeAdminPassword,
  clearLoginCookie,
  createCsrfToken,
  needsPasswordChange,
  requireAuth,
  requireCsrf,
  setLoginCookie,
  verifyAdminCredentials,
  verifyToken
};
