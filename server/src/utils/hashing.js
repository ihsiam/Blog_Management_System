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

module.exports = {
  generateHash,
  compareHash,
};
