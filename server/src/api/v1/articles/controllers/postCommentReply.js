const mongoose = require("mongoose");
const defaults = require("../../../../config/defaults");
const serviceRegistry = require("../../../../lib/serviceRegistry");
const { badRequest } = require("../../../../utils/error");
const { mapComment } = require("../../../../utils/mappers");

/**
 * Post a reply under an existing article comment.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.articleId - Article ID.
 * @param {string} req.params.commentId - Parent comment ID.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.body - Reply text.
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.id - Reply author ID.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 201 reply, or undefined when an error is forwarded to `next`.
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
      articleId,
      body,
      status: defaults.commentStatus,
      author: req.user.id,
      parentCommentId: commentId,
    });

    return res.status(201).json({
      code: 201,
      message: "Reply posted",
      data: mapComment(comment),
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
