const mongoose = require("mongoose");
const defaults = require("../../../../config/defaults");
const serviceRegistry = require("../../../../lib/service registry");
const { badRequest } = require("../../../../utils/error");

/**
 * Creates a reply to an article comment.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.articleId - Article ID
 * @param {string} req.params.commentId - Parent comment ID
 * @param {Object} req.body - Request body
 * @param {string} req.body.body - Reply text
 * @param {Object} req.user - Authenticated user
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends the created reply response
 */
const postCommentReply = async (req, res, next) => {
  try {
    const { articleId, commentId } = req.params;
    const { body } = req.body;
    const errors = [];

    if (!mongoose.Types.ObjectId.isValid(articleId)) {
      errors.push({
        field: "articleId",
        message: "invalid input",
        in: "params",
      });
    }
    if (!mongoose.Types.ObjectId.isValid(commentId)) {
      errors.push({
        field: "commentId",
        message: "invalid input",
        in: "params",
      });
    }
    if (!body || typeof body !== "string" || !body.trim()) {
      errors.push({ field: "body", message: "invalid input", in: "body" });
    }
    if (errors.length) throw badRequest(errors, "invalid input");

    const comment = await serviceRegistry.createComment({
      articleID: articleId,
      body,
      status: defaults.commentStatus,
      author: req.user.id,
      parentCommentId: commentId,
    });

    return res.status(201).json({
      code: 201,
      message: "reply posted",
      data: comment,
      links: {
        self: `/api/v1/articles/${articleId}/comments/${commentId}/replies`,
        article: `/api/v1/articles/${articleId}`,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = postCommentReply;
