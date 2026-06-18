const mongoose = require("mongoose");

/**
 * Establishes a connection to the MongoDB database.
 *
 * @returns {Promise<void>}
 *
 * @throws {Error} If DB_URL is not defined
 * @throws {Error} If database connection fails
 */
const connectDB = async () => {
  // extract database connection string
  const { DB_URL } = process.env;

  // ensure database url exists
  if (!DB_URL) {
    throw new Error("DB_URL is not defined in environment variables");
  }

  // connect to mongodb
  await mongoose.connect(DB_URL, {});

  // log successful connection
  console.log("Database connected successfully");
};

module.exports = connectDB;
