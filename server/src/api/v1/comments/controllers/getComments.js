const mongoose = require("mongoose");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const { COMMENT_STATUS } = require("../../../../config/constants");
const commentServices = require("../../../../lib/comments");
const serviceRegistry = require("../../../../lib/serviceRegistry");
const { query } = require("../../../../utils");
const { mapComment } = require("../../../../utils/mappers");
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
    const { articleId } = req.query;
    const { status } = req.query || null;

    // collect validation errors
    const errors = [];

    // validate page
    if (!Number.isInteger(page) || page < 1) {
      errors.push({
        field: "page",
        message: "invalid input",
        in: "query",
      });
    }

    // validate limit
    if (!Number.isInteger(limit) || limit < 1 || limit > defaults.maxLimit) {
      errors.push({
        field: "limit",
        message: "invalid input",
        in: "query",
      });
    }

    // validate sort type
    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sortType",
        message: "invalid input",
        in: "query",
      });
    }

    // validate sort by
    if (!["createdAt", "updatedAt"].includes(sortBy)) {
      errors.push({
        field: "sortBy",
        message: "invalid input",
        in: "query",
      });
    }

    if (status && !Object.values(COMMENT_STATUS).includes(status)) {
      errors.push({
        field: "status",
        message: "invalid input",
        in: "query",
      });
    }

    // id validation
    if (
      articleId &&
      (typeof articleId !== "string" ||
        !mongoose.Types.ObjectId.isValid(articleId))
    ) {
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
    const comments = await serviceRegistry.getComments({
      page,
      limit,
      sortType,
      sortBy,
      articleId,
      status,
    });
    const data = comments.map(mapComment);

    // count total comments
    const totalItem = await commentServices.count({
      articleId,
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
