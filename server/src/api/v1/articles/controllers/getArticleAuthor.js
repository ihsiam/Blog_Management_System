const mongoose = require("mongoose");
const serviceRegistry = require("../../../../lib/serviceRegistry");
const { badRequest } = require("../../../../utils/error");
const { mapAuthor } = require("../../../../utils/mappers");

/**
 * Retrieves the author of a specific article.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends article author details
 */
const getArticleAuthor = async (req, res, next) => {
  try {
    // extract article id from route params
    const { id: articleId } = req.params;

    // validate article id
    if (!articleId || !mongoose.Types.ObjectId.isValid(articleId)) {
      return next(
        badRequest(
          [{ field: "id", message: "invalid input", in: "params" }],
          "invalid input",
        ),
      );
    }

    // fetch author
    const user = await serviceRegistry.getArticleAuthor(articleId);

    // transform response data
    const data = mapAuthor(user);

    // response
    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data,
      links: {
        self: `/api/v1/articles/${articleId}/author`,
        article: `/api/v1/articles/${articleId}`,
      },
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = getArticleAuthor;
