const mongoose = require("mongoose");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");
const serviceRegistry = require("../../../../lib/service registry");
const { query } = require("../../../../utils");
/**
 * Retrieves paginated comments with filtering, sorting, and optional article filtering.
 *
 * - Pagination (page, limit)
 * - Sorting (sortBy, sortType)
 * - Filtering by articleId and status
 * - HATEOAS navigation links
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.page] - Page number (starts from 1)
 * @param {string} [req.query.limit] - Number of items per page
 * @param {string} [req.query.sortType] - Sort direction (asc | desc)
 * @param {string} [req.query.sortBy] - Field name to sort by
 * @param {string} [req.query.articleId] - Article ID to filter comments
 * @param {string} [req.query.status] - Comment status filter (e.g., public, hidden)
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handling middleware
 *
 * @returns {Promise<void>} Sends paginated comments response
 */
const getComments = async (req, res, next) => {
  try {
    // extract query params
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sortType || defaults.sortType;
    const sortBy = req.query.sortBy || defaults.sortBy;
    const postId = req.query.articleId;
    const { status } = req.query || null;

    // collect validation errors
    const errors = [];

    // validate page
    if (!Number.isFinite(page) || page < 1) {
      errors.push({
        field: "page",
        message: "invalid input",
        in: "query",
      });
    }

    // validate limit
    if (!Number.isFinite(limit) || limit <= 0) {
      errors.push({
        field: "limit",
        message: "invalid input",
        in: "query",
      });
    }

    // validate sort type
    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sort_type",
        message: "invalid input",
        in: "query",
      });
    }

    // validate sort by
    if (!["createdAt", "updatedAt"].includes(sortBy)) {
      errors.push({
        field: "sort_by",
        message: "invalid input",
        in: "query",
      });
    }

    // id validation
    if (postId && !mongoose.Types.ObjectId.isValid(postId)) {
      errors.push({
        field: "articleId",
        message: "invalid input",
        in: "query",
      });
    }

    // throw validation error if exists
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // fetch comments
    const data = await serviceRegistry.getComments({
      page,
      limit,
      sortType,
      sortBy,
      postId,
      status,
    });

    // count total comments
    const totalItem = await commentServices.count({
      article: postId,
      status,
    });

    // pagination metadata
    const pagination = query.getPagination(page, limit, totalItem);

    // HATEOAS links
    const links = query.hateOAS({
      url: req.url,
      path: req.path,
      query: req.query,
      hasNext: !!pagination.next,
      hasPrev: !!pagination.prev,
      page,
    });

    // response
    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data,
      pagination,
      links,
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = getComments;
