const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const commentService = require("../../../../lib/comments");

/**
 * Deletes a comment by ID.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Comment ID to delete
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Returns no content on successful deletion
 */
const deleteComment = async (req, res, next) => {
  try {
    // extract id from route params
    const { id } = req.params;

    // validate comment id
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    // delete comment from service layer
    await commentService.deleteItem(id);

    // success response (no content)
    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
};

module.exports = deleteComment;
