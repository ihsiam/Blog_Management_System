const mongoose = require("mongoose");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

/**
 * Retrieves a single article by ID.
 *
 * Supports optional expansion of related fields via `expand` query param.
 *
 * Response includes:
 * - Article data
 * - HATEOAS-style navigation links
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 *
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.expand] - Optional related data expansion (e.g. author, comments)
 *
 * @param {import("express").Response} res
 * @param {Function} next
 *
 * @returns {Promise<void>} Sends single article response
 */
const findSingleItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const expand = req.query.expand || "";

    /**
     * Collect validation errors
     */
    const errors = [];

    /**
     * Validate article ID
     */
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({
        field: "id",
        message: "invalid input",
        in: "params",
      });
    }

    /**
     * Validate expand query
     */
    if (typeof expand !== "string") {
      errors.push({
        field: "expand",
        message: "invalid input",
        in: "query",
      });
    }

    /**
     * Throw validation error if any exist
     */
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    /**
     * Fetch article from service layer
     */
    const article = await articleServices.findSingleItem({
      id,
      expand,
    });

    /**
     * Response
     */
    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data: article,
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
