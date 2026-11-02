const mongoose = require("mongoose");
const defaults = require("../../config/defaults");
const { COMMENT_STATUS } = require("../../config/constants");
const Comment = require("../../model/Comment");
const { notFound } = require("../../utils/error");
const { getCache, setCache, deleteCachePattern } = require("../../utils/cache");
const { mapComment } = require("../../utils/mappers");

// Cache lifetime, in seconds, for public comment lists and counts
const ARTICLE_COMMENTS_TTL_SECONDS = 60;

/**
 * Populate the author name on a comment document.
 *
 * @param {Object} comment - Comment document.
 * @returns {Promise<Object>} The same document with `author_id` populated.
 */
const populateAuthor = (comment) =>
  comment.populate({ path: "author_id", select: "name" });

/**
 * Drop cached comment lists, comment counts, and article payloads that embed comments.
 *
 * @param {string|import("mongoose").Types.ObjectId} articleId - Article ID.
 * @returns {Promise<void>} Resolves when matching cache keys are deleted.
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
 * Fetch comments for an article as a nested tree.
 *
 * @param {Object} params - Query options.
 * @param {string} params.articleId - Article ID.
 * @param {number} [params.page=defaults.page] - Page number.
 * @param {number} [params.limit=defaults.limit] - Items per page.
 * @param {string} [params.status] - Comment status filter.
 * @returns {Promise<Array<Object>>} Top-level comments with nested replies.
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

  // Keys are strings so parent lookups match ObjectId values.
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

  /**
   * Remove tree-building fields from a comment node and its replies.
   *
   * @param {Object} node - Comment node with nested replies.
   * @returns {Object} Copy of the node without `parentCommentId`, with replies cleaned recursively.
   */
  const stripInternalFields = (node) => {
    const rest = { ...node };
    delete rest.parentCommentId;

    return {
      ...rest,
      replies: rest.replies.map(stripInternalFields),
    };
  };

  // Paginate top-level comments only, after the full tree is built
  const result = roots
    .slice(page * limit - limit, page * limit)
    .map(stripInternalFields);

  if (cacheable) {
    await setCache(commentsCacheKey, result, ARTICLE_COMMENTS_TTL_SECONDS);
  }

  return result;
};

/**
 * Fetch a flat, paginated list of comments.
 *
 * @param {Object} params - Query options.
 * @param {number} [params.page=defaults.page] - Page number.
 * @param {number} [params.limit=defaults.limit] - Items per page.
 * @param {string} [params.sortKey] - Mongoose sort key (for example `-createdAt`).
 * @param {string} [params.articleId] - Article ID filter.
 * @param {string} [params.status] - Comment status filter.
 * @returns {Promise<Array<Object>>} Mapped comments.
 */
const getAllComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortKey,
  articleId,
  status,
}) => {
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
 * Count comments matching optional filters.
 *
 * @param {Object} params - Filter options.
 * @param {string} [params.articleId] - Article ID filter.
 * @param {string} [params.status] - Comment status filter.
 * @param {boolean} [params.topLevel=false] - Count only top-level comments when true.
 * @returns {Promise<number>} Matching comment count.
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
 * Create a new comment.
 *
 * @param {Object} params - Comment fields.
 * @param {string} params.articleId - Article ID.
 * @param {string} params.body - Comment content.
 * @param {string} [params.status=defaults.commentStatus] - Comment status.
 * @param {string} params.author - Author user ID.
 * @param {string|null} [params.parentCommentId=null] - Parent comment ID for replies.
 * @returns {Promise<Object>} Created comment.
 * @throws {Error} When the parent comment is missing or not a public comment on the article.
 */
const create = async ({
  articleId,
  body,
  status = defaults.commentStatus,
  author,
  parentCommentId = null,
}) => {
  if (parentCommentId) {
    // Allow replies only to public comments on the same article.
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
 * Update a comment body.
 *
 * @param {Object} params - Fields to update.
 * @param {string} params.id - Comment ID.
 * @param {string} [params.body] - Updated body.
 * @returns {Promise<Object>} Updated comment.
 * @throws {Error} When the comment does not exist.
 */
const updateComment = async ({ id, body }) => {
  const comment = await Comment.findById(id);

  if (!comment) {
    throw notFound();
  }

  if (body !== undefined) comment.body = body;

  await comment.save();
  await populateAuthor(comment);

  await invalidateArticleCommentCaches(comment.article_id);

  return mapComment(comment);
};

/**
 * Update the status of a comment.
 *
 * @param {Object} params - Status update fields.
 * @param {string} params.id - Comment ID.
 * @param {string} params.status - New comment status.
 * @returns {Promise<Object>} Updated comment.
 * @throws {Error} When the comment does not exist.
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
 * Collect the given comment IDs plus the IDs of all nested replies.
 *
 * @param {Array<import("mongoose").Types.ObjectId>} rootIds - IDs of the top comments.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Array<string>>} IDs of the given comments and all nested replies, as strings.
 */
const collectCommentTreeIds = async (rootIds, session) => {
  const ids = new Set(rootIds.map((rootId) => rootId.toString()));
  let level = rootIds;

  while (level.length) {
    const query = Comment.find({ parent_comment_id: { $in: level } }).select(
      "_id",
    );
    if (session) query.session(session);

    // Each level depends on the previous one, so queries must run in sequence
    // eslint-disable-next-line no-await-in-loop
    const children = await query;

    // Skip IDs that were already collected so the walk always ends
    level = children
      .map((child) => child._id)
      .filter((childId) => !ids.has(childId.toString()));
    level.forEach((childId) => ids.add(childId.toString()));
  }

  return [...ids];
};

/**
 * Delete comments matching a filter together with all nested replies.
 *
 * @param {Object} filter - MongoDB filter selecting the top comments.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<number>} Number of deleted comments.
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
 * Delete a comment and all of its nested replies.
 *
 * @param {string} id - Comment ID.
 * @returns {Promise<boolean>} True when deletion completes.
 * @throws {Error} When the comment does not exist.
 */
const deleteItem = async (id) => {
  const session = await mongoose.startSession();
  let articleId;

  try {
    // Comment and replies are removed together or not at all.
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

  // Clear caches only after the transaction has committed
  await invalidateArticleCommentCaches(articleId);

  return true;
};

/**
 * Delete multiple comments matching a filter (without nested replies).
 *
 * @param {Object} filter - MongoDB filter.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<boolean>} True when the delete operation returned a result.
 */
const deleteMany = async (filter, session) => {
  const result = await Comment.deleteMany(
    filter,
    session ? { session } : undefined,
  );
  return !!result;
};

/**
 * Return whether `userId` authored the comment.
 *
 * @param {Object} params - Ownership check fields.
 * @param {string} params.resourceId - Comment ID.
 * @param {string} params.userId - Authenticated user ID.
 * @returns {Promise<boolean>} True when the user is the author.
 * @throws {Error} When the comment does not exist.
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
