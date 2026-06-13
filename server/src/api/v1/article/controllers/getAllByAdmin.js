const articleServices = require("../../../../lib/articles");
const { query } = require("../../../../utils");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");

/**
 * Retrieves a paginated list of articles for admin panel.
 *
 * Admin can:
 * - View all article statuses (published, draft)
 * - Filter by status
 * - Use pagination, sorting, and search
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.page] - Page number
 * @param {string} [req.query.limit] - Items per page
 * @param {string} [req.query.sortType] - Sort order ("asc" | "desc")
 * @param {string} [req.query.sortBy] - Field to sort by
 * @param {string} [req.query.search] - Search keyword
 * @param {string} [req.query.status] - Article status filter (optional)
 *
 * @param {import("express").Response} res
 * @param {Function} next
 *
 * @returns {Promise<void>} Sends paginated article list response
 */
const getAllByAdmin = async (req, res, next) => {
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
     * Admin can optionally filter by status
     * If not provided → allow all statuses
     */
    const status = req.query.status || null;

    /**
     * Collect validation errors
     */
    const errors = [];

    /**
     * Validate page
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
    if (typeof sortBy !== "string" || !sortBy.trim()) {
      errors.push({ field: "sort_by", message: "invalid input", in: "query" });
    }

    /**
     * Throw validation error if any exist
     */
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    /**
     * Fetch articles (admin has full visibility)
     */
    const articles = await articleServices.findAll({
      page,
      limit,
      sortBy,
      sortType,
      searchTerm,
      status,
    });

    /**
     * Count total articles (respecting optional status filter)
     */
    const totalItems = await articleServices.count({
      searchTerm,
      status,
    });

    /**
     * Transform response data
     */
    const data = query.transformData({
      items: articles,
      selection: [
        "id",
        "title",
        "cover",
        "author",
        "status",
        "createdAt",
        "updatedAt",
      ],
      path: "/api/v1/articles",
    });

    /**
     * Pagination metadata
     */
    const pagination = query.getPagination(page, limit, totalItems);

    /**
     * HATEOAS navigation links
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

module.exports = getAllByAdmin;
