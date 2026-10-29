const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");
const emailService = require("../../../../lib/email");
const { validation } = require("../../../../utils");
const { mapSignUpUser } = require("../../../../utils/mappers");

/**
 * Register a user and sends an email verification code.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.name - User full name.
 * @param {string} req.body.email - User email address.
 * @param {string} req.body.password - Plain-text password.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 201 reply, or undefined when an error is forwarded to `next`.
 */
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const errors = [];

    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({
        field: "name",
        message: "Name is required and must be a valid string",
        in: "body",
      });
    }

    if (!email || typeof email !== "string") {
      errors.push({
        field: "email",
        message: "Email is required",
        in: "body",
      });
    } else if (!validation.isValidEmail(email)) {
      errors.push({
        field: "email",
        message: "Invalid email format",
        in: "body",
      });
    }

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
    } else if (validation.isPasswordTooLong(password)) {
      errors.push({
        field: "password",
        message: "Password must be at most 72 bytes long",
        in: "body",
      });
    }

    if (errors.length > 0) {
      throw badRequest(errors, "Validation failed");
    }

    const { verificationCode, ...user } = await authServices.register({
      name,
      email,
      password,
    });

    await emailService.sendMail({
      email: user.email,
      subject: "Activate your account",
      text: `Hello ${user.name},\n\nYour email verification code is: ${verificationCode}`,
    });

    return res.status(201).json({
      code: 201,
      message:
        "Account created successfully. Please check your email to activate your account.",
      data: mapSignUpUser(user),
      links: {
        self: "/api/v1/auth/sign-up",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = register;
