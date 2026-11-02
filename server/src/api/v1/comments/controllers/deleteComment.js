const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const commentService = require("../../../../lib/comments");

/**
 * Delete a comment by ID.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - Comment ID to delete.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 204 reply, or undefined when an error is forwarded to `next`.
 */
const deleteComment = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    await commentService.deleteItem(id);

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
};

module.exports = deleteComment;
