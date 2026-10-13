const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const swaggerUI = require("swagger-ui-express");
const YAML = require("yamljs");
const morgan = require("morgan");
const path = require("path");

const swaggerDocs = YAML.load(path.join(__dirname, "../../swagger.yaml"));

/**
 * Applies global Express middlewares to the application.
 *
 * This includes:
 * - Security headers using Helmet
 * - JSON body parsing
 * - CORS configuration (supports credentials)
 * - Cookie parsing support
 * - HTTP request logging
 * - Static upload serving during development
 * - Swagger API documentation setup
 *
 * @param {import("express").Application} app - Express application instance
 *
 * @returns {void}
 */
const applyMiddleware = (app) => {
  // Apply security-related HTTP headers.
  app.use(helmet());

  // Parse incoming JSON requests.
  app.use(express.json());

  // Serve locally stored article cover uploads during development.
  app.use("/uploads", express.static(path.join(__dirname, "../../uploads")));

  // Enable CORS with credentials support (cookies, auth headers).
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  // Parse cookies from incoming requests.
  app.use(cookieParser());

  // HTTP request logging for debugging and monitoring.
  app.use(morgan("dev"));

  // API documentation endpoint.
  app.use("/docs", swaggerUI.serve, swaggerUI.setup(swaggerDocs));
};

module.exports = applyMiddleware;
