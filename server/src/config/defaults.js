const { ARTICLE_STATUS, COMMENT_STATUS } = require("./constants");

const config = {
  page: 1,
  limit: 10,
  maxLimit: 100,
  maxSearchLength: 100,
  totalItems: 0,
  sortType: "desc",
  sortBy: "createdAt",
  searchTerm: "",
  body: "",
  articleStatus: ARTICLE_STATUS.PUBLISHED,
  commentStatus: COMMENT_STATUS.PUBLIC,
  otpMaxAttempts: 5,
};

module.exports = Object.freeze(config);
