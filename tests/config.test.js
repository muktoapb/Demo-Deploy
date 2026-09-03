const test = require("node:test");
const assert = require("node:assert/strict");
const {
  isValidBaseDomain,
  normalizeDomain,
  parsePositiveInteger,
  validateConfig
} = require("../src/config");

function configuration(overrides = {}) {
  return {
    adminUser: "admin",
    adminPassword: "a-strong-password",
    baseDomain: "demos.example.com",
    maxUploadMb: 100,
    port: 3000,
    publicProtocol: "https",
    sessionSecret: "a-random-session-secret-with-32-characters",
    ...overrides
  };
}

test("normalizes configured base domains", () => {
  assert.equal(normalizeDomain("https://Demos.Example.com/path"), "demos.example.com");
  assert.equal(isValidBaseDomain("demos.example.com"), true);
  assert.equal(isValidBaseDomain("bad_domain"), false);
});

test("accepts positive numeric settings and rejects invalid values", () => {
  assert.equal(parsePositiveInteger("3000", "PORT"), 3000);
  assert.throws(() => parsePositiveInteger("3.5", "PORT"), /positive integer/);
  assert.throws(() => validateConfig(configuration({ maxUploadMb: 2048 })), /1024 or lower/);
});

test("requires strong credentials for public domains", () => {
  assert.throws(
    () => validateConfig(configuration({ adminPassword: "changeme" })),
    /ADMIN_PASSWORD/
  );
  assert.throws(
    () => validateConfig(configuration({ sessionSecret: "short" })),
    /SESSION_SECRET/
  );
  assert.doesNotThrow(() => validateConfig(configuration()));
  assert.doesNotThrow(() => validateConfig(configuration({
    baseDomain: "localhost",
    adminPassword: "changeme",
    publicProtocol: "http",
    sessionSecret: "short"
  })));
});
