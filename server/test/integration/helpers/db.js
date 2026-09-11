/**
 * In-memory MongoDB lifecycle helper for integration tests.
 *
 * Uses `mongodb-memory-server` so that:
 * - No production database is ever touched.
 * - Each test suite that opts in gets a clean, isolated MongoDB instance.
 * - The instance is fully torn down after the suite completes.
 *
 * Usage in a test file:
 *
 *   const db = require("../helpers/db");
 *
 *   beforeAll(() => db.connect());
 *   afterEach(() => db.clearCollections());   // optional: reset between tests
 *   afterAll(() => db.disconnect());
 */

const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongod = null;

/**
 * Start an in-memory MongoDB instance and connect Mongoose to it.
 * Sets process.env.DB_URL so that any code that reads it gets the
 * correct URI automatically.
 */
const connect = async () => {
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();

  // Make the URI available to application code that reads this env var.
  process.env.DB_URL = uri;

  await mongoose.connect(uri);
};

/**
 * Disconnect Mongoose and stop the in-memory MongoDB instance.
 */
const disconnect = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
};

/**
 * Delete every document from every collection without dropping the collections
 * themselves. Useful between tests to ensure a clean state.
 */
const clearCollections = async () => {
  const { collections } = mongoose.connection;
  await Promise.all(
    Object.values(collections).map((col) => col.deleteMany({})),
  );
};

module.exports = { connect, disconnect, clearCollections };
