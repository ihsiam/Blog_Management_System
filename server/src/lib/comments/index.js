const defaults = require("../../config/defaults");
const Comment = require("../../model/Comment");
const { notFound } = require("../../utils/error");
const { getCache, setCache, deleteCachePattern } = require("../../utils/cache");

const ARTICLE_COMMENTS_TTL_SECONDS = 60;

/**
 * Drops public comment lists and article payloads that embed comments.
 *
 * @param {string} articleId - Article ID
 * @returns {Promise<void>}
 */
const invalidateArticleCommentCaches = async (articleId) => {
  if (!articleId) {
    return;
  }

  const id = articleId.toString();
  await deleteCachePattern(`article:${id}:comments:*`);
  await deleteCachePattern(`article:${id}:expand:*`);
};

/**
 * Fetch comments for a specific article.
 *
 * - Supports pagination
 * - Filters by status (optional)
 * - Populates author details
 *
 * @param {Object} params
 * @param {string} params.articleID - Article ID
 * @param {number} [params.page] - Page number
 * @param {number} [params.limit] - Items per page
 * @param {string} [params.status] - Comment status filter
 *
 * @returns {Promise<Array<Object>>} List of comments
 */
const getCommentsByArticle = async ({
  articleID,
  page = defaults.page,
  limit = defaults.limit,
  status,
}) => {
  const commentsCacheKey = `article:${articleID}:comments:${page}:${limit}`;

  if (status === "public") {
    const cached = await getCache(commentsCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // build filter
  const filter = { article: articleID };

  if (status) {
    filter.status = status;
  }

  // fetch comments
  const comments = await Comment.find(filter)
    .populate({ path: "author", select: "name" })
    .skip(page * limit - limit)
    .limit(limit);

  const result = comments.map((comment) => comment.toObject());

  if (status === "public") {
    await setCache(commentsCacheKey, result, ARTICLE_COMMENTS_TTL_SECONDS);
  }

  return result;
};

/**
 * Fetch all comments.
 *
 * - Supports filtering by article and status
 * - Supports sorting
 * - Supports pagination
 *
 * @param {Object} params
 * @param {number} [params.page]
 * @param {number} [params.limit]
 * @param {string} [params.sortKey]
 * @param {string} [params.postId]
 * @param {string} [params.status]
 *
 * @returns {Promise<Array<Object>>}
 */
const getAllComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortKey,
  postId,
  status,
}) => {
  // build filter
  const filter = {};

  if (postId) {
    filter.article = postId;
  }

  if (status) {
    filter.status = status;
  }

  const comments = await Comment.find(filter)
    .sort(sortKey)
    .skip(page * limit - limit)
    .limit(limit);

  return comments.map((c) => c.toObject());
};

/**
 * Count comments based on filter.
 *
 * @param {Object} params
 * @param {string} [params.article] - Article ID filter
 * @param {string} [params.status] - Comment status filter
 *
 * @returns {Promise<number>} Total count
 */
const count = async ({ article, status }) => {
  const countCacheKey = `article:${article}:comments:count`;

  if (article && status === "public") {
    const cached = await getCache(countCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // build filter
  const filter = {};

  if (article) {
    filter.article = article;
  }

  if (status) {
    filter.status = status;
  }

  const total = await Comment.countDocuments(filter);

  if (article && status === "public") {
    await setCache(countCacheKey, total, ARTICLE_COMMENTS_TTL_SECONDS);
  }

  return total;
};

/**
 * Creates a new comment.
 *
 * @param {Object} params
 * @param {string} params.articleID - Article ID
 * @param {string} params.body - Comment content
 * @param {string} [params.status] - Comment status
 * @param {string} params.author - User ID
 *
 * @returns {Promise<Object>} Created comment
 */
const create = async ({
  articleID,
  body,
  status = defaults.commentStatus,
  author,
}) => {
  const comment = new Comment({
    body,
    status,
    article: articleID,
    author,
  });

  await comment.save();

  await invalidateArticleCommentCaches(articleID);

  return comment.toObject();
};

/**
 * Updates a comment.
 *
 * @param {Object} params
 * @param {string} params.id - Comment ID
 * @param {string} [params.body] - Updated body
 * @param {string} [params.status] - Updated status
 *
 * @returns {Promise<Object>} Updated comment
 * @throws {Error} NotFound if comment does not exist
 */
const updateComment = async ({ id, body, status }) => {
  // find comment
  const comment = await Comment.findById(id);

  if (!comment) {
    throw notFound();
  }

  // update data
  if (body !== undefined) comment.body = body;
  if (status !== undefined) comment.status = status;

  await comment.save();

  await invalidateArticleCommentCaches(comment.article);

  return comment.toObject();
};

/**
 * Deletes a comment by ID.
 *
 * @param {string} id - Comment ID
 * @returns {Promise<boolean>} Deletion success flag
 * @throws {Error} NotFound if comment does not exist
 */
const deleteItem = async (id) => {
  // find and delete
  const comment = await Comment.findByIdAndDelete(id);

  if (!comment) {
    throw notFound();
  }

  await invalidateArticleCommentCaches(comment.article);

  return !!comment;
};

/**
 * Deletes multiple comments based on filter.
 *
 * @param {Object} filter - MongoDB filter
 * @returns {Promise<boolean>} Success flag
 */
const deleteMany = async (filter) => {
  const result = await Comment.deleteMany(filter);
  return !!result;
};

/**
 * Checks ownership of a comment.
 *
 * @param {Object} params
 * @param {string} params.resourceId - Comment ID
 * @param {string} params.userId - User ID
 *
 * @returns {Promise<boolean>} Ownership result
 * @throws {Error} NotFound if comment does not exist
 */
const checkOwner = async ({ resourceId, userId }) => {
  const comment = await Comment.findById(resourceId);

  if (!comment) {
    throw notFound();
  }

  return comment.author.toString() === userId.toString();
};

module.exports = {
  getCommentsByArticle,
  getAllComments,
  create,
  count,
  updateComment,
  checkOwner,
  deleteItem,
  deleteMany,
};
