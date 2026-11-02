/**
 * Initialize the MongoDB replica set on first container start.
 *
 * Idempotent: skips initiate when the replica set already exists.
 */
try {
  rs.status();
  print("Replica set already initialized");
} catch (error) {
  // Rethrow unexpected errors so real failures are not masked.
  if (error.codeName !== "NotYetInitialized") {
    throw error;
  }

  // Give mongo1 a higher priority so it is preferred as primary.
  rs.initiate({
    _id: "rs0",
    members: [
      { _id: 0, host: "mongo1:27017", priority: 2 },
      { _id: 1, host: "mongo2:27017", priority: 1 },
      { _id: 2, host: "mongo3:27017", priority: 1 },
    ],
  });
}
