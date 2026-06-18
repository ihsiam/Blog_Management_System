/**
 * Generates a URL query string from an object.
 *
 * @param {Object} query - Key-value pairs representing query parameters
 *
 * @returns {string} Encoded query string (e.g. "page=1&limit=10")
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
