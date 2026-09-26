/**
 * Main Express application setup.
 *
 * Configures global middleware, routes, health check,
 * 404 handler, and centralized error handler.
 */

const express = require("express");

const applyMiddleware = require("./middleware");
const routes = require("./routes");
const { notFound } = require("./utils/error");
const { requestLogger, errorLogger } = require("./middleware/expressWinston");
const setCorrelationID = require("./middleware/setCorrelationID");

// Create Express app instance.
const app = express();

/**
 * Global middleware.
 */
applyMiddleware(app);

/**
 * Set correlation ID in the request header.
 */
app.use(setCorrelationID);

/**
 * Request logging.
 */
app.use(requestLogger);

/**
 * Health check.
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Application routes.
 */
app.use(routes);

/**
 * 404 handler.
 */
app.use((_req, _res, next) => {
  next(notFound("Requested resource not found"));
});

/**
 * Error logging.
 */
app.use(errorLogger);

/**
 * Global error handler.
 */
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode ?? 500;

  res.status(statusCode).json({
    code: statusCode,

    error:
      statusCode >= 500
        ? "Internal server error"
        : err.error || "Request failed",

    correlationId: req.headers["x-correlation-id"],

    message:
      statusCode >= 500
        ? "We are sorry for the inconvenience. Please try again later."
        : err.message,

    ...(err.data !== undefined && {
      data: err.data,
    }),
  });
});

module.exports = app;
