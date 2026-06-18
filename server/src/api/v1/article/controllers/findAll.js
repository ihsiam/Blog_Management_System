const articleServices = require("../../../../lib/articles");
const { query } = require("../../../../utils");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");

/**
 * Retrieves a paginated list of published articles.
 *
 * - Pagination (page, limit)
 * - Sorting (sortBy, sortType)
 * - Search filtering
 * - Only "published" articles are returned
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.page] - Page number (defaults to system default)
 * @param {string} [req.query.limit] - Items per page (defaults to system default)
 * @param {string} [req.query.sortType] - Sort order ("asc" | "desc")
 * @param {string} [req.query.sortBy] - Field to sort by
 * @param {string} [req.query.search] - Search keyword
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends paginated article list response
 */
const findAll = async (req, res, next) => {
  try {
    /**
     * Extract query params with fallback defaults
     */
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sortType || defaults.sortType;
    const sortBy = req.query.sortBy || defaults.sortBy;
    const searchTerm = req.query.search || defaults.searchTerm;

    /**
     * Collect validation errors
     */
    const errors = [];

    /**
     * Validate page number
     */
    if (!Number.isFinite(page) || page < 1) {
      errors.push({ field: "page", message: "invalid input", in: "query" });
    }

    /**
     * Validate limit
     */
    if (!Number.isFinite(limit) || limit < 1) {
      errors.push({ field: "limit", message: "invalid input", in: "query" });
    }

    /**
     * Validate sort type
     */
    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sort_type",
        message: "invalid input",
        in: "query",
      });
    }

    /**
     * Validate sort field
     */
    if (!["id", "title", "createdAt", "updatedAt"].includes(sortBy)) {
      errors.push({ field: "sort_by", message: "invalid input", in: "query" });
    }

    /**
     * Throw validation error if any exist
     */
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    /**
     * Fetch only published articles
     */
    const articles = await articleServices.findAll({
      page,
      limit,
      sortBy,
      sortType,
      searchTerm,
      status: "published",
    });

    /**
     * Count only published articles
     */
    const totalItems = await articleServices.count({
      searchTerm,
      status: "published",
    });

    /**
     * Transform response data (DTO layer)
     */
    const data = query.transformData({
      items: articles,
      selection: ["id", "title", "cover", "author", "createdAt", "updatedAt"],
      path: "/api/v1/articles",
    });

    /**
     * Generate pagination metadata
     */
    const pagination = query.getPagination(page, limit, totalItems);

    /**
     * Generate HATEOAS navigation links
     */
    const links = query.hateOAS({
      url: req.url,
      path: req.path,
      query: req.query,
      hasNext: !!pagination.next,
      hasPrev: !!pagination.prev,
      page,
    });

    /**
     * Final response
     */
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
