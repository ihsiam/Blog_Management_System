const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");

/**
 * Handles user login request.
 *
 * Validates email & password
 * Authenticates credentials
 * Issues JWT access and refresh tokens
 * Stores refresh token in HTTP-only cookie
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.email - User email address
 * @param {string} req.body.password - User password
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error-handling middleware
 *
 * @returns {Promise<void>} Sends authentication response with access token
 *
 * @throws {Error} BadRequest when validation fails
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Collect validation errors
    const errors = [];

    /**
     * Email validation
     */
    if (!email || typeof email !== "string") {
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
     * Password validation
     */
    if (!password || typeof password !== "string") {
      errors.push({
        field: "password",
        message: "Password is required",
        in: "body",
      });
    }

    /**
     * Stop execution if validation fails
     */
    if (errors.length > 0) {
      throw badRequest(errors, "Validation failed");
    }

    /**
     * Authenticate user and generate token pair
     */
    const { accessToken, refreshToken } = await authServices.login({
      email,
      password,
    });

    /**
     * Store refresh token in secure HTTP-only cookie
     */
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      code: 200,
      message: "Login successful",
      data: {
        accessToken,
      },
      links: {
        self: "/api/v1/auth/sign-in",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = login;
