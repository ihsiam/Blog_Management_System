const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const swaggerUI = require("swagger-ui-express");
const YAML = require("yamljs");
const morgan = require("morgan");

const swaggerDocs = YAML.load("./swagger.yaml");

const applyMiddleware = (app) => {
  app.use(express.json());
  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );
  app.use(cookieParser());
  app.use(morgan("dev"));
  app.use("/docs", swaggerUI.serve, swaggerUI.setup(swaggerDocs));
};

module.exports = applyMiddleware;
