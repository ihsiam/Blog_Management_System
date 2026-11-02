const mongoose = require("mongoose");
const { badRequest, conflict } = require("../../../../utils/error");
const serviceRegistry = require("../../../../lib/serviceRegistry");

/**
 * Delete a user and related credentials.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - User ID to delete.
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.id - Authenticated user ID, used to block self-deletion.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 204 reply, or undefined when an error is forwarded to `next`.
 */
const deleteUser = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    // An admin cannot delete their own account.
    if (new mongoose.Types.ObjectId(id).toString() === req.user.id) {
      throw conflict("You cannot delete your own account");
    }

    await serviceRegistry.deleteUser(id);

    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
};

module.exports = deleteUser;
