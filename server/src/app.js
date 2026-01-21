const express = require("express");
const applyMiddleware = require("./middleware");
const routes = require("./routes");

// express app
const app = express();

// middlewares
applyMiddleware(app);

// routing
app.use(routes);

// API health
app.get("/health", (req, res) => {
  res.status(200).json({
    health: "ok",
    user: req.user,
  });
});

// error handling
app.use((err, req, res, _next) => {
  // format error
  res.status(err.status || 500).json({
    message: err.message,
    errors: err.errors,
  });
});

module.exports = app;
