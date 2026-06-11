const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");

/**
 * User login controller
 * - Validates input
 * - Authenticates user
 * - Issues access + refresh tokens
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Collect validation errors
    const errors = [];

    /**
     * Validate email
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
     * Validate password
     */
    if (!password || typeof password !== "string") {
      errors.push({
        field: "password",
        message: "Password is required",
        in: "body",
      });
    }

    /**
     * Throw validation error if needed
     */
    if (errors.length > 0) {
      throw badRequest(errors, "Validation failed");
    }

    /**
     * Authenticate user & generate tokens
     */
    const { accessToken, refreshToken } = await authServices.login({
      email,
      password,
    });

    /**
     * Set refresh token in HTTP-only cookie
     */
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
    });

    /**
     * Send response
     */
    return res.status(200).json({
      code: 200,
      message: "Login successful",
      data: {
        accessToken,
      },
      links: {
        self: "/api/v1/auth/signin",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = login;
