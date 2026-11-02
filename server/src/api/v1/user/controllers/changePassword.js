const mongoose = require("mongoose");
const { badRequest, unauthorized } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");
const sessionServices = require("../../../../lib/session");
const { hashing, validation } = require("../../../../utils");

/**
 * Change a user's password after verifying the current password.
 *
 * Signs the user out of every other device session.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - User ID.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.oldPassword - Current password.
 * @param {string} req.body.newPassword - New password (8–72 bytes).
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.sessionId - Current session ID, kept active after the change.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const changePassword = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    if (!oldPassword || typeof oldPassword !== "string") {
      errors.push({
        field: "oldPassword",
        message: "invalid input",
        in: "body",
      });
    }

    if (!newPassword || typeof newPassword !== "string") {
      errors.push({
        field: "newPassword",
        message: "invalid input",
        in: "body",
      });
    } else if (newPassword.length < 8) {
      errors.push({
        field: "newPassword",
        message: "Password must be at least 8 character",
        in: "body",
      });
    } else if (validation.isPasswordTooLong(newPassword)) {
      errors.push({
        field: "newPassword",
        message: "Password must be at most 72 bytes long",
        in: "body",
      });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const user = await userServices.findAuthUserById(id);

    if (!user) {
      throw unauthorized("User not found");
    }

    const isMatch = await hashing.compareHash(oldPassword, user.password_hash);

    // Use 400, not 401, so clients do not treat this as an expired token.
    if (!isMatch) {
      throw badRequest(
        [
          {
            field: "oldPassword",
            message: "Old password is incorrect",
            in: "body",
          },
        ],
        "invalid input",
      );
    }

    await userServices.updatePassword({
      id,
      // The service hashes the plain password before storing it.
      password: newPassword,
    });

    // Revoke every other device session; keep the current one.
    await sessionServices.clearRefreshToken({
      id,
      exceptSessionId: req.user.sessionId,
    });

    return res.status(200).json({
      code: 200,
      message: "Password updated successfully",
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = changePassword;
