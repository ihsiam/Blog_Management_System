const commentServices = require("../comments");
const articleServices = require("../articles");
const UserServices = require("../user");
const { notFound, badRequest } = require("../../utils/error");
const defaults = require("../../config/defaults");

// delete article and it's associates
const deleteArticle = async (id) => {
  // find article
  const article = await articleServices.findArticleById(id);

  // if not found
  if (!article) {
    throw notFound();
  }

  // delete article related comments
  await commentServices.deleteMany({ article: article.id });

  // delete comment
  return articleServices.deleteItem(id);
};

const getCommentByArticle = async ({
  articleID,
  page = defaults.page,
  limit = defaults.limit,
  status,
}) => {
  const article = await articleServices.findArticleById(articleID);

  if (!article) {
    throw notFound();
  }

  const comments = await commentServices.getCommentsByArticle({
    articleID,
    page,
    limit,
    status,
  });

  return comments;
};

const getComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortType = defaults.sortType,
  sortBy = defaults.sortBy,
  postId,
  status,
}) => {
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  const query = {
    page,
    limit,
    sortKey,
  };

  if (postId) {
    const article = await articleServices.findArticleById(postId);

    if (!article) {
      throw notFound();
    }

    query.postId = postId;
  }

  if (status) {
    query.status = status;
  }

  return commentServices.getAllComments(query);
};

// create comment
const createComment = async ({
  articleID,
  body,
  status = defaults.commentStatus,
  author,
}) => {
  // find article with id
  const article = await articleServices.findArticleById(articleID);

  // if article not found
  if (!article) {
    throw badRequest(
      [{ field: "id", message: "invalid id", in: "params" }],
      "invalid id",
    );
  }

  // create comment
  const comment = await commentServices.create({
    articleID,
    body,
    status,
    author,
  });

  return comment;
};

// get the author of an article
const getArticleAuthor = async (articleID) => {
  // find article
  const article = await articleServices.findSingleItem({ id: articleID });

  // find user
  const user = await UserServices.findUserById(article.author);

  return user;
};

// delete user and all related data
const deleteUser = async (id) => {
  // check if user exists
  const user = await UserServices.findUserById(id);

  // if not found
  if (!user) {
    throw notFound();
  }

  // find all articles authored by the user
  const articleIds = await articleServices.findArticlesByUser(id);

  // delete all comments on the user's articles (by any user)
  await commentServices.deleteMany({ article: { $in: articleIds } });

  // delete all comments authored by the user (on other articles)
  await commentServices.deleteMany({ author: id });

  // delete all articles authored by the user
  await articleServices.deleteMany({ author: id });

  // delete the user
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
