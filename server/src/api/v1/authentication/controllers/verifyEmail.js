const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");
const { validation } = require("../../../../utils");

/**
 * Verify a user email OTP and activate the account.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.email - User email address.
 * @param {string} req.body.otp - Email verification OTP.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    // Normalize email: must be a string, trimmed and lowercased
    const normalizedEmail =
      typeof email === "string" ? email.trim().toLowerCase() : "";

    // Normalize OTP: must be a string, trimmed
    const normalizedOtp = typeof otp === "string" ? otp.trim() : "";

    // Reject missing or malformed input with one generic error
    if (
      !normalizedEmail ||
      !validation.isValidEmail(normalizedEmail) ||
      !normalizedOtp
    ) {
      throw badRequest(null, "Invalid or expired OTP");
    }

    await authServices.verifyEmailOtp({
      email: normalizedEmail,
      code: normalizedOtp,
    });

    return res.status(200).json({
      code: 200,
      message: "Email verified successfully.",
      links: {
        "sign-in": "/api/v1/auth/sign-in",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = verifyEmail;
