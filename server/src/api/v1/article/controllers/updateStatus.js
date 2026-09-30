const mongoose = require("mongoose");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

/**
 * Updates an article publication status.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 * @param {Object} req.body - Request body
 * @param {string} req.body.status - Article status
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends the updated article response
 */
const updateStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    if (!status || !["draft", "published"].includes(status)) {
      errors.push({ field: "status", message: "invalid input", in: "body" });
    }

    if (errors.length) throw badRequest(errors, "invalid input");

    const article = await articleServices.updateStatus(id, status);

    return res.status(200).json({
      code: 200,
      message: "Successfully updated article status",
      data: article,
      links: { self: `/api/v1/articles/${article.id}` },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = updateStatus;
