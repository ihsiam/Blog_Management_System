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

const ARTICLE_AUTHOR_TTL_SECONDS = 300;

/**
 * Delete an article and all related data (comments)
 *
 * @param {string} id - Article ID
 * @returns {Promise<boolean>}
 */
const deleteArticle = async (id) => {
  const session = await mongoose.startSession();
  let deleted;
  let cover;

  try {
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

  // remove the file only after the database delete is committed
  await storageService.removeArticleCover(cover);

  await deleteCache(`article:${id}:author`);
  await deleteCachePattern(`article:${id}:expand:*`);
  await deleteCachePattern(`article:${id}:comments:*`);
  await deleteCachePattern("article:list:*");
  await deleteCachePattern("article:count:*");

  return deleted;
};

/**
 * Get comments of a specific article
 *
 * @param {Object} params
 * @param {string} params.articleId
 * @param {number} params.page
 * @param {number} params.limit
 * @param {string} params.status
 * @throws {Error} NotFound if the article does not exist or is not public
 */
const getCommentByArticle = async ({
  articleId,
  page = defaults.page,
  limit = defaults.limit,
  status,
}) => {
  // check the article exists (throws NotFound otherwise)
  await articleServices.findSingleItem({ id: articleId });

  // fetch comments
  return commentServices.getCommentsByArticle({
    articleId,
    page,
    limit,
    status,
  });
};

/**
 * Get all comments
 *
 * @param {Object} params
 * @param {number} params.page
 * @param {number} params.limit
 * @param {string} params.sortType
 * @param {string} params.sortBy
 * @param {string} [params.articleId]
 * @param {string} [params.status]
 * @throws {Error} NotFound if the article filter points to a missing article
 */
const getComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortType = defaults.sortType,
  sortBy = defaults.sortBy,
  articleId,
  status,
}) => {
  // build sort key
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  const query = {
    page,
    limit,
    sortKey,
  };

  // validate articleId if provided
  if (articleId) {
    const article = await articleServices.findArticleById(articleId);

    if (!article) {
      throw notFound();
    }

    query.articleId = articleId;
  }

  // add status filter
  if (status) {
    query.status = status;
  }

  return commentServices.getAllComments(query);
};

/**
 * Create comment on article
 *
 * @param {Object} params
 * @param {string} params.articleId
 * @param {string} params.body
 * @param {string} [params.status]
 * @param {string} params.author
 * @param {string} [params.parentCommentId]
 * @throws {Error} NotFound if the article does not exist or is not public
 */
const createComment = async ({
  articleId,
  body,
  status = defaults.commentStatus,
  author,
  parentCommentId,
}) => {
  // validate article exists (throws NotFound otherwise)
  await articleServices.findSingleItem({ id: articleId });

  // create comment
  return commentServices.create({
    articleId,
    body,
    status,
    author,
    parentCommentId,
  });
};

/**
 * Get article author
 *
 * @param {string} articleId
 */
const getArticleAuthor = async (articleId) => {
  const cacheKey = `article:${articleId}:author`;
  const cached = await getCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const article = await articleServices.findArticleById(articleId);

  // drafts are not publicly visible, so their author is not exposed either
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
 * Delete user and all related data
 *
 * @param {string} id
 */
const deleteUser = async (id) => {
  const session = await mongoose.startSession();
  let articles = [];

  try {
    // everything is removed together or nothing is
    await session.withTransaction(async () => {
      // check user exists
      const user = await UserServices.findUserById(id, session);

      if (!user) {
        throw notFound();
      }

      // the system must always keep one active administrator
      await UserServices.ensureAnotherActiveAdmin(id, session);

      // get all articles (IDs and covers) by user
      articles = await articleServices.findArticlesByUser(id, session);

      // delete comments on user's articles, with their replies
      await commentServices.deleteWithReplies(
        { article_id: { $in: articles.map((article) => article.id) } },
        session,
      );

      // delete user's own comments, with replies from other users
      await commentServices.deleteWithReplies({ author_id: id }, session);

      // delete user's articles
      await articleServices.deleteMany({ author_id: id }, session);

      // delete user with sessions, OTPs and reset tokens
      await UserServices.deleteItem(id, session);
    });
  } finally {
    await session.endSession();
  }

  // remove cover files only after the database delete is committed
  await Promise.all(
    articles.map((article) => storageService.removeArticleCover(article.cover)),
  );

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
