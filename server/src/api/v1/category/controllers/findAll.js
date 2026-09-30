const categoryServices = require("../../../../lib/categories");
const { query } = require("../../../../utils");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");

/**
 * Retrieves a paginated list of active categories.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends paginated category list response
 */
const findAll = async (req, res, next) => {
  try {
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sortType || defaults.sortType;
    const sortBy = req.query.sortBy || defaults.sortBy;
    const searchTerm = req.query.search || defaults.searchTerm;
    const errors = [];

    if (!Number.isFinite(page) || page < 1) {
      errors.push({ field: "page", message: "invalid input", in: "query" });
    }
    if (!Number.isFinite(limit) || limit < 1) {
      errors.push({ field: "limit", message: "invalid input", in: "query" });
    }
    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sort_type",
        message: "invalid input",
        in: "query",
      });
    }
    if (!["createdAt", "name"].includes(sortBy)) {
      errors.push({ field: "sort_by", message: "invalid input", in: "query" });
    }
    if (typeof searchTerm !== "string") {
      errors.push({ field: "search", message: "invalid input", in: "query" });
    }

    if (errors.length) throw badRequest(errors, "invalid input");

    const categories = await categoryServices.findAll({
      page,
      limit,
      sortBy,
      sortType,
      searchTerm,
    });
    const totalItems = await categoryServices.count({ searchTerm });
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
