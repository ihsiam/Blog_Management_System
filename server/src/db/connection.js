const mongoose = require("mongoose");
const logger = require("../utils/logger");

// Time to wait for a suitable MongoDB server before failing; defaults to 5000 ms.
const serverSelectionTimeoutMS =
  Number(process.env.MONGOOSE_SERVER_SELECTION_TIMEOUT_MS) || 5000;
// Time Mongoose buffers commands while disconnected before failing; defaults to 10000 ms.
const bufferTimeoutMS = Number(process.env.MONGOOSE_BUFFER_TIMEOUT_MS) || 10000;

mongoose.set("bufferTimeoutMS", bufferTimeoutMS);

/**
 * Establish a connection to MongoDB, retrying on failure.
 *
 * Reads the connection string from the `DB_URL` environment variable. On the
 * last failed attempt, the original connection error is rethrown.
 *
 * @param {number} [retries=5] - Number of connection attempts before giving up.
 * @param {number} [delayMs=5000] - Delay between retries, in milliseconds.
 * @returns {Promise<void>} Resolves once the connection is established.
 * @throws {Error} When DB_URL is missing or every retry fails.
 */
const connectDB = async (retries = 5, delayMs = 5000) => {
  const { DB_URL } = process.env;

  if (!DB_URL) {
    throw new Error("DB_URL is not defined in environment variables");
  }

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await mongoose.connect(DB_URL, {
        serverSelectionTimeoutMS,
      });
      logger.info("Database connected successfully");
      return;
    } catch (err) {
      logger.warn(
        `DB connection attempt ${attempt}/${retries} failed: ${err.message}`,
      );

      // Give up and surface the error after the final attempt.
      if (attempt === retries) {
        throw err;
      }

      // Wait before the next attempt.
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }
};

// Mongoose reconnects automatically after a drop (for example during failover tests).
mongoose.connection.on("disconnected", () => {
  logger.warn(
    "MongoDB disconnected — mongoose will attempt to reconnect automatically",
  );
});

/**
 * Log MongoDB driver errors after the initial connection.
 *
 * @param {Error} err - Connection error.
 */
mongoose.connection.on("error", (err) => {
  logger.error("MongoDB connection error", { message: err.message });
});

module.exports = connectDB;
