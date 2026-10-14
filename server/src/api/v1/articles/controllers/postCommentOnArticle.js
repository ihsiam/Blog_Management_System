const mongoose = require("mongoose");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const serviceRegistry = require("../../../../lib/serviceRegistry");
const { mapComment } = require("../../../../utils/mappers");

/**
 * Creates a new comment on an article.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 *
 * @param {Object} req.body - Request body
 * @param {string} req.body.body - Comment text content
 *
 * @param {Object} req.user - Authenticated user (from auth middleware)
 * @param {string} req.user.id - User ID of comment author
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends created comment response
 */
const postCommentOnArticle = async (req, res, next) => {
  try {
    // extract article id from route params
    const { id: articleId } = req.params;

    // extract authenticated user id
    const author = req.user.id;

    // extract comment body
    const { body } = req.body;

    // default comment status from system config
    const status = defaults.commentStatus;

    // collect validation errors
    const errors = [];

    // validate id
    if (!articleId || !mongoose.Types.ObjectId.isValid(articleId)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // validate comment body
    if (!body || typeof body !== "string" || !body.trim()) {
      errors.push({ field: "body", message: "invalid input", in: "body" });
    }

    // throw validation error if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // create comment via service layer
    const comment = await serviceRegistry.createComment({
      articleId,
      body,
      status,
      author,
    });

    // response
    return res.status(201).json({
      code: 201,
      message: "Comment posted",
      data: mapComment(comment),
      links: {
        self: `/api/v1/articles/${articleId}/comments`,
        article: `/api/v1/articles/${articleId}`,
      },
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = postCommentOnArticle;
