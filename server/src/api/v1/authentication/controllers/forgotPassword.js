const { badRequest } = require("../../../../utils/error");
const authServices = require("../../../../lib/authentication");
const emailService = require("../../../../lib/email");

/**
 * Requests a password reset email for a registered user.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.email - User email address.
 *
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 *
 * @returns {Promise<void>} Sends a generic confirmation response.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      throw badRequest([
        {
          field: "email",
          message: "Email is required",
          in: "body",
        },
      ]);
    }

    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    if (!isValidEmail) {
      throw badRequest([
        {
          field: "email",
          message: "Invalid email format",
          in: "body",
        },
      ]);
    }

    const { user, code } = await authServices.createPasswordResetOtp(
      email.trim(),
    );

    // Keep the response generic to prevent user enumeration.
    const responseMessage =
      "If an account with that email exists, a password reset code has been sent.";

    if (user && user.account_status !== "blocked") {
      await emailService.sendMail({
        email: user.email,
        subject: "Reset your password",
        text: `Hello ${user.name},\n\nYour password reset code is: ${code}`,
      });
    }

    return res.status(200).json({
      code: 200,
      message: responseMessage,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = forgotPassword;
