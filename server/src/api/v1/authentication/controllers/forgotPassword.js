const { badRequest, forbidden, notFound } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");
const tokenServices = require("../../../../lib/token");
const emailService = require("../../../../lib/email");

/**
 * Sends password reset email to a registered user.
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
 * @throws {Error} Forbidden if account is declined
 */
const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Validate email
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

    // Fetch user by email
    const user = await userServices.findUserByEmail(email);

    if (!user) {
      throw notFound("User not found");
    }

    // Prevent reset for declined users
    if (user.status === "declined") {
      throw forbidden("Your registration has been declined");
    }

    // JWT payload
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    // Generate reset token
    const resetToken = tokenServices.generateActiveResetToken(payload);

    // Build reset URL
    const resetUrl = `${process.env.APP_URL}/api/v1/auth/reset-password/${resetToken}`;

    // Send reset email
    await emailService.sendMail({
      email,
      subject: "Reset your password",
      text: `Hello ${user.name},\n\nPlease reset your password using the link below:\n${resetUrl}`,
    });

    // Success response
    return res.status(200).json({
      code: 200,
      message: "Password reset email sent",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = forgotPassword;
