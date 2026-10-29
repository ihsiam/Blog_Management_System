const mongoose = require("mongoose");
const serviceRegistry = require("../../../../lib/serviceRegistry");
const { badRequest } = require("../../../../utils/error");
const { mapAuthor } = require("../../../../utils/mappers");

/**
 * Return the author profile for an article.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - Article ID.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const getArticleAuthor = async (req, res, next) => {
  try {
    const { id: articleId } = req.params;

    if (!articleId || !mongoose.Types.ObjectId.isValid(articleId)) {
      return next(
        badRequest(
          [{ field: "id", message: "invalid input", in: "params" }],
          "invalid input",
        ),
      );
    }

    const user = await serviceRegistry.getArticleAuthor(articleId);

    const data = mapAuthor(user);

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
