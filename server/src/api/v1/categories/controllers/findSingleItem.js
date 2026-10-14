const mongoose = require("mongoose");
const categoryServices = require("../../../../lib/categories");
const { badRequest } = require("../../../../utils/error");
const { ROLES } = require("../../../../config/constants");

/**
 * Retrieves a single category by ID.
 *
 * Public callers can only retrieve active categories. Admins can also
 * retrieve unavailable ones.
 *
 * @param {import("express").Request} req - Express request object
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends a category response
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
