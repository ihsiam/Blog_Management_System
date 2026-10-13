const mongoose = require("mongoose");
const commentServices = require("../comments");
const articleServices = require("../articles");
const UserServices = require("../user");
const storageService = require("../storage");
const { notFound, badRequest } = require("../../utils/error");
const defaults = require("../../config/defaults");
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

      await commentServices.deleteMany({ article: article.id }, session);
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
 * @param {string} params.articleID
 * @param {number} params.page
 * @param {number} params.limit
 * @param {string} params.status
 */
const getCommentByArticle = async ({
  articleID,
  page = defaults.page,
  limit = defaults.limit,
  status,
}) => {
  // check if article exists
  const article = await articleServices.findSingleItem({ id: articleID });

  if (!article) {
    throw notFound();
  }

  // fetch comments
  return commentServices.getCommentsByArticle({
    articleID,
    page,
    limit,
    status,
  });
};

/**
 * Get all comments
 *
 * @param {Object} params
 */
const getComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortType = defaults.sortType,
  sortBy = defaults.sortBy,
  postId,
  status,
}) => {
  // build sort key
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  const query = {
    page,
    limit,
    sortKey,
  };

  // validate postId if provided
  if (postId) {
    const article = await articleServices.findArticleById(postId);

    if (!article) {
      throw notFound();
    }

    query.postId = postId;
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
 */
const createComment = async ({
  articleID,
  body,
  status = defaults.commentStatus,
  author,
  parentCommentId,
}) => {
  // validate article exists
  const article = await articleServices.findSingleItem({ id: articleID });

  if (!article) {
    throw badRequest(
      [{ field: "id", message: "invalid id", in: "params" }],
      "invalid id",
    );
  }

  // create comment
  return commentServices.create({
    articleID,
    body,
    status,
    author,
    parentCommentId,
  });
};

/**
 * Get article author
 *
 * @param {string} articleID
 */
const getArticleAuthor = async (articleID) => {
  const cacheKey = `article:${articleID}:author`;
  const cached = await getCache(cacheKey);
  if (cached !== null) {
    return cached;
  }

  const article = await articleServices.findArticleById(articleID);

  // drafts are not publicly visible, so their author is not exposed either
  if (!article || article.status !== defaults.articleStatus) {
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
