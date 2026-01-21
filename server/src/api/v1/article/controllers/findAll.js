const services = require("../../../../lib/articles");
const { query } = require("../../../../utils");
const defaults = require("../../../../config/defaults");

const findAll = async (req, res, next) => {
  const page = +req.query.page || defaults.page;
  const limit = +req.query.limit || defaults.limit;
  const sortType = req.query.sort_type || defaults.sortType;
  const sortBy = req.query.sort_by || defaults.sortBy;
  const searchTerm = req.query.search || defaults.searchTerm;

  try {
    // get data from service
    const articles = await services.findAll({
      page,
      limit,
      sortBy,
      sortType,
      searchTerm,
    });

    const totalItems = await services.count({ searchTerm });

    // process response data
    const data = query.transformData({
      items: articles,
      selection: ["_id", "title", "cover", "author", "createdAt", "updatedAt"],
      path: "/articles",
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
