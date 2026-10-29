/**
 * Default pagination, search, sort, and status values for list queries.
 */
const { ARTICLE_STATUS, COMMENT_STATUS } = require("./constants");

/**
 * Default values used across the API.
 *
 * Besides list query settings, this object also holds the empty `body`
 * default and the maximum number of OTP attempts (`otpMaxAttempts`).
 */
const config = {
  page: 1,
  limit: 10,
  // Upper bounds for client-supplied `limit` and search term length.
  maxLimit: 100,
  maxSearchLength: 100,
  totalItems: 0,
  sortType: "desc",
  sortBy: "createdAt",
  searchTerm: "",
  body: "",
  // Lists show only published articles and public comments by default.
  articleStatus: ARTICLE_STATUS.PUBLISHED,
  commentStatus: COMMENT_STATUS.PUBLIC,
  otpMaxAttempts: 5,
};

module.exports = Object.freeze(config);
