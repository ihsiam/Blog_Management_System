const mongoose = require("mongoose");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const serviceRegistry = require("../../../../lib/serviceRegistry");
const { mapComment } = require("../../../../utils/mappers");

/**
 * Post a top-level comment on an article.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - Article ID.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.body - Comment text.
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.id - Comment author ID.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 201 reply, or undefined when an error is forwarded to `next`.
 */
const postCommentOnArticle = async (req, res, next) => {
  try {
    const { id: articleId } = req.params;

    const author = req.user.id;

    const { body } = req.body;

    const status = defaults.commentStatus;

    const errors = [];

    if (!articleId || !mongoose.Types.ObjectId.isValid(articleId)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    if (!body || typeof body !== "string" || !body.trim()) {
      errors.push({ field: "body", message: "invalid input", in: "body" });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const comment = await serviceRegistry.createComment({
      articleId,
      body,
      status,
      author,
    });

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
