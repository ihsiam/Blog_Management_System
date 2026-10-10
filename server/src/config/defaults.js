const config = {
  page: 1,
  limit: 10,
  totalItems: 0,
  sortType: "desc",
  sortBy: "createdAt",
  searchTerm: "",
  body: "",
  cover: "",
  articleStatus: "published",
  commentStatus: "public",
  otpMaxAttempts: 5,
};

module.exports = Object.freeze(config);
