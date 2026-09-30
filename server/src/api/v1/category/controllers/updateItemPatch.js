const mongoose = require("mongoose");
const categoryServices = require("../../../../lib/categories");
const { badRequest, conflict } = require("../../../../utils/error");

/**
 * Updates category details.
 *
 * @param {import("express").Request} req - Express request object
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends updated category response
 */
const updateItemPatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body;
    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({ field: "name", message: "invalid input", in: "body" });
    }
    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      errors.push({
        field: "description",
        message: "invalid input",
        in: "body",
      });
    }
    if (errors.length) throw badRequest(errors, "invalid input");

    try {
      const category = await categoryServices.updateItemPatch(id, {
        name: name.trim(),
        description,
      });
      return res.status(200).json({
        code: 200,
        message: "Successfully updated category",
        data: category,
        links: { self: `/api/v1/categories/${category.id}` },
      });
    } catch (err) {
      if (err.code === 11000) {
        throw conflict("A category with this name already exists.");
      }
      throw err;
    }
  } catch (err) {
    return next(err);
  }
};

module.exports = updateItemPatch;
