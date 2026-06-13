const commentServices = require("../comments");
const articleServices = require("../articles");
const UserServices = require("../user");
const { notFound, badRequest } = require("../../utils/error");
const defaults = require("../../config/defaults");

/**
 * Delete an article and all related data (comments)
 *
 * @param {string} id - Article ID
 * @returns {Promise<boolean>}
 */
const deleteArticle = async (id) => {
  // find article
  const article = await articleServices.findArticleById(id);

  // if not found
  if (!article) {
    throw notFound();
  }

  // delete all comments of this article
  await commentServices.deleteMany({ article: article.id });

  // delete article itself
  return articleServices.deleteItem(id);
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
  const article = await articleServices.findArticleById(articleID);

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
}) => {
  // validate article exists
  const article = await articleServices.findArticleById(articleID);

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
  });
};

/**
 * Get article author
 *
 * @param {string} articleID
 */
const getArticleAuthor = async (articleID) => {
  // find article
  const article = await articleServices.findSingleItem({ id: articleID });

  // find author
  const user = await UserServices.findUserById(article.author);

  return user;
};

/**
 * Delete user and all related data
 *
 * @param {string} id
 */
const deleteUser = async (id) => {
  // check user exists
  const user = await UserServices.findUserById(id);

  if (!user) {
    throw notFound();
  }

  // get all article IDs by user
  const articleIds = await articleServices.findArticlesByUser(id);

  // delete comments on user's articles
  await commentServices.deleteMany({ article: { $in: articleIds } });

  // delete user's own comments
  await commentServices.deleteMany({ author: id });

  // delete user's articles
  await articleServices.deleteMany({ author: id });

  // delete user
  await UserServices.deleteItem(id);

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
