const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");
const tokenServices = require("../../../../lib/token");
const emailService = require("../../../../lib/email");

/**
 * Sends a password reset email to a registered user.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.email - User email address
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends confirmation response
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    /**
     * Validate email presence and format
     */
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

    /**
     * Fetch user by email
     */
    const user = await userServices.findUserByEmail(email);

    /**
     * Always return a generic response to prevent user enumeration
     */
    const responseMessage =
      "If this email is registered, you will receive a password reset link.";

    if (user) {
      /**
       * Restrict password reset for declined accounts
       */
      if (user.status === "declined") {
        return res.status(200).json({
          code: 200,
          message: responseMessage,
        });
      }

      /**
       * Build JWT payload for reset token
       */
      const payload = {
        id: user.id,
        role: user.role,
        email: user.email,
      };

      /**
       * Generate password reset token
       */
      const resetToken = tokenServices.generateActiveResetToken(payload);

      /**
       * Construct password reset URL
       */
      const resetUrl = `${process.env.APP_URL}/api/v1/auth/reset-password/${resetToken}`;

      /**
       * Send password reset email
       */
      await emailService.sendMail({
        email: user.email,
        subject: "Reset your password",
        text: `Hello ${user.name},\n\nPlease reset your password using the link below:\n${resetUrl}`,
      });
    }

    /**
     * Response     */
    return res.status(200).json({
      code: 200,
      message: responseMessage,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = forgotPassword;
