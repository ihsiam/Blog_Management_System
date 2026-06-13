const { badRequest, forbidden, notFound } = require("../../../../utils/error");
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
 *
 * @throws {Error} BadRequest if email is invalid
 * @throws {Error} NotFound if user does not exist
 * @throws {Error} Forbidden if account is not allowed to reset password
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

    if (!user) {
      throw notFound("User not found");
    }

    /**
     * Restrict password reset for declined accounts
     */
    if (user.status === "declined") {
      throw forbidden("Your registration has been declined");
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
      email,
      subject: "Reset your password",
      text: `Hello ${user.name},\n\nPlease reset your password using the link below:\n${resetUrl}`,
    });

    /**
     * Response
     */
    return res.status(200).json({
      code: 200,
      message: "Password reset email sent",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = forgotPassword;
