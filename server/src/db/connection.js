const mongoose = require("mongoose");

/**
 * Establishes a connection to the MongoDB database, retrying on failure.
 *
 * @param {number} retries - number of attempts before giving up
 * @param {number} delayMs - delay between retries in milliseconds
 * @returns {Promise<void>}
 *
 * @throws {Error} If DB_URL is not defined
 * @throws {Error} If all retry attempts fail
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
        serverSelectionTimeoutMS: 5000,
      });
      console.log("Database connected successfully");
      return;
    } catch (err) {
      console.log(
        `DB connection attempt ${attempt}/${retries} failed: ${err.message}`,
      );

      if (attempt === retries) {
        throw err;
      }

      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => {
        setTimeout(resolve, delayMs);
      });
    }
  }
};

// handle disconnects after initial successful connection (e.g. during failover testing)
mongoose.connection.on("disconnected", () => {
  console.log(
    "MongoDB disconnected — mongoose will attempt to reconnect automatically",
  );
});

mongoose.connection.on("error", (err) => {
  console.error("MongoDB connection error:", err.message);
});

module.exports = connectDB;
