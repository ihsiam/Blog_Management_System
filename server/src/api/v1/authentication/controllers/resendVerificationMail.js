const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");
const { ACCOUNT_STATUS } = require("../../../../config/constants");
const emailService = require("../../../../lib/email");
const { validation } = require("../../../../utils");

/**
 * Resend an account verification code to a pending user.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.email - User email address.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const resendVerificationMail = async (req, res, next) => {
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

    const { user, code } = await authServices.createVerificationOtp(
      email.trim(),
    );

    if (user && user.account_status === ACCOUNT_STATUS.PENDING) {
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
