const expressWinston = require("express-winston");
const logger = require("../utils/logger");

/**
 * HTTP request logger middleware
 * Logs all incoming requests with method, status code, and URL
 */
const requestLogger = expressWinston.logger({
  winstonInstance: logger,
  expressFormat: true,
  colorize: false,
  meta: true,

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
});

module.exports = {
  requestLogger,
  errorLogger,
};
