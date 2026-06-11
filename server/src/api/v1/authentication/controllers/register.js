const authServices = require("../../../../lib/authentication");
const tokenServices = require("../../../../lib/token");
const { badRequest } = require("../../../../utils/error");
const emailService = require("../../../../lib/email");

/**
 * Register a new user and send account activation email
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Collect validation errors instead of failing fast
    const errors = [];

    /**
     * Validate name
     * - must exist
     * - must be a non-empty string
     */
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({
        field: "name",
        message: "Name is required and must be a valid string",
        in: "body",
      });
    }

    /**
     * Validate email
     * - must exist
     * - must follow basic email format
     */
    if (!email) {
      errors.push({
        field: "email",
        message: "Email is required",
        in: "body",
      });
    } else {
      const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

      if (!isValidEmail) {
        errors.push({
          field: "email",
          message: "Invalid email format",
          in: "body",
        });
      }
    }

    /**
     * Validate password
     * - must exist
     * - must be string
     * - must have minimum length
     */
    if (!password || typeof password !== "string") {
      errors.push({
        field: "password",
        message: "Password is required",
        in: "body",
      });
    } else if (password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 characters long",
        in: "body",
      });
    }

    /**
     * If validation fails, throw structured bad request error
     */
    if (errors.length > 0) {
      throw badRequest(errors, "Validation failed");
    }

    /**
     * Create user in database
     */
    const user = await authServices.register({ name, email, password });

    /**
     * Prepare JWT payload for activation token
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
     * Build activation URL (consider moving to config in production)
     */
    const activationUrl = `${process.env.APP_URL}/auth/verify-email/${activationToken}`;

    /**
     * Send activation email
     */
    await emailService.sendMail({
      email,
      subject: "Activate your account",
      text: `Hello ${user.name},\n\nPlease activate your account using the link below:\n${activationUrl}`,
    });

    /**
     * API response payload
     */
    const response = {
      code: 201,
      message:
        "Account created successfully. Please check your email to activate your account.",
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      links: {
        self: "/api/v1/auth/sign-up",
      },
    };

    return res.status(201).json(response);
  } catch (err) {
    return next(err);
  }
};

module.exports = register;
