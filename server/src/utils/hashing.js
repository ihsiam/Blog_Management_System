const crypto = require("crypto");
const bcrypt = require("bcryptjs");

/**
 * Salt rounds used for bcrypt hashing.
 *
 * Falls back to 10 when `SALT_ROUNDS` is unset or not a valid number.
 */
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

/**
 * Generate a bcrypt hash from plain text.
 *
 * @param {string} plainText - Raw text to hash.
 * @returns {Promise<string>} Bcrypt hash.
 */
const generateHash = (plainText) => bcrypt.hash(plainText, SALT_ROUNDS);

/**
 * Compare plain text against a bcrypt hash.
 *
 * @param {string} plainText - Raw text from the caller.
 * @param {string} hashedText - Stored bcrypt hash.
 * @returns {Promise<boolean>} True when the values match.
 */
const compareHash = (plainText, hashedText) =>
  bcrypt.compare(plainText, hashedText);

/**
 * Generate a deterministic SHA-256 digest from plain text.
 *
 * Use this for high-entropy secrets (refresh tokens, reset tokens) that must
 * be looked up by value.
 *
 * @param {string} plainText - Raw text to hash. Non-string values are converted with `String()`.
 * @returns {string} Hex-encoded SHA-256 digest.
 */
const generateDigest = (plainText) =>
  // Digest is deterministic so the value can be matched with an indexed query
  crypto.createHash("sha256").update(String(plainText)).digest("hex");

module.exports = {
  generateHash,
  compareHash,
  generateDigest,
};
