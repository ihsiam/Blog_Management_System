const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const commentService = require("../../../../lib/comments");
const { query } = require("../../../../utils");

const getComments = async (req, res, next) => {
  try {
    // extract params from request
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sort_type || defaults.sortType;
    const sortBy = req.query.sort_by || defaults.sortBy;
    const { postId } = req.query;

    // 400 error
    const errors = [];

    // invalid page number
    if (!Number.isFinite(page) || page < 1) {
      errors.push({
        field: "page",
        message: "invalid input",
        in: "query",
      });
    }

    // invalid limit
    if (!Number.isFinite(limit) || limit <= 0) {
      errors.push({
        field: "limit",
        message: "invalid input",
        in: "query",
      });
    }

    // invalid sortType
    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sort_type",
        message: "invalid input",
        in: "query",
      });
    }

    // invalid sortBy
    if (typeof sortBy !== "string" || !sortBy.trim()) {
      errors.push({
        field: "sort_by",
        message: "invalid input",
        in: "query",
      });
    }

    // invalid id
    if (postId !== undefined && typeof postId !== "string") {
      errors.push({
        field: "id",
        message: "invalid input",
        in: "query",
      });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // get comments
    const data = await commentService.getComments({
      page,
      limit,
      sortType,
      sortBy,
      postId,
    });

    // get total
    let totalItem;
    if (postId) {
      totalItem = await commentService.count({ article: postId });
    } else {
      totalItem = await commentService.count();
    }

    // get pagination
    const pagination = query.getPagination(page, limit, totalItem);

    // hateOAS link
    const links = query.hateOAS({
      url: req.url,
      path: req.path,
      query: req.query,
      hasNext: !!pagination.next,
      hasPrev: !!pagination.prev,
      page,
    });

    // response
    res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data,
      pagination,
      links,
    });
  } catch (e) {
    next(e);
  }
};

module.exports = getComments;
