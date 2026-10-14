const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const { ACCOUNT_STATUS } = require("../../../../config/constants");
const UserServices = require("../../../../lib/user");
const { query } = require("../../../../utils");
const { mapUser } = require("../../../../utils/mappers");

/**
 * Retrieves a paginated list of users.
 *
 * - Pagination (page, limit)
 * - Sorting (sortBy, sortType)
 * - Filtering (name, email, status)
 * - HATEOAS links generation
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.page] - Page number
 * @param {string} [req.query.limit] - Items per page
 * @param {string} [req.query.sortType] - Sort direction (asc | desc)
 * @param {string} [req.query.sortBy] - Field to sort by
 * @param {string} [req.query.name] - Filter by user name
 * @param {string} [req.query.email] - Filter by user email
 * @param {string} [req.query.status] - Filter by account status
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Returns paginated user list
 */
const getAllUsers = async (req, res, next) => {
  try {
    // extract params from request
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sortType || defaults.sortType;
    const sortBy = req.query.sortBy || defaults.sortBy;

    const { name, email, status } = req.query;

    // collect validation errors
    const errors = [];

    // page validation
    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: "page", message: "invalid input", in: "query" });
    }

    // limit validation
    if (!Number.isInteger(limit) || limit < 1 || limit > defaults.maxLimit) {
      errors.push({ field: "limit", message: "invalid input", in: "query" });
    }

    // sort type validation
    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sortType",
        message: "invalid input",
        in: "query",
      });
    }

    // sort by validation
    if (!["createdAt", "updatedAt", "email", "name"].includes(sortBy)) {
      errors.push({
        field: "sortBy",
        message: "invalid input",
        in: "query",
      });
    }

    // status validation (optional filter)
    [
      { field: "name", value: name },
      { field: "email", value: email },
    ].forEach(({ field, value }) => {
      if (
        value !== undefined &&
        (typeof value !== "string" || value.length > defaults.maxSearchLength)
      ) {
        errors.push({ field, message: "invalid input", in: "query" });
      }
    });

    if (status && !Object.values(ACCOUNT_STATUS).includes(status)) {
      errors.push({
        field: "status",
        message: "invalid input",
        in: "query",
      });
    }

    // throw validation errors if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // fetch users from service layer
    const users = await UserServices.getAllUsers({
      page,
      limit,
      sortBy,
      sortType,
      name,
      email,
      status,
    });

    // count total users
    const totalItems = await UserServices.countTotal({
      name,
      email,
      status,
    });

    // transform response data
    const data = query.transformData({
      items: users.map(mapUser),
      selection: [
        "id",
        "name",
        "email",
        "role",
        "account_status",
        "createdAt",
        "updatedAt",
      ],
    });

    // pagination metadata
    const pagination = query.getPagination(page, limit, totalItems);

    // HATEOAS links
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
  } catch (err) {
    return next(err);
  }
};

module.exports = getAllUsers;
