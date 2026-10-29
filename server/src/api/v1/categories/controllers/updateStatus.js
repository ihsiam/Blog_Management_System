const mongoose = require("mongoose");
const categoryServices = require("../../../../lib/categories");
const { badRequest } = require("../../../../utils/error");
const { CATEGORY_STATUS } = require("../../../../config/constants");

/**
 * Update category availability status.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - Category ID.
 * @param {Object} req.body - Status payload.
 * @param {string} req.body.status - Target category status.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }
    if (!status || !Object.values(CATEGORY_STATUS).includes(status)) {
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
