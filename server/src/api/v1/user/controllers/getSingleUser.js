const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");
const { mapUser } = require("../../../../utils/mappers");

/**
 * Fetch a single user by ID.
 *
 * @param {import("express").Request} req - Express request.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - User ID.
 * @param {Object} req.query - Query parameters.
 * @param {string} [req.query.expand] - Optional related fields to expand.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after the response is sent or `next` has been called.
 * @throws {Error} When the user ID or expand query is invalid.
 */
const getSingleUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { expand } = req.query;

    // Collect every validation error so the client can fix them in one request.
    const errors = [];

    // Reject malformed IDs before they reach the database query.
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // Reject non-string values, such as repeated query parameters.
    if (expand !== undefined && typeof expand !== "string") {
      errors.push({
        field: "expand",
        message: "invalid input",
        in: "query",
      });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const data = await userServices.getSingleUser({ id, expand });

    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data: mapUser(data),
    });
  } catch (err) {
    // Forward validation and service errors to the error handler.
    return next(err);
  }
};

module.exports = getSingleUser;
