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
  const filter = { article_id: articleID };

  if (status) {
    filter.status = status;
  }

  const comments = await Comment.find(filter)
    .populate({ path: "author_id", select: "name" })
    .sort({ createdAt: 1 });

  const nodes = comments.map((comment) => {
    const object = comment.toObject();
    const { author_id, article_id, status, parent_comment_id, ...rest } =
      object;

    return {
      ...rest,
      parentCommentId: parent_comment_id || null,
      author: author_id ? { id: author_id.id, name: author_id.name } : null,
      replies: [],
    };
  });
  const nodeMap = new Map(nodes.map((comment) => [comment.id, comment]));
  const roots = [];

  nodes.forEach((comment) => {
    if (comment.parentCommentId) {
      const parent = nodeMap.get(comment.parentCommentId.toString());
      if (parent) parent.replies.push(comment);
    } else {
      roots.push(comment);
    }
  });

  const stripInternalFields = (comment) => {
    const { parentCommentId, parent_comment_id, ...rest } = comment;
    return {
      ...rest,
      replies: Array.isArray(comment.replies)
        ? comment.replies.map(stripInternalFields)
        : [],
    };
  };

  const result = roots
    .slice(page * limit - limit, page * limit)
    .map(stripInternalFields);

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
    filter.article_id = postId;
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
const count = async ({ article, status, topLevel = false }) => {
  const countCacheKey = `article:${article}:comments:count:${topLevel}`;

  if (article && status === "public") {
    const cached = await getCache(countCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // build filter
  const filter = {};

  if (article) {
    filter.article_id = article;
  }

  if (status) {
    filter.status = status;
  }
  if (topLevel) {
    filter.parent_comment_id = null;
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
  parentCommentId = null,
}) => {
  if (parentCommentId) {
    const parentComment = await Comment.findOne({
      _id: parentCommentId,
      article_id: articleID,
    });

    if (!parentComment) throw notFound("Comment not found");
  }

  const comment = new Comment({
    body,
    status,
    article_id: articleID,
    author_id: author,
    parent_comment_id: parentCommentId,
  });

  await comment.save();
  await comment.populate({ path: "author_id", select: "name" });

  await invalidateArticleCommentCaches(articleID);

  const object = comment.toObject();
  const { author_id, article_id, parent_comment_id, ...rest } = object;

  return {
    ...rest,
    article: article_id,
    author: author_id ? { id: author_id.id, name: author_id.name } : null,
    parentCommentId: parent_comment_id || null,
  };
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

  await invalidateArticleCommentCaches(comment.article_id);

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

  await invalidateArticleCommentCaches(comment.article_id);

  return !!comment;
};

/**
 * Deletes multiple comments based on filter.
 *
 * @param {Object} filter - MongoDB filter
 * @returns {Promise<boolean>} Success flag
 */
const deleteMany = async (filter, session) => {
  const mappedFilter = { ...filter };

  if (mappedFilter.article !== undefined) {
    mappedFilter.article_id = mappedFilter.article;
    delete mappedFilter.article;
  }
  if (mappedFilter.author !== undefined) {
    mappedFilter.author_id = mappedFilter.author;
    delete mappedFilter.author;
  }

  const result = await Comment.deleteMany(
    mappedFilter,
    session ? { session } : undefined,
  );
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

  return comment.author_id.toString() === userId.toString();
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
