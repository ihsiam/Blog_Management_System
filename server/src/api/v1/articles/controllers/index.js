const findAll = require("./findAll");
const create = require("./create");
const findSingleItem = require("./findSingleItem");
const updateItemPatch = require("./updateItemPatch");
const updateStatus = require("./updateStatus");
const deleteItem = require("./deleteItem");
const postCommentOnArticle = require("./postCommentOnArticle");
const postCommentReply = require("./postCommentReply");
const getArticleComments = require("./getArticleComments");
const getArticleAuthor = require("./getArticleAuthor");
const getAllByAdmin = require("./getAllByAdmin");

module.exports = {
  findAll,
  create,
  findSingleItem,
  updateItemPatch,
  updateStatus,
  deleteItem,
  postCommentOnArticle,
  postCommentReply,
  getArticleComments,
  getArticleAuthor,
  getAllByAdmin,
};
