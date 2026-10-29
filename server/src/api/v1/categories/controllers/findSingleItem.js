const mongoose = require("mongoose");
const categoryServices = require("../../../../lib/categories");
const { badRequest } = require("../../../../utils/error");
const { ROLES } = require("../../../../config/constants");

/**
 * Fetch a category by ID.
 *
 * Public callers can only retrieve active categories. Admins can also
 * retrieve unavailable ones.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - Category ID.
 * @param {Object} [req.user] - Authenticated user, if any.
 * @param {string} [req.user.role] - User role, used to detect administrators.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const findSingleItem = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    const category = await categoryServices.findSingleItem({
      id,
      includeUnavailable: req.user?.role === ROLES.ADMIN,
    });

    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data: category,
      links: { self: `/api/v1/categories/${category.id}` },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = findSingleItem;
