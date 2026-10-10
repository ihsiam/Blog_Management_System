const crypto = require("crypto");
const bcrypt = require("bcryptjs");

/**
 * Salt rounds used for bcrypt hashing.
 */
const SALT_ROUNDS = Number(process.env.SALT_ROUNDS) || 10;

/**
 * Generates a bcrypt hash from plain text.
 *
 * @param {string} plainText - Raw text to be hashed
 *
 * @returns {Promise<string>} Generated bcrypt hash
 */
const generateHash = (plainText) =>
  // generate secure hash using configured salt rounds
  bcrypt.hash(plainText, SALT_ROUNDS);

/**
 * Compares plain text against a bcrypt hash.
 *
 * @param {string} plainText - Raw text provided by user
 * @param {string} hashedText - Previously generated bcrypt hash
 *
 * @returns {Promise<boolean>} Returns true if values match
 */
const compareHash = (plainText, hashedText) =>
  // compare raw text with stored hash
  bcrypt.compare(plainText, hashedText);

/**
 * Generates a deterministic SHA-256 digest from plain text.
 *
 * Use this for high-entropy secrets (refresh tokens, reset tokens) that must
 * be looked up by value. bcrypt is unsuitable there: it is salted (no
 * equality lookup) and ignores everything past 72 bytes.
 *
 * @param {string} plainText - Raw text to be hashed
 *
 * @returns {string} Hex encoded SHA-256 digest
 */
const generateDigest = (plainText) =>
  // deterministic digest so the value can be matched with an indexed query
  crypto.createHash("sha256").update(String(plainText)).digest("hex");

module.exports = {
  generateHash,
  compareHash,
  generateDigest,
};
