const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const swaggerUI = require("swagger-ui-express");
const YAML = require("yamljs");
const morgan = require("morgan");

const swaggerDocs = YAML.load("./swagger.yaml");

/**
 * Applies global Express middlewares to the application.
 *
 * This includes:
 * - JSON body parsing
 * - CORS configuration (supports credentials)
 * - Cookie parsing support
 * - HTTP request logging
 * - Swagger API documentation setup
 *
 * @param {import("express").Application} app - Express application instance
 *
 * @returns {void}
 */
const applyMiddleware = (app) => {
  // Parse incoming JSON requests
  app.use(express.json());

  // Enable CORS with credentials support (cookies, auth headers)
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  // Parse cookies from incoming requests
  app.use(cookieParser());

  // HTTP request logging for debugging and monitoring
  app.use(morgan("dev"));

  // API documentation endpoint
  app.use("/docs", swaggerUI.serve, swaggerUI.setup(swaggerDocs));
};

module.exports = applyMiddleware;
