/**
 * Build a URL query string from an object, omitting null and undefined values.
 *
 * Keys and values are URI-encoded. Array and object values are converted with
 * `String()` before encoding, so they are not expanded into repeated keys.
 *
 * @param {Object} query - Key-value pairs.
 * @returns {string} Encoded query string (for example `page=1&limit=10`).
 */
const generateQueryString = (query) =>
  // remove null/undefined values, encode safely, and join as query string
  Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null)
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
    )
    .join("&");

module.exports = generateQueryString;
