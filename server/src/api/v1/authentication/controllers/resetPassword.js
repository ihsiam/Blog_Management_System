const tokenServices = require("../../../../lib/token");
const userServices = require("../../../../lib/user");
const { badRequest } = require("../../../../utils/error");

/**
 * Resets user password using a valid reset token.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.token - Password reset JWT token
 *
 * @param {Object} req.body - Request payload
 * @param {string} req.body.password - New user password
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends password reset confirmation response
 *
 * @throws {Error} BadRequest error if password is invalid
 */
const resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    // Validate password
    if (!password || typeof password !== "string") {
      throw badRequest([
        {
          field: "password",
          message: "Password is required",
          in: "body",
        },
      ]);
    }

    if (password.length < 8) {
      throw badRequest([
        {
          field: "password",
          message: "Password must be at least 8 characters long",
          in: "body",
        },
      ]);
    }

    // Verify reset token and extract user
    const user = tokenServices.verifyActiveResetToken(token);

    // Update password in database
    await userServices.updatePassword({
      id: user.id,
      password,
    });

    // Invalidate all active sessions after password change
    await userServices.clearRefreshToken(user.id);

    // success response
    return res.status(200).json({
      code: 200,
      message: "Password reset successful",
      links: {
        signIn: "/auth/sign-in",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = resetPassword;
