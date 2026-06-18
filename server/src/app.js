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

// create express app instance
const app = express();

/**
 * Apply global middlewares
 */
applyMiddleware(app);

/**
 * Health check endpoint
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

/**
 * Application routes
 */
app.use(routes);

/**
 * Handle undefined routes (404)
 */
app.use((_req, _res, next) => next(notFound("Requested resource not found")));

/**
 * Global error handler
 */
app.use((err, _req, res, _next) => {
  // fallback status code
  const statusCode = err.statusCode || 500;

  // log full error internally (debugging purpose)
  console.log(err);

  // structured error response
  res.status(statusCode).json({
    code: statusCode,
    error: err.error || "Internal server error",
    message:
      statusCode === 500
        ? "We are sorry for the inconvenience. Please try again later."
        : err.message,
    ...(err.data && { data: err.data }),
  });
});

module.exports = app;
