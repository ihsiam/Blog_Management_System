const generateQueryString = (query) =>
  Object.keys(query)
    .filter((key) => query[key] !== undefined && query[key] !== null)
    .map(
      (key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`,
    )
    .join("&");

module.exports = generateQueryString;
