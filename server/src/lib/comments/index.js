const defaults = require("../../config/defaults");
const Comment = require("../../model/Comment");
const { notFound } = require("../../utils/error");

// find comments  by article id
const getCommentsByArticle = async ({
  articleID,
  page = defaults.page,
  limit = defaults.limit,
}) => {
  // find comments
  const comments = await Comment.find({ article: articleID }) // filter comment by article id
    .populate({ path: "author", select: "name" }) // populate author
    .skip(page * limit - limit) // skip based on page
    .limit(limit); // retrieved data

  return comments.map((comment) => comment.toObject());
};

// get all comments
const getAllComments = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortKey,
  postId,
}) => {
  // find comments
  const comments = await Comment.find(postId ? { article: postId } : {}) // filter comment by article id
    .sort(sortKey) // sort data
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
  // create comment
  const comment = new Comment({ body, status, article: articleID, author });
  await comment.save();

  return comment.toObject();
};

// update comment
const updateComment = async ({ id, body }) => {
  // find comment
  const comment = await Comment.findById(id);

  // if not found
  if (!comment) {
    throw notFound();
  }

  // update comment
  comment.body = body;
  await comment.save();

  return comment.toObject();
};

// delete comment
const deleteItem = async (id) => {
  // delete
  const comment = await Comment.findByIdAndDelete(id);

  // if not found
  if (!comment) {
    throw notFound();
  }

  return !!comment;
};

// delete many
const deleteMany = async (filter) => {
  // delete multiple comment
  const result = await Comment.deleteMany(filter);

  return !!result;
};

// comment ownership
const checkOwner = async ({ resourceId, userId }) => {
  // find comment
  const comment = await Comment.findById(resourceId);

  // if not found
  if (!comment) {
    throw notFound();
  }

  return comment.author.toString() === userId.toString();
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
