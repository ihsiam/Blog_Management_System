const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");

/**
 * Retrieves a single user by ID.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - User ID
 *
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.expand] - Optional fields to expand
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Returns user data
 */
const getSingleUser = async (req, res, next) => {
  try {
    // extract data from request
    const { id } = req.params;
    const { expand } = req.query;

    // collect validation errors
    const errors = [];

    // validate user id
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // validate expand query param
    if (expand !== undefined && typeof expand !== "string") {
      errors.push({
        field: "expand",
        message: "invalid input",
        in: "query",
      });
    }

    // throw validation error if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // fetch user from service layer
    const data = await userServices.getSingleUser({ id, expand });

    // response
    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = getSingleUser;
