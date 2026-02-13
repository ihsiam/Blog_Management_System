const articleServices = require("../../../../lib/articles");
const { query } = require("../../../../utils");
const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");

const findAll = async (req, res, next) => {
  try {
    const errors = [];

    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sort_type || defaults.sortType;
    const sortBy = req.query.sort_by || defaults.sortBy;
    const searchTerm = req.query.search || defaults.searchTerm;

    // page validation
    if (!Number.isFinite(page) || page < 1) {
      errors.push({ field: "page", message: "invalid input", in: "query" });
    }

    // limit validation
    if (!Number.isFinite(limit) || limit < 1) {
      errors.push({ field: "limit", message: "invalid input", in: "query" });
    }

    // sort type validation
    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sort_type",
        message: "invalid input",
        in: "query",
      });
    }

    // sort by validation
    if (typeof sortBy !== "string" || !sortBy.trim()) {
      errors.push({ field: "sort_by", message: "invalid input", in: "query" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // get data from service
    const articles = await articleServices.findAll({
      page,
      limit,
      sortBy,
      sortType,
      searchTerm,
    });

    // count total
    const totalItems = await articleServices.count({ searchTerm });

    // process response data
    const data = query.transformData({
      items: articles,
      selection: ["_id", "title", "cover", "author", "createdAt", "updatedAt"],
      path: "/articles",
    });

    // process pagination
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

    // response
    res.json({
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

module.exports = findAll;
