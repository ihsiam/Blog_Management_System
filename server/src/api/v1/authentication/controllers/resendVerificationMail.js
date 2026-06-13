const { badRequest, forbidden, notFound } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");
const tokenServices = require("../../../../lib/token");
const emailService = require("../../../../lib/email");

/**
 * Resend account verification email to a pending user.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.email - User email address
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error-handling middleware
 *
 * @returns {Promise<void>} Sends confirmation response
 *
 * @throws {Error} BadRequest if email validation fails
 * @throws {Error} NotFound if user does not exist
 * @throws {Error} Forbidden if account is already active
 */
const resendVerificationMail = async (req, res, next) => {
  try {
    const { email } = req.body;

    /**
     * Validate email presence
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
     * Allow resend only for pending accounts
     */
    if (user.status !== "pending") {
      throw forbidden("Account is already active");
    }

    /**
     * Build JWT payload for activation token
     */
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    /**
     * Generate activation token
     */
    const activationToken = tokenServices.generateActiveResetToken(payload);

    /**
     * Construct verification URL
     */
    const activationUrl = `${process.env.APP_URL}/api/v1/auth/verify-email/${activationToken}`;

    /**
     * Send verification email
     */
    await emailService.sendMail({
      email,
      subject: "Activate your account",
      text: `Hello ${user.name},\n\nPlease activate your account using the link below:\n${activationUrl}`,
    });

    return res.status(200).json({
      code: 200,
      message: "Verification email sent",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = resendVerificationMail;
