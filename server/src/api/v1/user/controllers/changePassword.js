const mongoose = require("mongoose");
const { badRequest, unauthorized } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");
const { hashing } = require("../../../../utils");

/**
 * Changes a user's password after verifying old password.
 *
 * @param {import("express").Request} req - Express request object
 *
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - User ID
 *
 * @param {Object} req.body - Request payload
 * @param {string} req.body.oldPassword - Current password of user
 * @param {string} req.body.newPassword - New password (min 8 characters)
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends password update confirmation response
 */
const changePassword = async (req, res, next) => {
  try {
    // extract data
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    // validation errors
    const errors = [];

    // id validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // old password validation
    if (!oldPassword || typeof oldPassword !== "string") {
      errors.push({
        field: "oldPassword",
        message: "invalid input",
        in: "body",
      });
    }

    // new password validation
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
    }

    // throw validation errors if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // find authenticated user
    const user = await userServices.findAuthUserById(id);

    if (!user) {
      throw unauthorized("User not found");
    }

    // verify old password
    const isMatch = await hashing.compareHash(oldPassword, user.password);

    if (!isMatch) {
      throw unauthorized("Old password is incorrect");
    }

    // update password
    await userServices.updatePassword({
      id,
      password: newPassword, // raw password (hashed inside service layer)
    });

    // response
    return res.status(200).json({
      code: 200,
      message: "Password updated successfully",
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = changePassword;
