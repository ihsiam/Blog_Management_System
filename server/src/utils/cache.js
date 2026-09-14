const logger = require("./logger");
const { getRedisClient } = require("../config/redis");

/**
 * Resolves an open Redis client, or null when Redis is unavailable.
 *
 * @returns {import("redis").RedisClientType | null}
 */
const getOpenClient = () => {
  const client = getRedisClient();

  if (!client || !client.isOpen) {
    return null;
  }

  return client;
};

/**
 * Reads a JSON value from cache.
 *
 * Fail-open: missing keys, parse errors, and Redis errors all return
 * null so the caller can fall through to the database.
 *
 * @param {string} key - Cache key
 * @returns {Promise<*|null>} Parsed value, or null on miss/error
 */
const getCache = async (key) => {
  try {
    const client = getOpenClient();

    if (!client) {
      logger.info("Cache miss", { key, reason: "redis unavailable" });
      return null;
    }

    const raw = await client.get(key);

    if (raw === null || raw === undefined) {
      logger.info("Cache miss", { key });
      return null;
    }

    const value = JSON.parse(raw);
    logger.info("Cache hit", { key });
    return value;
  } catch (err) {
    logger.error("Cache get error", { key, message: err.message });
    return null;
  }
};

/**
 * Writes a JSON value to cache with a TTL.
 *
 * Fail-open: Redis errors are logged and swallowed so writes to the
 * primary store are never blocked by cache failures.
 *
 * @param {string} key - Cache key
 * @param {*} value - JSON-serializable value
 * @param {number} ttlSeconds - Expiry in seconds
 * @returns {Promise<void>}
 */
const setCache = async (key, value, ttlSeconds) => {
  try {
    const client = getOpenClient();

    if (!client) {
      return;
    }

    await client.setEx(key, ttlSeconds, JSON.stringify(value));
    logger.info("Cache set", { key, ttlSeconds });
  } catch (err) {
    logger.error("Cache set error", { key, message: err.message });
  }
};

/**
 * Deletes a single cache key.
 *
 * @param {string} key - Exact cache key
 * @returns {Promise<void>}
 */
const deleteCache = async (key) => {
  try {
    const client = getOpenClient();

    if (!client) {
      return;
    }

    await client.del(key);
    logger.info("Cache delete", { key });
  } catch (err) {
    logger.error("Cache delete error", { key, message: err.message });
  }
};

/**
 * Deletes all keys matching a glob pattern using SCAN (never KEYS).
 *
 * @param {string} pattern - Redis MATCH glob (e.g. article:list:*)
 * @returns {Promise<void>}
 */
const deleteCachePattern = async (pattern) => {
  try {
    const client = getOpenClient();

    if (!client) {
      return;
    }

    const keys = [];
    const iterator = client.scanIterator({ MATCH: pattern, COUNT: 100 });
    let step = await iterator.next();

    while (!step.done) {
      if (Array.isArray(step.value)) {
        keys.push(...step.value);
      } else {
        keys.push(step.value);
      }
      // eslint-disable-next-line no-await-in-loop
      step = await iterator.next();
    }

    if (keys.length) {
      await client.del(keys);
    }

    logger.info("Cache pattern delete", { pattern, deleted: keys.length });
  } catch (err) {
    logger.error("Cache pattern delete error", {
      pattern,
      message: err.message,
    });
  }
};

module.exports = {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
};
