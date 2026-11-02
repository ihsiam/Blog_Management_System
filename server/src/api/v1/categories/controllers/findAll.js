const categoryServices = require("../../../../lib/categories");
const { query } = require("../../../../utils");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const { ROLES, CATEGORY_STATUS } = require("../../../../config/constants");

/**
 * List categories with pagination.
 *
 * Public callers only see active categories. Admins see every category and
 * may filter by status.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.page=defaults.page] - Page number.
 * @param {string} [req.query.limit=defaults.limit] - Items per page.
 * @param {string} [req.query.sortType=defaults.sortType] - Sort order ("asc" | "desc").
 * @param {string} [req.query.sortBy=defaults.sortBy] - Field to sort by.
 * @param {string} [req.query.search=defaults.searchTerm] - Search keyword.
 * @param {string} [req.query.status] - Status filter (admin only).
 * @param {Object} [req.user] - Authenticated user, if any.
 * @param {string} [req.user.role] - User role, used to detect administrators.
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
    const isAdmin = req.user?.role === ROLES.ADMIN;
    const { status } = req.query;
    const errors = [];

    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: "page", message: "invalid input", in: "query" });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > defaults.maxLimit) {
      errors.push({ field: "limit", message: "invalid input", in: "query" });
    }
    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sortType",
        message: "invalid input",
        in: "query",
      });
    }
    if (!["createdAt", "name"].includes(sortBy)) {
      errors.push({ field: "sortBy", message: "invalid input", in: "query" });
    }
    if (
      typeof searchTerm !== "string" ||
      searchTerm.length > defaults.maxSearchLength
    ) {
      errors.push({ field: "search", message: "invalid input", in: "query" });
    }

    if (isAdmin && status && !Object.values(CATEGORY_STATUS).includes(status)) {
      errors.push({ field: "status", message: "invalid input", in: "query" });
    }

    if (errors.length) throw badRequest(errors, "invalid input");

    // Hide inactive categories from non-admin callers regardless of query params.
    const statusFilter = isAdmin ? status : CATEGORY_STATUS.ACTIVE;

    const categories = await categoryServices.findAll({
      page,
      limit,
      sortBy,
      sortType,
      searchTerm,
      status: statusFilter,
    });
    const totalItems = await categoryServices.count({
      searchTerm,
      status: statusFilter,
    });
    const data = query.transformData({
      items: categories,
      selection: [
        "id",
        "name",
        "description",
        "status",
        "createdAt",
        "updatedAt",
      ],
      path: "/api/v1/categories",
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
