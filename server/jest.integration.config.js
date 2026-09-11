/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",

  // Pick up only integration test files — unit tests are unaffected.
  testMatch: ["**/test/integration/**/*.test.js"],

  verbose: true,
  clearMocks: true,
  restoreMocks: true,

  // Runs inside every test-worker context before the test file loads.
  // Silences Winston (file/ES transports are already omitted under Jest
  // via JEST_WORKER_ID in src/utils/logger.js).
  setupFiles: ["./test/integration/setup.js"],

  // Integration tests talk to real async infrastructure (MongoMemoryServer,
  // real Express app). The ElasticsearchTransport keeps undici connection-pool
  // handles alive after the tests complete; forceExit is the pragmatic,
  // commonly accepted solution for integration suites that include third-party
  // logging infrastructure not under test control.
  forceExit: true,

  // MongoMemoryServer needs time on first run (binary download + mongod
  // startup). 30 s is generous but ensures reliability across environments.
  testTimeout: 30000,
};
