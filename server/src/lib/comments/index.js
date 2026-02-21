const defaults = require("../../config/defaults");
const Comment = require("../../model/Comment");
const { badRequest, notFound } = require("../../utils/error");
const articleServices = require("../articles");

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
  const comments = await Comment.find({ article: articleID }) // filter comment by article id
    .populate({ path: "author", select: "name" }) // populate author
    .skip(page * limit - limit) // skip based on page
    .limit(limit); // retrieved data

  return comments.map((comment) => comment.toObject());
};

// count comments
const count = async (filter) => {
  // count article
  const totalComments = await Comment.countDocuments(filter);

  return totalComments;
};

// create comment
const create = async ({
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
  const comment = new Comment({ body, status, article: articleID, author });

  await comment.save();

  return comment.toObject();
};

module.exports = { getCommentByArticle, create, count };
