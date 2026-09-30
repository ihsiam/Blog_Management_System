const mongoose = require("mongoose");
const categoryServices = require("../../../../lib/categories");
const { badRequest } = require("../../../../utils/error");

/**
 * Updates category availability status.
 *
 * @param {import("express").Request} req - Express request object
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends updated category response
 */
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }
    if (!status || !["active", "unavailable"].includes(status)) {
      errors.push({ field: "status", message: "invalid input", in: "body" });
    }
    if (errors.length) throw badRequest(errors, "invalid input");

    const category = await categoryServices.updateStatus(id, status);

    return res.status(200).json({
      code: 200,
      message: "Category status updated",
      data: category,
      links: { self: `/api/v1/categories/${category.id}` },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = updateStatus;
