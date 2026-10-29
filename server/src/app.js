/**
 * Express application: global middleware, routes, health check, 404, and errors.
 */

const express = require("express");

const applyMiddleware = require("./middleware");
const routes = require("./routes");
const { notFound, toHttpError } = require("./utils/error");
const { requestLogger, errorLogger } = require("./middleware/expressWinston");
const setCorrelationID = require("./middleware/setCorrelationID");

// Create Express app instance.
const app = express();

/**
 * Global middleware.
 */
applyMiddleware(app);

// Set the correlation ID before logging so request and error logs include it.
app.use(setCorrelationID);

/**
 * Request logging.
 */
app.use(requestLogger);

/**
 * Health check.
 *
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
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
 * Pass unmatched routes to the error handler as a 404.
 *
 * @param {import("express").Request} _req - Express request.
 * @param {import("express").Response} _res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 */
app.use((_req, _res, next) => {
  next(notFound("Requested resource not found"));
});

// Log errors before the final handler sends the response.
app.use(errorLogger);

/**
 * Send a JSON error body; hide internals on 5xx responses.
 *
 * @param {Error} error - Error passed from upstream middleware.
 * @param {import("express").Request} req - Express request.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} _next - Next middleware (unused; required by Express).
 */
app.use((error, req, res, _next) => {
  // map Multer, Mongoose and duplicate-key errors to 4xx responses
  const err = toHttpError(error);
  // Default to 500 when the error carries no status code.
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

    // Include extra error data only when the error provides it.
    ...(err.data !== undefined && {
      data: err.data,
    }),
  });
});

module.exports = app;
