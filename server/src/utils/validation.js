/**
 * Email format accepted by the API.
 *
 * Requires one `@` and a dot in the domain part, with no whitespace anywhere.
 */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * bcrypt ignores everything after this many bytes, so longer passwords
 * would be silently truncated.
 */
const MAX_PASSWORD_BYTES = 72;

/**
 * Normalize an email address for storage and lookup.
 *
 * @param {string} email - Raw email address.
 * @returns {string} Trimmed, lower-cased email.
 */
const normalizeEmail = (email) =>
  // Emails are treated as case-insensitive, so store one canonical form
  String(email).trim().toLowerCase();

/**
 * Return whether a value is a string with a valid email format.
 *
 * Surrounding whitespace is ignored when checking the format.
 *
 * @param {*} email - Value to check.
 * @returns {boolean} True when the value is a valid email address.
 */
const isValidEmail = (email) =>
  typeof email === "string" && EMAIL_PATTERN.test(email.trim());

/**
 * Return whether a password is longer than bcrypt can hash.
 *
 * The length is measured in UTF-8 bytes, not characters.
 *
 * @param {string} password - Plain-text password.
 * @returns {boolean} True when the password exceeds the byte limit.
 */
const isPasswordTooLong = (password) =>
  Buffer.byteLength(password, "utf8") > MAX_PASSWORD_BYTES;

module.exports = {
  normalizeEmail,
  isValidEmail,
  isPasswordTooLong,
};
