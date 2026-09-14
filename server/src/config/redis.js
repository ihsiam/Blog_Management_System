const { createClient } = require("redis");

/**
 * Shared Redis client instance.
 *
 * Created during `connectRedis` so unit tests can mock this module
 * without opening a real connection at require-time.
 *
 * @type {import("redis").RedisClientType | null}
 */
let client = null;

/**
 * Establishes a connection to Redis, retrying on failure.
 *
 * Matches the retry style of `src/db/connection.js`: a bounded
 * attempt loop with a delay, plus client-level reconnect after the
 * initial handshake succeeds.
 *
 * @param {number} retries - number of attempts before giving up
 * @param {number} delayMs - delay between retries in milliseconds
 * @returns {Promise<void>}
 *
 * @throws {Error} If REDIS_URL is not defined
 * @throws {Error} If all retry attempts fail
 */
const connectRedis = async (retries = 5, delayMs = 5000) => {
  const { REDIS_URL } = process.env;

  if (!REDIS_URL) {
    throw new Error("REDIS_URL is not defined in environment variables");
  }

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      if (!client) {
        client = createClient({
          url: REDIS_URL,
          socket: {
            reconnectStrategy: (retryCount) => Math.min(retryCount * 50, 2000),
          },
        });

        // handle disconnects after initial successful connection
        client.on("end", () => {
          console.log(
            "Redis disconnected — client will attempt to reconnect automatically",
          );
        });

        client.on("error", (err) => {
          console.error("Redis connection error:", err.message);
        });
      }

      if (!client.isOpen) {
        // eslint-disable-next-line no-await-in-loop
        await client.connect();
      }

      console.log("Redis connected successfully");
      return;
    } catch (err) {
      console.log(
        `Redis connection attempt ${attempt}/${retries} failed: ${err.message}`,
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

/**
 * Returns the shared Redis client, or null when it has not been connected.
 *
 * @returns {import("redis").RedisClientType | null}
 */
const getRedisClient = () => client;

module.exports = {
  connectRedis,
  getRedisClient,
};
