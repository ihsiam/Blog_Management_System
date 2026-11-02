const mongoose = require("mongoose");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");
const { mapArticle } = require("../../../../utils/mappers");

/**
 * Fetch one article by ID with optional related-data expansion.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - Article ID.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.expand] - Comma-separated expansions (only "comments" is supported).
 * @param {Object} [req.user] - Authenticated user, passed to the article service.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const findSingleItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const expand = req.query.expand || "";
    const expandValues =
      typeof expand === "string"
        ? expand
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean)
        : [];

    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({
        field: "id",
        message: "invalid input",
        in: "params",
      });
    }

    if (typeof expand !== "string") {
      errors.push({
        field: "expand",
        message: "invalid input",
        in: "query",
      });
    }

    if (
      expandValues.length &&
      expandValues.some((item) => !["comments"].includes(item))
    ) {
      errors.push({
        field: "expand",
        message: "invalid input",
        in: "query",
      });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const article = await articleServices.findSingleItem({
      id,
      expand,
      user: req.user,
    });

    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data: mapArticle(article),
      links: {
        self: `/api/v1/articles/${article.id}`,
        author: `/api/v1/articles/${article.id}/author`,
        comments: `/api/v1/articles/${article.id}/comments`,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = findSingleItem;
