const mongoose = require("mongoose");
const commentServices = require("../comments");
const articleServices = require("../articles");
const UserServices = require("../user");
const storageService = require("../storage");
const { notFound } = require("../../utils/error");
const defaults = require("../../config/defaults");
const { ARTICLE_STATUS } = require("../../config/constants");
const {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
} = require("../../utils/cache");

// Cache lifetime, in seconds, for the public author profile of an article
const ARTICLE_AUTHOR_TTL_SECONDS = 300;

/**
 * Delete an article, its comments, cover file, and related caches.
 *
 * @param {string} id - Article ID.
 * @returns {Promise<Object|null>} Deleted article, as returned by `articleServices.deleteItem`.
 * @throws {Error} When the article does not exist.
 */
const deleteArticle = async (id) => {
  const session = await mongoose.startSession();
  let deleted;
  let cover;

  try {
    // Remove the article and its comments together or not at all.
    await session.withTransaction(async () => {
      const article = await articleServices.findArticleById(id, session);

      if (!article) throw notFound();

      cover = article.cover_image_url;

      await commentServices.deleteMany({ article_id: article.id }, session);
      deleted = await articleServices.deleteItem(id, session);
    });
  } finally {
    await session.endSession();
  }

  // Remove the file only after the database delete is committed.
  await storageService.removeArticleCover(cover);

  // Clear caches only after the transaction has committed
  await deleteCache(`article:${id}:author`);
  await deleteCachePattern(`article:${id}:expand:*`);
  await deleteCachePattern(`article:${id}:comments:*`);
  await deleteCachePattern("article:list:*");
  await deleteCachePattern("article:count:*");

  return deleted;
};

/**
 * Return paginated comments for an article after a public visibility check.
 *
 * @param {Object} params - Query options.
 * @param {string} params.articleId - Article ID.
 * @param {number} [params.page=defaults.page] - Page number.
 * @param {number} [params.limit=defaults.limit] - Items per page.
 * @param {string} [params.status] - Comment status filter.
 * @returns {Promise<Array<Object>>} Top-level comments with nested replies.
 * @throws {Error} When the article is missing or not publicly visible.
 */
const getCommentByArticle = async ({
  articleId,
  page = defaults.page,
  limit = defaults.limit,
  status,
}) => {
  await articleServices.findSingleItem({ id: articleId });

  return commentServices.getCommentsByArticle({
    articleId,
    page,
    limit,
    status,
  });
};

/**
 * Return a flat, paginated comment list with optional article and status filters.
 *
 * @param {Object} params - Query options.
 * @param {number} [params.page=defaults.page] - Page number.
 * @param {number} [params.limit=defaults.limit] - Items per page.
 * @param {string} [params.sortType=defaults.sortType] - Sort order (`asc` or `desc`). Any value other than `desc` sorts ascending.
 * @param {string} [params.sortBy=defaults.sortBy] - Field to sort by.
 * @param {string} [params.articleId] - Article ID filter.
 * @param {string} [params.status] - Comment status filter.
 * @returns {Promise<Array<Object>>} Mapped comments.
 * @throws {Error} When `articleId` is set but the article does not exist.
 */
const getComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortType = defaults.sortType,
  sortBy = defaults.sortBy,
  articleId,
  status,
}) => {
  // A leading dash makes Mongoose sort in descending order
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  const query = {
    page,
    limit,
    sortKey,
  };

  if (articleId) {
    // Fail early when the filtered article does not exist.
    const article = await articleServices.findArticleById(articleId);

    if (!article) {
      throw notFound();
    }

    query.articleId = articleId;
  }

  if (status) {
    query.status = status;
  }

  return commentServices.getAllComments(query);
};

/**
 * Create a comment on an article after a public visibility check.
 *
 * @param {Object} params - Comment fields.
 * @param {string} params.articleId - Article ID.
 * @param {string} params.body - Comment content.
 * @param {string} [params.status=defaults.commentStatus] - Comment status.
 * @param {string} params.author - Author user ID.
 * @param {string} [params.parentCommentId] - Parent comment ID for replies.
 * @returns {Promise<Object>} Created comment.
 * @throws {Error} When the article is missing or not publicly visible.
 */
const createComment = async ({
  articleId,
  body,
  status = defaults.commentStatus,
  author,
  parentCommentId,
}) => {
  await articleServices.findSingleItem({ id: articleId });

  return commentServices.create({
    articleId,
    body,
    status,
    author,
    parentCommentId,
  });
};

/**
 * Return public author details for a published article.
 *
 * @param {string} articleId - Article ID.
 * @returns {Promise<{id: string, name: string}>} Public author profile.
 * @throws {Error} When the article is missing or not published.
 * @throws {Error} When the author does not exist.
 */
const getArticleAuthor = async (articleId) => {
  const cacheKey = `article:${articleId}:author`;
  const cached = await getCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const article = await articleServices.findArticleById(articleId);

  // Only published articles are public, so other statuses do not expose their author.
  if (!article || article.status !== ARTICLE_STATUS.PUBLISHED) {
    throw notFound("Article not found");
  }

  const user = await UserServices.findUserById(article.author_id);

  if (!user) {
    throw notFound("Author not found");
  }

  const publicAuthor = { id: user.id, name: user.name };

  await setCache(cacheKey, publicAuthor, ARTICLE_AUTHOR_TTL_SECONDS);

  return publicAuthor;
};

/**
 * Delete a user and cascade articles, comments, sessions, and cover files.
 *
 * @param {string} id - User ID.
 * @returns {Promise<boolean>} True when deletion completes.
 * @throws {Error} When the user does not exist.
 * @throws {Error} When the user is the last active administrator.
 */
const deleteUser = async (id) => {
  const session = await mongoose.startSession();
  let articles = [];

  try {
    // Remove the user and all related data together or not at all.
    await session.withTransaction(async () => {
      const user = await UserServices.findUserById(id, session);

      if (!user) {
        throw notFound();
      }

      // The system must always keep one active administrator.
      await UserServices.ensureAnotherActiveAdmin(id, session);

      // get all articles (IDs and covers) by user
      articles = await articleServices.findArticlesByUser(id, session);

      // delete comments on user's articles, with their replies
      await commentServices.deleteWithReplies(
        { article_id: { $in: articles.map((article) => article.id) } },
        session,
      );

      // This also removes replies that other users wrote to these comments.
      await commentServices.deleteWithReplies({ author_id: id }, session);

      // delete user's articles
      await articleServices.deleteMany({ author_id: id }, session);

      // delete user with sessions, OTPs and reset tokens
      await UserServices.deleteItem(id, session);
    });
  } finally {
    await session.endSession();
  }

  // Remove cover files only after the database delete is committed.
  await Promise.all(
    articles.map((article) => storageService.removeArticleCover(article.cover)),
  );

  // Clear caches only after the transaction has committed
  await deleteCachePattern("article:list:*");
  await deleteCachePattern("article:count:*");
  await deleteCachePattern("article:*:author");
  await deleteCachePattern("article:*:expand:*");
  await deleteCachePattern("article:*:comments:*");

  return true;
};

module.exports = {
  deleteArticle,
  getCommentByArticle,
  getComments,
  createComment,
  getArticleAuthor,
  deleteUser,
};
