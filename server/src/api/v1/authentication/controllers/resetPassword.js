const authServices = require("../../../../lib/authentication");
const { badRequest, unauthorized } = require("../../../../utils/error");

/**
 * Resets a user's password using a valid reset token.
 *
 * @param {import("express").Request} req - Express request object.
 *
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.password - New user password.
 *
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 *
 * @returns {Promise<void>} Sends a password reset confirmation response.
 *
 * @throws {Error} BadRequest if password validation fails
 */
const resetPassword = async (req, res, next) => {
  try {
    const { password } = req.body;
    const token = req.cookies?.resetToken;

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

    if (!token) throw unauthorized("Reset token is missing");

    await authServices.resetPassword({ token, password });
    res.clearCookie("resetToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      code: 200,
      message: "Password reset successful",
      links: {
        "sign-in": "/api/v1/auth/sign-in",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = resetPassword;
