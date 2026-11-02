/**
 * Application entry point.
 *
 * Loads environment variables, connects to MongoDB and Redis, starts the
 * HTTP server, and registers process-level error handlers.
 */

require("dotenv").config();

const http = require("http");
const { connectDB } = require("./db");
const { connectRedis } = require("./config/redis");
const app = require("./app");
const logger = require("./utils/logger");

// create HTTP server instance from express app
const server = http.createServer(app);

// Fall back to 3000 when PORT is unset or not a valid number.
const PORT = Number(process.env.PORT) || 3000;

/**
 * Log an unhandled promise rejection and terminate the process.
 *
 * @param {Error} err - Rejected error.
 */
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled rejection", {
    message: err?.message,
    stack: err?.stack,
  });
  process.exit(1);
});

/**
 * Log an uncaught exception and terminate the process.
 *
 * @param {Error} err - Uncaught error.
 */
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

/**
 * Connect to MongoDB and Redis, then start listening for HTTP requests.
 *
 * @returns {Promise<void>} Resolves after the server has been asked to listen.
 */
const main = async () => {
  try {
    await connectDB();

    await connectRedis();

    /**
     * Log a listen failure (port in use, permissions) and terminate.
     *
     * @param {NodeJS.ErrnoException} err - Server error.
     */
    server.on("error", (err) => {
      logger.error("Server failed to start", { message: err.message });
      process.exit(1);
    });

    server.listen(PORT, () => {
      logger.info("Server is running", { port: PORT });
      logger.info(`API documentation: ${process.env.APP_URL}/docs`);
    });
  } catch (e) {
    // database / Redis connection failure handling
    logger.error("Startup failed", { message: e.message });
    process.exit(1);
  }
};

// start application
main();
