const expressWinston = require("express-winston");
const logger = require("../utils/logger");

// Request headers that must never reach log files or Elasticsearch,
// because they carry access tokens and refresh/reset token cookies.
const SENSITIVE_HEADERS = ["authorization", "cookie", "set-cookie"];

// Winston middleware that logs every HTTP request.
const requestLogger = expressWinston.logger({
  winstonInstance: logger,
  expressFormat: true,
  colorize: false,
  meta: true,
  headerBlacklist: SENSITIVE_HEADERS,

  // Custom log message format.
  msg: "HTTP {{req.method}} {{res.statusCode}} {{req.url}}",
});

// Winston middleware that logs errors passed to `next(err)`, then forwards them
const errorLogger = expressWinston.errorLogger({
  winstonInstance: logger,
  meta: true,
  headerBlacklist: SENSITIVE_HEADERS,
});

module.exports = {
  requestLogger,
  errorLogger,
};
