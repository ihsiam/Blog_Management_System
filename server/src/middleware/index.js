const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const swaggerUI = require("swagger-ui-express");
const YAML = require("yamljs");

// Load the API documentation once at startup
const swaggerDocs = YAML.load(`${__dirname}/../../swagger.yaml`);

/**
 * Applies global Express middlewares to the application.
 *
 * This includes:
 * - Security headers using Helmet
 * - JSON body parsing
 * - CORS configuration (supports credentials)
 * - Cookie parsing support

 * - Swagger API documentation setup
 *
 * @param {import("express").Application} app - Express application instance
 *
 * @returns {void}
 */
const applyMiddleware = (app) => {
  // Set secure HTTP response headers
  app.use(helmet());

  // Parse incoming JSON requests.
  app.use(express.json());

  // Enable CORS with credentials support (cookies, auth headers).
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  // Parse cookies from incoming requests.
  app.use(cookieParser());

  // Serve the Swagger UI at /docs
  app.use("/docs", swaggerUI.serve, swaggerUI.setup(swaggerDocs));
};

module.exports = applyMiddleware;
