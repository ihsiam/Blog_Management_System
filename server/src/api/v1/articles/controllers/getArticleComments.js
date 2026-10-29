const mongoose = require("mongoose");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const { COMMENT_STATUS } = require("../../../../config/constants");
const commentServices = require("../../../../lib/comments");
const serviceRegistry = require("../../../../lib/serviceRegistry");
const { query } = require("../../../../utils");

/**
 * List paginated public top-level comments for an article.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - Article ID.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.page=defaults.page] - Page number.
 * @param {string} [req.query.limit=defaults.limit] - Items per page.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const getArticleComments = async (req, res, next) => {
  try {
    const { id: articleId } = req.params;
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);

    const errors = [];

    if (!articleId || !mongoose.Types.ObjectId.isValid(articleId)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

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

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const comments = await serviceRegistry.getCommentByArticle({
      articleId,
      page,
      limit,
      status: COMMENT_STATUS.PUBLIC,
    });

    // keep client shape stable for nested threads.
    const data = comments.map((comment) => ({
      ...comment,
      replies: Array.isArray(comment.replies) ? comment.replies : [],
    }));

    const totalItems = await commentServices.count({
      articleId,
      status: COMMENT_STATUS.PUBLIC,
      topLevel: true,
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

    links.article = `/api/v1/articles/${articleId}`;

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

module.exports = getArticleComments;
