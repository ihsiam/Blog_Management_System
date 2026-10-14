/**
 * Application entry point.
 *
 * - Loading environment variables
 * - Connecting to database and Redis
 * - Starting HTTP server
 * - Handling global process-level errors
 */

require("dotenv").config();

const http = require("http");
const { connectDB } = require("./db");
const { connectRedis } = require("./config/redis");
const app = require("./app");
const logger = require("./utils/logger");

// create HTTP server instance from express app
const server = http.createServer(app);

// server port configuration
const PORT = Number(process.env.PORT) || 3000;

/**
 * Handle unhandled promise rejections
 */
process.on("unhandledRejection", (err) => {
  logger.error("Unhandled rejection", {
    message: err?.message,
    stack: err?.stack,
  });
  process.exit(1);
});

/**
 * Handle uncaught exceptions
 */
process.on("uncaughtException", (err) => {
  logger.error("Uncaught exception", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

/**
 * Bootstrap function
 */
const main = async () => {
  try {
    // connect to database
    await connectDB();

    // connect to Redis (cache-aside store)
    await connectRedis();

    /**
     * Handle server-level errors (port already in use, permission issues, etc).
     */
    server.on("error", (err) => {
      logger.error("Server failed to start", { message: err.message });
      process.exit(1);
    });

    // start HTTP server
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
