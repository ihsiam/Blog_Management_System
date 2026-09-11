/**
 * Jest setup file for integration tests — runs inside the test worker
 * context BEFORE each test file.
 *
 * Purpose: silence Winston so express-winston HTTP/error logging does not
 * dump JSON noise into the Jest reporter. File and Elasticsearch transports
 * are already omitted by `src/utils/logger.js` when `JEST_WORKER_ID` is set
 * (they would EACCES against the root-owned `logs/` directory here).
 *
 * Because Jest gives every test file its own module registry, requiring
 * the logger here places the SAME instance in the cache that `src/app.js`
 * will later pull from inside the same test file.
 */

const logger = require("../../src/utils/logger");

// Short-circuit all log calls (console transport included) so the suite
// output stays focused on assertions and morgan's concise request lines.
logger.silent = true;
