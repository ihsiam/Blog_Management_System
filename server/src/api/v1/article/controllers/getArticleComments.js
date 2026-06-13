const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");
const serviceRegistry = require("../../../../lib/service registry");
const { query } = require("../../../../utils");

/**
 * Retrieves paginated public comments for a specific article.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 *
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.page] - Page number
 * @param {string} [req.query.limit] - Items per page
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends paginated comment list
 */
const getArticleComments = async (req, res, next) => {
  try {
    // extract request parameters
    const { id: articleID } = req.params;
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);

    // collect validation errors
    const errors = [];

    // page validation
    if (!Number.isFinite(page) || page < 1) {
      errors.push({
        field: "page",
        message: "invalid input",
        in: "query",
      });
    }

    // limit validation
    if (!Number.isFinite(limit) || limit < 1) {
      errors.push({
        field: "limit",
        message: "invalid input",
        in: "query",
      });
    }

    // throw validation error if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // fetch public comments for article
    const comments = await serviceRegistry.getCommentByArticle({
      articleID,
      page,
      limit,
      status: "public",
    });

    // transform response data
    const data = query.transformData({
      items: comments,
      selection: ["id", "body", "author", "createdAt", "updatedAt"],
    });

    // count total public comments
    const totalItems = await commentServices.count({
      article: articleID,
      status: "public",
    });

    // generate pagination metadata
    const pagination = query.getPagination(page, limit, totalItems);

    // generate HATEOAS navigation links
    const links = query.hateOAS({
      url: req.url,
      path: req.path,
      query: req.query,
      hasNext: !!pagination.next,
      hasPrev: !!pagination.prev,
      page,
    });

    // add related article link
    links.article = `/api/v1/articles/${articleID}`;

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

module.exports = getArticleComments;
