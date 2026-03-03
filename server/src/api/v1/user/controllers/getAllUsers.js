const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const UserServices = require("../../../../lib/user");
const { query } = require("../../../../utils");

const getAllUsers = async (req, res, next) => {
  try {
    // extract params from request
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sort_type || defaults.sortType;
    const sortBy = req.query.sort_by || defaults.sortBy;
    const name = req.query.name || defaults.searchTerm;
    const email = req.query.email || defaults.searchTerm;

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

    // get user data
    const users = await UserServices.getAllUsers({
      page,
      limit,
      sortBy,
      sortType,
      name,
      email,
    });

    // total items
    const totalItems = await UserServices.countTotal({ name, email });

    // transform data
    const data = query.transformData({
      items: users,
      selection: ["id", "name", "email", "createdAt", "updatedAt"],
    });

    // pagination
    const pagination = query.getPagination(page, limit, totalItems);

    // hateOAS
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

module.exports = getAllUsers;
