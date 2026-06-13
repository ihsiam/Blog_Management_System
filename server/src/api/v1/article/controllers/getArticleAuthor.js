const serviceRegistry = require("../../../../lib/service registry");
const { badRequest } = require("../../../../utils/error");

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
    const { id: articleID } = req.params;

    // validate article id
    if (!articleID || typeof articleID !== "string") {
      return next(
        badRequest(
          [{ field: "id", message: "invalid input", in: "params" }],
          "invalid input",
        ),
      );
    }

    // fetch author
    const user = await serviceRegistry.getArticleAuthor(articleID);

    // handle missing user safely
    if (!user) {
      return next(
        badRequest(
          [{ field: "id", message: "author not found", in: "params" }],
          "author not found",
        ),
      );
    }

    // transform response data
    const data = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    // response
    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data,
      links: {
        self: `/api/v1/articles/${articleID}/author`,
        article: `/api/v1/articles/${articleID}`,
      },
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = getArticleAuthor;
