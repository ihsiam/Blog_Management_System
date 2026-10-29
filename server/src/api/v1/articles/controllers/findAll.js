const mongoose = require("mongoose");
const articleServices = require("../../../../lib/articles");
const { query } = require("../../../../utils");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const { ARTICLE_STATUS } = require("../../../../config/constants");
const { mapArticle } = require("../../../../utils/mappers");

/**
 * List published articles with pagination, sort, search, and category filter.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.page=defaults.page] - Page number.
 * @param {string} [req.query.limit=defaults.limit] - Items per page.
 * @param {string} [req.query.sortType=defaults.sortType] - Sort order ("asc" | "desc").
 * @param {string} [req.query.sortBy=defaults.sortBy] - Field to sort by.
 * @param {string} [req.query.search=defaults.searchTerm] - Search keyword.
 * @param {string} [req.query.category] - Category ID filter.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const findAll = async (req, res, next) => {
  try {
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sortType || defaults.sortType;
    const sortBy = req.query.sortBy || defaults.sortBy;
    const searchTerm = req.query.search || defaults.searchTerm;
    const { category } = req.query;

    const errors = [];

    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: "page", message: "invalid input", in: "query" });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > defaults.maxLimit) {
      errors.push({ field: "limit", message: "invalid input", in: "query" });
    }

    if (
      typeof searchTerm !== "string" ||
      searchTerm.length > defaults.maxSearchLength
    ) {
      errors.push({ field: "search", message: "invalid input", in: "query" });
    }

    if (
      category &&
      (typeof category !== "string" ||
        !mongoose.Types.ObjectId.isValid(category))
    ) {
      errors.push({ field: "category", message: "invalid input", in: "query" });
    }

    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sortType",
        message: "invalid input",
        in: "query",
      });
    }

    if (!["title", "createdAt", "updatedAt"].includes(sortBy)) {
      errors.push({ field: "sortBy", message: "invalid input", in: "query" });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // Public listing must not expose draft or non-published rows.
    const articles = await articleServices.findAll({
      page,
      limit,
      sortBy,
      sortType,
      searchTerm,
      status: ARTICLE_STATUS.PUBLISHED,
      category,
    });

    const totalItems = await articleServices.count({
      searchTerm,
      status: ARTICLE_STATUS.PUBLISHED,
      category,
    });

    const data = query.transformData({
      items: articles.map(mapArticle),
      selection: ["id", "title", "cover", "author", "createdAt", "updatedAt"],
      path: "/api/v1/articles",
    });

    const pagination = query.getPagination(page, limit, totalItems);

    const links = query.hateOAS({
      url: req.url,
      path: req.path,
      query: req.query,
      hasNext: !!pagination.next,
      hasPrev: !!pagination.prev,
      page,
    });

    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data,
      pagination,
      links,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = findAll;
