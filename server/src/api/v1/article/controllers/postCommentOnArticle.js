const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const serviceRegistry = require("../../../../lib/service registry");

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
    const { id: articleID } = req.params;

    // extract authenticated user id
    const author = req.user.id;

    // extract comment body
    const { body } = req.body;

    // default comment status from system config
    const status = defaults.commentStatus;

    // validate comment body
    if (!body || typeof body !== "string" || !body.trim()) {
      throw badRequest(
        [{ field: "body", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }

    // create comment via service layer
    const comment = await serviceRegistry.createComment({
      articleID,
      body,
      status,
      author,
    });

    // response
    return res.status(201).json({
      code: 201,
      message: "comment posted",
      data: comment,
      links: {
        self: `/api/v1/articles/${articleID}/comments`,
        article: `/api/v1/articles/${articleID}`,
      },
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = postCommentOnArticle;
