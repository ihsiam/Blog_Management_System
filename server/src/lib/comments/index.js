const mongoose = require("mongoose");
const defaults = require("../../config/defaults");
const { COMMENT_STATUS } = require("../../config/constants");
const Comment = require("../../model/Comment");
const { notFound } = require("../../utils/error");
const { getCache, setCache, deleteCachePattern } = require("../../utils/cache");
const { mapComment } = require("../../utils/mappers");

const ARTICLE_COMMENTS_TTL_SECONDS = 60;

/**
 * Populates the author name on a comment document.
 *
 * @param {Object} comment - Comment document
 * @returns {Promise<Object>} The same document with `author_id` populated
 */
const populateAuthor = (comment) =>
  comment.populate({ path: "author_id", select: "name" });

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
 * Fetch comments for a specific article as a nested tree.
 *
 * - Supports pagination of top-level comments
 * - Filters by status (optional)
 * - Populates author details
 *
 * @param {Object} params
 * @param {string} params.articleId - Article ID
 * @param {number} [params.page] - Page number
 * @param {number} [params.limit] - Items per page
 * @param {string} [params.status] - Comment status filter
 *
 * @returns {Promise<Array<Object>>} List of top-level comments with replies
 */
const getCommentsByArticle = async ({
  articleId,
  page = defaults.page,
  limit = defaults.limit,
  status,
}) => {
  const cacheable = status === COMMENT_STATUS.PUBLIC;
  const commentsCacheKey = `article:${articleId}:comments:${page}:${limit}`;

  if (cacheable) {
    const cached = await getCache(commentsCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // build filter
  const filter = { article_id: articleId };

  if (status) {
    filter.status = status;
  }

  const comments = await Comment.find(filter)
    .populate({ path: "author_id", select: "name" })
    .sort({ createdAt: 1 });

  const nodes = comments.map((comment) => ({
    ...mapComment(comment),
    replies: [],
  }));

  // keys are strings so parent lookups match ObjectId values
  const nodeMap = new Map(nodes.map((node) => [node.id.toString(), node]));
  const roots = [];

  nodes.forEach((node) => {
    if (node.parentCommentId) {
      const parent = nodeMap.get(node.parentCommentId.toString());
      if (parent) parent.replies.push(node);
    } else {
      roots.push(node);
    }
  });

  const stripInternalFields = (node) => {
    const rest = { ...node };
    delete rest.parentCommentId;

    return {
      ...rest,
      replies: rest.replies.map(stripInternalFields),
    };
  };

  const result = roots
    .slice(page * limit - limit, page * limit)
    .map(stripInternalFields);

  if (cacheable) {
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
 * @param {string} [params.articleId]
 * @param {string} [params.status]
 *
 * @returns {Promise<Array<Object>>}
 */
const getAllComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortKey,
  articleId,
  status,
}) => {
  // build filter
  const filter = {};

  if (articleId) {
    filter.article_id = articleId;
  }

  if (status) {
    filter.status = status;
  }

  const comments = await Comment.find(filter)
    .populate({ path: "author_id", select: "name" })
    .sort(sortKey)
    .skip(page * limit - limit)
    .limit(limit);

  return comments.map(mapComment);
};

/**
 * Count comments based on filter.
 *
 * @param {Object} params
 * @param {string} [params.articleId] - Article ID filter
 * @param {string} [params.status] - Comment status filter
 * @param {boolean} [params.topLevel] - Count only top-level comments
 *
 * @returns {Promise<number>} Total count
 */
const count = async ({ articleId, status, topLevel = false }) => {
  const cacheable = articleId && status === COMMENT_STATUS.PUBLIC;
  const countCacheKey = `article:${articleId}:comments:count:${topLevel}`;

  if (cacheable) {
    const cached = await getCache(countCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // build filter
  const filter = {};

  if (articleId) {
    filter.article_id = articleId;
  }

  if (status) {
    filter.status = status;
  }
  if (topLevel) {
    filter.parent_comment_id = null;
  }

  const total = await Comment.countDocuments(filter);

  if (cacheable) {
    await setCache(countCacheKey, total, ARTICLE_COMMENTS_TTL_SECONDS);
  }

  return total;
};

/**
 * Creates a new comment.
 *
 * @param {Object} params
 * @param {string} params.articleId - Article ID
 * @param {string} params.body - Comment content
 * @param {string} [params.status] - Comment status
 * @param {string} params.author - User ID
 * @param {string} [params.parentCommentId] - Parent comment ID for replies
 *
 * @returns {Promise<Object>} Created comment
 */
const create = async ({
  articleId,
  body,
  status = defaults.commentStatus,
  author,
  parentCommentId = null,
}) => {
  if (parentCommentId) {
    // replies are only allowed on visible comments of the same article
    const parentComment = await Comment.findOne({
      _id: parentCommentId,
      article_id: articleId,
      status: COMMENT_STATUS.PUBLIC,
    });

    if (!parentComment) throw notFound("Comment not found");
  }

  const comment = new Comment({
    body,
    status,
    article_id: articleId,
    author_id: author,
    parent_comment_id: parentCommentId,
  });

  await comment.save();
  await populateAuthor(comment);

  await invalidateArticleCommentCaches(articleId);

  return mapComment(comment);
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
  await populateAuthor(comment);

  await invalidateArticleCommentCaches(comment.article_id);

  return mapComment(comment);
};

/**
 * Updates a comment visibility status.
 *
 * @param {Object} params
 * @param {string} params.id - Comment ID
 * @param {string} params.status - Comment visibility status
 * @returns {Promise<Object>} Updated comment
 * @throws {Error} NotFound if comment does not exist
 */
const updateStatus = async ({ id, status }) => {
  const comment = await Comment.findById(id);

  if (!comment) {
    throw notFound();
  }

  comment.status = status;

  await comment.save();
  await populateAuthor(comment);

  await invalidateArticleCommentCaches(comment.article_id);

  return mapComment(comment);
};

/**
 * Collects the given comment IDs plus the IDs of all their nested replies.
 *
 * Walks the reply tree one level per query instead of one query per comment.
 *
 * @param {Array<ObjectId>} rootIds - IDs of the top comments
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Array<string>>} Root and reply IDs
 */
const collectCommentTreeIds = async (rootIds, session) => {
  const ids = new Set(rootIds.map((rootId) => rootId.toString()));
  let level = rootIds;

  while (level.length) {
    const query = Comment.find({ parent_comment_id: { $in: level } }).select(
      "_id",
    );
    if (session) query.session(session);

    // eslint-disable-next-line no-await-in-loop
    const children = await query;

    level = children
      .map((child) => child._id)
      .filter((childId) => !ids.has(childId.toString()));
    level.forEach((childId) => ids.add(childId.toString()));
  }

  return [...ids];
};

/**
 * Deletes the comments matching a filter together with all nested replies.
 *
 * @param {Object} filter - MongoDB filter selecting the top comments
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<number>} Number of deleted comments
 */
const deleteWithReplies = async (filter, session) => {
  const query = Comment.find(filter).select("_id");
  if (session) query.session(session);

  const roots = await query;
  const ids = await collectCommentTreeIds(
    roots.map((root) => root._id),
    session,
  );

  const result = await Comment.deleteMany(
    { _id: { $in: ids } },
    session ? { session } : undefined,
  );

  return result.deletedCount;
};

/**
 * Deletes a comment and all of its nested replies.
 *
 * @param {string} id - Comment ID
 * @returns {Promise<boolean>} Deletion success flag
 * @throws {Error} NotFound if comment does not exist
 */
const deleteItem = async (id) => {
  const session = await mongoose.startSession();
  let articleId;

  try {
    // comment and replies are removed together or not at all
    await session.withTransaction(async () => {
      const comment = await Comment.findById(id).session(session);

      if (!comment) {
        throw notFound();
      }

      articleId = comment.article_id;

      await deleteWithReplies({ _id: comment._id }, session);
    });
  } finally {
    await session.endSession();
  }

  await invalidateArticleCommentCaches(articleId);

  return true;
};

/**
 * Deletes multiple comments based on filter.
 *
 * @param {Object} filter - MongoDB filter
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<boolean>} Success flag
 */
const deleteMany = async (filter, session) => {
  const result = await Comment.deleteMany(
    filter,
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
  updateStatus,
  checkOwner,
  deleteItem,
  deleteMany,
  deleteWithReplies,
};
