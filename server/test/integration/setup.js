/**
 * Jest setup file for integration tests — runs inside the test worker
 * context BEFORE each test file.
 *
 * Purpose:
 * 1. Provide JWT / hashing / APP_URL env that production loads via dotenv
 *    in src/index.js (which integration tests never boot). Secrets are
 *    test-only values — never the production database URL.
 * 2. Silence Winston so express-winston does not dump JSON into the
 *    Jest reporter. File and Elasticsearch transports are already omitted
 *    by `src/utils/logger.js` when `JEST_WORKER_ID` is set.
 *
 * Because Jest gives every test file its own module registry, requiring
 * the logger here places the SAME instance in the cache that `src/app.js`
 * will later pull from inside the same test file.
 */

// Must be set before any application module reads process.env into
// module-level constants (token CONFIG, SALT_ROUNDS, etc.).
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "integration-test-access-secret";
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET || "integration-test-refresh-secret";
process.env.JWT_ACTIVE_RESET_SECRET =
  process.env.JWT_ACTIVE_RESET_SECRET || "integration-test-active-reset-secret";
process.env.JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
process.env.JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";
process.env.JWT_ACTIVE_RESET_EXPIRES =
  process.env.JWT_ACTIVE_RESET_EXPIRES || "5m";
process.env.APP_URL = process.env.APP_URL || "http://localhost:4000";
// Low cost factor keeps bcrypt-heavy Auth flows fast in CI/local runs.
process.env.SALT_ROUNDS = process.env.SALT_ROUNDS || "4";

const logger = require("../../src/utils/logger");

// Short-circuit all log calls (console transport included) so the suite
// output stays focused on assertions and morgan's concise request lines.
logger.silent = true;
