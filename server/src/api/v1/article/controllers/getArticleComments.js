const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");
const { query } = require("../../../../utils");

const getArticleComments = async (req, res, next) => {
  try {
    // extract params from request
    const articleID = req.params.id;
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);

    // 400 error data
    const errors = [];

    // page validation
    if (!Number.isFinite(page) || page < 1) {
      errors.push({ field: "page", message: "invalid input", in: "query" });
    }

    // limit validation
    if (!Number.isFinite(limit) || limit < 1) {
      errors.push({ field: "limit", message: "invalid input", in: "query" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // get comment data from comment service
    const comments = await commentServices.getCommentByArticle({
      articleID,
      page,
      limit,
    });

    // transform data
    const data = query.transformData({
      items: comments,
      selection: ["id", "body", "status", "author", "createdAt", "updatedAt"],
    });

    // count comments
    const totalItems = await commentServices.count({ article: articleID });

    // get pagination
    const pagination = query.getPagination(page, limit, totalItems);

    // process hateOAS links
    const links = query.hateOAS({
      url: req.url,
      path: req.path,
      query: req.query,
      hasNext: !!pagination.next,
      hasPrev: !!pagination.prev,
      page,
    });

    // add article link
    links.article = `/api/v1/articles/${articleID}`;

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

module.exports = getArticleComments;
