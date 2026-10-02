/** @type {import("jest").Config} */
module.exports = {
  testEnvironment: "node",

  // Pick up only integration test files — unit tests are unaffected.
  testMatch: ["**/test/integration/**/*.test.js"],
  maxWorkers: 1,

  verbose: true,
  clearMocks: true,
  restoreMocks: true,

  // Runs inside every test-worker context before the test file loads.
  // Silences Winston (file/ES transports are already omitted under Jest
  // via JEST_WORKER_ID in src/utils/logger.js).
  setupFiles: ["./test/integration/setup.js"],

  // MongoMemoryServer needs time on first run (binary download + mongod
  // startup). 30 s is generous but ensures reliability across environments.
  testTimeout: 30000,
};
