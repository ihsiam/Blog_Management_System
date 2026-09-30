const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");

/**
 * Updates a comment visibility status.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Comment ID
 * @param {Object} req.body - Request payload
 * @param {string} req.body.status - Comment visibility status
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends the updated comment response
 */
const updateCommentStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    if (!status || !["public", "hidden"].includes(status)) {
      errors.push({ field: "status", message: "invalid input", in: "body" });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const comment = await commentServices.updateStatus({ id, status });

    return res.status(200).json({
      code: 200,
      message: "comment status updated",
      data: comment,
      links: {
        self: `/api/v1/comments/${comment.id}`,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = updateCommentStatus;
