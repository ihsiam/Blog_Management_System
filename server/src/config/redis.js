const { createClient } = require("redis");
const logger = require("../utils/logger");

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
 * Establish a connection to Redis, retrying on failure.
 *
 * Reads the connection URL from the `REDIS_URL` environment variable. The
 * client is created once and reused across attempts. On the last failed
 * attempt, the original connection error is rethrown.
 *
 * @param {number} [retries=5] - Number of connection attempts before giving up.
 * @param {number} [delayMs=5000] - Delay between retries, in milliseconds.
 * @returns {Promise<void>} Resolves once the client is connected.
 * @throws {Error} When REDIS_URL is missing or every retry fails.
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
            // Back off by 50 ms per retry, capped at 2000 ms.
            reconnectStrategy: (retryCount) => Math.min(retryCount * 50, 2000),
          },
        });

        // Reconnect is handled by the Redis client after an initial success.
        client.on("end", () => {
          logger.warn(
            "Redis disconnected — client will attempt to reconnect automatically",
          );
        });

        client.on("error", (err) => {
          logger.error("Redis connection error", { message: err.message });
        });
      }

      // Skip connecting when a previous attempt already opened the client.
      if (!client.isOpen) {
        // eslint-disable-next-line no-await-in-loop
        await client.connect();
      }

      logger.info("Redis connected successfully");
      return;
    } catch (err) {
      logger.warn(
        `Redis connection attempt ${attempt}/${retries} failed: ${err.message}`,
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

/**
 * Return the shared Redis client, or null when it has not been connected.
 *
 * @returns {import("redis").RedisClientType | null} Shared client, or null.
 */
const getRedisClient = () => client;

module.exports = {
  connectRedis,
  getRedisClient,
};
