const fsSync = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");

process.env.DATA_DIR = fsSync.mkdtempSync(path.join(os.tmpdir(), "demo-deploy-auth-"));
process.env.ADMIN_USER = "admin";
process.env.ADMIN_PASSWORD = "changeme";

const {
  changeAdminPassword,
  createCsrfToken,
  needsPasswordChange,
  requireCsrf,
  setLoginCookie,
  verifyAdminCredentials
} = require("../src/auth");

test("changes the admin password from the default env password", async () => {
  assert.equal(await needsPasswordChange(), true);
  assert.equal(await verifyAdminCredentials("admin", "changeme"), true);

  await changeAdminPassword({
    currentPassword: "changeme",
    newPassword: "better-password",
    confirmPassword: "better-password"
  });

  assert.equal(await needsPasswordChange(), false);
  assert.equal(await verifyAdminCredentials("admin", "changeme"), false);
  assert.equal(await verifyAdminCredentials("admin", "better-password"), true);
});

test("rejects weak or mismatched new passwords", async () => {
  await assert.rejects(
    changeAdminPassword({
      currentPassword: "better-password",
      newPassword: "short",
      confirmPassword: "short"
    }),
    /at least 12 characters/
  );

  await assert.rejects(
    changeAdminPassword({
      currentPassword: "better-password",
      newPassword: "another-password",
      confirmPassword: "different-password"
    }),
    /do not match/
  );
});

test("binds protected form tokens to the signed login session", () => {
  let cookie;
  setLoginCookie({
    setHeader(name, value) {
      assert.equal(name, "Set-Cookie");
      cookie = value.split(";")[0];
    }
  });

  const request = {
    headers: { cookie },
    method: "POST",
    body: {}
  };
  const token = createCsrfToken(request);
  let nextCalls = 0;
  let csrfError;
  const response = {};
  const next = (error) => {
    if (error) csrfError = error;
    else nextCalls += 1;
  };

  request.body._csrf = token;
  requireCsrf(request, response, next);
  assert.equal(nextCalls, 1);

  request.body._csrf = `${token}tampered`;
  requireCsrf(request, response, next);
  assert.equal(nextCalls, 1);
  assert.equal(csrfError.status, 403);
});
