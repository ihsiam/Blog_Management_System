const express = require("express");
const applyMiddleware = require("./middleware");
const routes = require("./routes");
const { notFound } = require("./utils/error");

// express app
const app = express();

// apply global middlewares
applyMiddleware(app);

// API health
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

// routing
app.use(routes);

// not found routes
app.use((_req, _res, next) => next(notFound("Requested resource not found")));

// error handling
app.use((err, _req, res, _next) => {
  // status code
  const statusCode = err.statusCode || 500;

  console.log(err);

  // response
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
