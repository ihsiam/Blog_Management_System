const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");
const emailService = require("../../../../lib/email");

/**
 * Resends an account verification code to a pending user.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.email - User email address.
 *
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 *
 * @returns {Promise<void>} Sends a generic confirmation response.
 *
 * @throws {Error} BadRequest if email validation fails
 * @throws {Error} NotFound if user does not exist
 * @throws {Error} Forbidden if account is already active
 */
const resendVerificationMail = async (req, res, next) => {
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

    const { user, code } = await authServices.createVerificationOtp(
      email.trim(),
    );

    if (user && user.account_status === "pending") {
      await emailService.sendMail({
        email: user.email,
        subject: "Verify your account",
        text: `Hello ${user.name},\n\nYour email verification code is: ${code}`,
      });
    }

    return res.status(200).json({
      code: 200,
      message:
        "If an account with that email exists, a verification code has been sent.",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = resendVerificationMail;
