const commentServices = require("../comments");
const articleServices = require("../articles");
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

// get comment for article
const getCommentByArticle = async ({
  articleID,
  page = defaults.page,
  limit = defaults.limit,
}) => {
  // find article with id
  const article = await articleServices.findArticleById(articleID);

  // if article not found
  if (!article) {
    throw notFound();
  }

  // find comments
  const comments = await commentServices.getCommentsByArticle({
    articleID,
    page,
    limit,
  });

  return comments;
};

// get all comments
const getComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortType = defaults.sortType,
  sortBy = defaults.sortBy,
  postId,
}) => {
  // sort option
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  // prepare query for getting comments
  const query = { page, limit, sortKey };

  // if post id exists
  if (postId) {
    const article = await articleServices.findArticleById(postId);

    // if article not found
    if (!article) {
      throw notFound();
    }

    // add postId into query
    query.postId = postId;
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

module.exports = {
  deleteArticle,
  getCommentByArticle,
  getComments,
  createComment,
};
