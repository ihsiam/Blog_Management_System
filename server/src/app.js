const express = require("express");
const applyMiddleware = require("./middleware");
const routes = require("./routes");
const { notFound } = require("./utils/error");

// express app
const app = express();

// middlewares
applyMiddleware(app);

// routing
app.use(routes);

// API health
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// error response for irrelevant page
app.use((req, _res, next) => next(notFound("Requested resource not found")));

// error handling
app.use((err, req, res, _next) => {
  const statusCode = err.statusCode || 500;

  console.log(err);

  res.status(statusCode).json({
    code: statusCode,
    error: err.error || "Internal server error",
    message:
      err.message ||
      "We are sorry for the inconvenience. Please try again later.",
    ...(err.data && { data: err.data }),
  });
});

module.exports = app;
