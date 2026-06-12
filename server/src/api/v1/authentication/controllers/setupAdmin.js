const authServices = require("../../../../lib/authentication");
const tokenServices = require("../../../../lib/token");
const userServices = require("../../../../lib/user");
const { badRequest } = require("../../../../utils/error");

/**
 * Creates the initial system administrator account.
 *
 * This endpoint is intended for one-time system bootstrap and should
 * be disabled or protected after initial setup.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.name - Administrator name
 * @param {string} req.body.email - Administrator email address
 * @param {string} req.body.password - Administrator password
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handling middleware
 *
 * @returns {Promise<void>} Sends authentication response
 *
 * @throws {Error} BadRequest error when validation fails
 */
const setupAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Collect validation errors and return them together
    const errors = [];

    // Validate administrator name.
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({
        field: "name",
        message: "Name is required",
        in: "body",
      });
    }

    // Validate email format
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

    // Validate password
    if (!password || typeof password !== "string") {
      errors.push({
        field: "password",
        message: "Password is required",
        in: "body",
      });
    } else if (password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 characters",
        in: "body",
      });
    }

    // Returns structured error response
    if (errors.length > 0) {
      throw badRequest(errors, "Validation failed");
    }

    // Create administrator account.
    const user = await authServices.systemAdmin({ name, email, password });

    // JWT payload
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    // Generate authentication token pair
    const accessToken = tokenServices.generateAccessToken(payload);
    const refreshToken = tokenServices.generateRefreshToken(payload);

    // Stores refresh token into DB.
    await userServices.saveRefreshToken(user.id, refreshToken);

    // Store refresh token in cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
    });

    // Successful creation response
    return res.status(201).json({
      code: 201,
      message: "System administrator created successfully",
      data: {
        accessToken,
      },
      links: {
        signin: "/api/v1/auth/sign-in",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = setupAdmin;
