const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");

/**
 * Verifies a password reset OTP and stores the resulting reset token.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.email - User email address.
 * @param {string} req.body.otp - Password reset OTP.
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 * @returns {Promise<void>} Sends an OTP verification response.
 * @throws {Error} BadRequest if the OTP is invalid or expired.
 */
const verifyResetOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (
      !email ||
      typeof email !== "string" ||
      !otp ||
      typeof otp !== "string"
    ) {
      throw badRequest(null, "Invalid or expired OTP");
    }

    const resetToken = await authServices.verifyResetOtp({
      email: email.trim(),
      code: otp,
    });

    res.cookie("resetToken", resetToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      code: 200,
      message: "OTP verified. You may now reset your password.",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = verifyResetOtp;
