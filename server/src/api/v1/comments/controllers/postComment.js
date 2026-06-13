const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const serviceRegistry = require("../../../../lib/service registry");

/**
 * Creates a new comment for an article.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.body - Comment content
 * @param {string} req.body.articleID - Target article ID
 * @param {string} [req.body.status] - Optional comment status
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Returns created comment response
 */
const postComment = async (req, res, next) => {
  try {
    // extract data from request
    const { body, articleID } = req.body;

    // default comment status
    const status = defaults.commentStatus;

    // authenticated user
    const author = req.user.id;

    // collect validation errors
    const errors = [];

    // validate comment body
    if (!body || typeof body !== "string" || !body.trim()) {
      errors.push({ field: "body", message: "invalid input", in: "body" });
    }

    // validate article ID
    if (!articleID || typeof articleID !== "string" || !articleID.trim()) {
      errors.push({
        field: "articleId",
        message: "invalid input",
        in: "body",
      });
    }

    // throw validation error if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // create comment
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
        self: `/api/v1/comments/${comment.id}`,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = postComment;
