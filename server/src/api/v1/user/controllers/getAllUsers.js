const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const { ACCOUNT_STATUS } = require("../../../../config/constants");
const UserServices = require("../../../../lib/user");
const { query } = require("../../../../utils");
const { mapUser } = require("../../../../utils/mappers");

/**
 * List users with pagination, sort, and name/email/status filters.
 *
 * @param {import("express").Request} req - Express request.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.page=defaults.page] - Page number.
 * @param {string} [req.query.limit=defaults.limit] - Items per page.
 * @param {string} [req.query.sortType=defaults.sortType] - Sort direction (`asc` or `desc`).
 * @param {string} [req.query.sortBy=defaults.sortBy] - Field to sort by (`createdAt`, `updatedAt`, `email`, or `name`).
 * @param {string} [req.query.name] - Filter by user name.
 * @param {string} [req.query.email] - Filter by user email.
 * @param {string} [req.query.status] - Filter by account status.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after the response is sent or `next` has been called.
 * @throws {Error} When query parameters are invalid.
 */
const getAllUsers = async (req, res, next) => {
  try {
    const page = Number(req.query.page || defaults.page);
    const limit = Number(req.query.limit || defaults.limit);
    const sortType = req.query.sortType || defaults.sortType;
    const sortBy = req.query.sortBy || defaults.sortBy;

    const { name, email, status } = req.query;

    // Collect every validation error so the client can fix them in one request.
    const errors = [];

    if (!Number.isInteger(page) || page < 1) {
      errors.push({ field: "page", message: "invalid input", in: "query" });
    }

    if (!Number.isInteger(limit) || limit < 1 || limit > defaults.maxLimit) {
      errors.push({ field: "limit", message: "invalid input", in: "query" });
    }

    if (!["asc", "desc"].includes(sortType)) {
      errors.push({
        field: "sortType",
        message: "invalid input",
        in: "query",
      });
    }

    // Allow only known fields so clients cannot sort by arbitrary ones.
    if (!["createdAt", "updatedAt", "email", "name"].includes(sortBy)) {
      errors.push({
        field: "sortBy",
        message: "invalid input",
        in: "query",
      });
    }

    // Reject non-string values (such as repeated parameters) and overlong search text.
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

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const users = await UserServices.getAllUsers({
      page,
      limit,
      sortBy,
      sortType,
      name,
      email,
      status,
    });

    const totalItems = await UserServices.countTotal({
      name,
      email,
      status,
    });

    // Return only the listed fields, so other user fields are not exposed.
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

    const pagination = query.getPagination(page, limit, totalItems);

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
    // Forward validation and service errors to the error handler.
    return next(err);
  }
};

module.exports = getAllUsers;
