const expressWinston = require("express-winston");
const logger = require("../utils/logger");

/**
 * Request headers that must never reach log files or Elasticsearch,
 * because they carry access tokens and refresh/reset token cookies.
 */
const SENSITIVE_HEADERS = ["authorization", "cookie", "set-cookie"];

/**
 * HTTP request logger middleware
 * Logs all incoming requests with method, status code, and URL
 */
const requestLogger = expressWinston.logger({
  winstonInstance: logger,
  expressFormat: true,
  colorize: false,
  meta: true,
  headerBlacklist: SENSITIVE_HEADERS,

  /**
   * Custom log message format
   */
  msg: "HTTP {{req.method}} {{res.statusCode}} {{req.url}}",
});

/**
 * Error logger middleware
 * Logs only error-level HTTP requests (4xx, 5xx, thrown errors)
 */
const errorLogger = expressWinston.errorLogger({
  winstonInstance: logger,
  meta: true,
  headerBlacklist: SENSITIVE_HEADERS,
});

module.exports = {
  requestLogger,
  errorLogger,
};
