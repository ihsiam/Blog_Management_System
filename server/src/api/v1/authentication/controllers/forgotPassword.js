const { badRequest, notFound } = require("../../../../utils/error");
const { ACCOUNT_STATUS } = require("../../../../config/constants");
const authServices = require("../../../../lib/authentication");
const emailService = require("../../../../lib/email");
const { validation } = require("../../../../utils");

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
 * @returns {Promise<void>} Sends a confirmation response.
 *
 * @throws {Error} NotFound if the email is not registered.
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      throw badRequest([
        {
          field: "email",
          message: "Email is required",
          in: "body",
        },
      ]);
    }

    if (!validation.isValidEmail(email)) {
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

    // The email must belong to a registered account.
    if (!user) {
      throw notFound("Email is not registered");
    }

    if (user.account_status !== ACCOUNT_STATUS.BLOCKED) {
      await emailService.sendMail({
        email: user.email,
        subject: "Reset your password",
        text: `Hello ${user.name},\n\nYour password reset code is: ${code}`,
      });
    }

    return res.status(200).json({
      code: 200,
      message: "A password reset code has been sent to your email.",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = forgotPassword;
