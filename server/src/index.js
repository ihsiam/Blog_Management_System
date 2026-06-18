/**
 * Application entry point.
 *
 * - Loading environment variables
 * - Connecting to database
 * - Starting HTTP server
 * - Handling global process-level errors
 */

require("dotenv").config();

const http = require("http");
const { connectDB } = require("./db");
const app = require("./app");

// create HTTP server instance from express app
const server = http.createServer(app);

// server port configuration
const PORT = Number(process.env.PORT) || 4000;

/**
 * Handle unhandled promise rejections
 */
process.on("unhandledRejection", (err) => {
  console.log("Unhandled rejection:", err);
});

/**
 * Handle uncaught exceptions
 */
process.on("uncaughtException", (err) => {
  console.log("Uncaught exception:", err);
  process.exit(1);
});

/**
 * Bootstrap function
 */
const main = async () => {
  try {
    // connect to database
    await connectDB();

    /**
     * Handle server-level errors (port already in use, permission issues, etc).
     */
    server.on("error", (err) => {
      console.error("Server failed to start:", err);
      process.exit(1);
    });

    // start HTTP server
    server.listen(PORT, () => {
      console.log("Server is running");
      console.log(`API documentation: ${process.env.APP_URL}/docs`);
    });
  } catch (e) {
    // database connection failure handling
    console.log("DB Connection failed");
    console.log(e.message);
    process.exit(1);
  }
};

// start application
main();
