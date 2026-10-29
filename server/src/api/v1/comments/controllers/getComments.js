const mongoose = require("mongoose");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const { COMMENT_STATUS } = require("../../../../config/constants");
const commentServices = require("../../../../lib/comments");
const serviceRegistry = require("../../../../lib/serviceRegistry");
const { query } = require("../../../../utils");
const { mapComment } = require("../../../../utils/mappers");

/**
 * List comments with pagination, sort, and optional article/status filters.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.page=defaults.page] - Page number.
 * @param {string} [req.query.limit=defaults.limit] - Items per page.
 * @param {string} [req.query.sortType=defaults.sortType] - Sort direction ("asc" | "desc").
 * @param {string} [req.query.sortBy=defaults.sortBy] - Field to sort by.
 * @param {string} [req.query.articleId] - Article ID to filter comments.
 * @param {string} [req.query.status] - Comment status filter (public or hidden).
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const getComments = async (req, res, next) => {
  try {
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sortType || defaults.sortType;
    const sortBy = req.query.sortBy || defaults.sortBy;
    const { articleId } = req.query;
    const { status } = req.query || null;

    const errors = [];

    if (!Number.isInteger(page) || page < 1) {
      errors.push({
        field: "page",
        message: "invalid input",
        in: "query",
      });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > defaults.maxLimit) {
      errors.push({
        field: "limit",
        message: "invalid input",
        in: "query",
      });
    }

    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sortType",
        message: "invalid input",
        in: "query",
      });
    }

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

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const comments = await serviceRegistry.getComments({
      page,
      limit,
      sortType,
      sortBy,
      articleId,
      status,
    });
    const data = comments.map(mapComment);

    const totalItem = await commentServices.count({
      articleId,
      status,
    });

    const pagination = query.getPagination(page, limit, totalItem);

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
  } catch (e) {
    return next(e);
  }
};

module.exports = getComments;
