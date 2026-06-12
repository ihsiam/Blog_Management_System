const authServices = require("../../../../lib/authentication");
const tokenServices = require("../../../../lib/token");
const { badRequest } = require("../../../../utils/error");
const emailService = require("../../../../lib/email");

/**
 * Handles user registration and account activation flow.
 *
 * Validates incoming user input (name, email, password)
 * Creates user in database (pending)
 * Generates account activation token
 * Sends activation email with secure verification link
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.name - User full name
 * @param {string} req.body.email - User email address
 * @param {string} req.body.password - Plain text password
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends user registration confirmation response
 *
 * @throws {Error} BadRequest error if validation fails
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Collect validation errors for structured response
    const errors = [];

    // Name validation
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({
        field: "name",
        message: "Name is required and must be a valid string",
        in: "body",
      });
    }

    // Email validation
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

    // Password validation
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

    // Returns structured error response
    if (errors.length > 0) {
      throw badRequest(errors, "Validation failed");
    }

    // Create user in system (initial state: pending)
    const user = await authServices.register({ name, email, password });

    // JWT payload used for account activation
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    // Generate activation token
    const activationToken = tokenServices.generateActiveResetToken(payload);

    // Activation link sent to user email
    const activationUrl = `${process.env.APP_URL}/api/v1/auth/verify-email/${activationToken}`;

    // Send account activation email
    await emailService.sendMail({
      email,
      subject: "Activate your account",
      text: `Hello ${user.name},\n\nPlease activate your account using the link below:\n${activationUrl}`,
    });

    // Registration response
    return res.status(201).json({
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
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = register;
