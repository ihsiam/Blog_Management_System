/**
 * Email format accepted by the API.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * bcrypt ignores everything after this many bytes, so longer passwords
 * would be silently truncated.
 */
const MAX_PASSWORD_BYTES = 72;

/**
 * Normalizes an email address for storage and lookup.
 *
 * @param {string} email - Raw email address
 *
 * @returns {string} Trimmed, lower-cased email address
 */
const normalizeEmail = (email) =>
  // emails are case-insensitive in practice, so store one canonical form
  String(email).trim().toLowerCase();

/**
 * Checks that a value is a string with a valid email format.
 *
 * @param {*} email - Value to check
 *
 * @returns {boolean} True when the value is a valid email address
 */
const isValidEmail = (email) =>
  typeof email === "string" && EMAIL_PATTERN.test(email.trim());

/**
 * Checks whether a password is longer than bcrypt can hash.
 *
 * @param {string} password - Plain text password
 *
 * @returns {boolean} True when the password exceeds the byte limit
 */
const isPasswordTooLong = (password) =>
  Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES;

module.exports = {
  normalizeEmail,
  isValidEmail,
  isPasswordTooLong,
};
