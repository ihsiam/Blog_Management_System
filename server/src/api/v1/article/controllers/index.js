const findAll = require("./findAll");
const create = require("./create");
const findSingleItem = require("./findSingleItem");
const updateOrCreateItem = require("./updateOrCreateItem");
const updateItemPatch = require("./updateItemPatch");
const deleteItem = require("./deleteItem");
const postCommentOnArticle = require("./postCommentOnArticle");
const getArticleComments = require("./getArticleComments");
const getArticleAuthor = require("./getArticleAuthor");
const getAllByAdmin = require("./getAllByAdmin");

module.exports = {
  findAll,
  create,
  findSingleItem,
  updateOrCreateItem,
  updateItemPatch,
  deleteItem,
  postCommentOnArticle,
  getArticleComments,
  getArticleAuthor,
  getAllByAdmin,
};
