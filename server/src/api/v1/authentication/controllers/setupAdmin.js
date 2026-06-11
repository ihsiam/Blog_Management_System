const authServices = require("../../../../lib/authentication");
const tokenServices = require("../../../../lib/token");
const userServices = require("../../../../lib/user");
const { badRequest } = require("../../../../utils/error");

/**
 * Create system administrator account
 * This is a privileged endpoint and should be protected in production
 */
const setupAdmin = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Collect validation errors
    const errors = [];

    /**
     * Validate name
     */
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({
        field: "name",
        message: "Name is required",
        in: "body",
      });
    }

    /**
     * Validate email
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
        message: "Password must be at least 8 characters",
        in: "body",
      });
    }

    /**
     * Throw validation error if any
     */
    if (errors.length > 0) {
      throw badRequest(errors, "Validation failed");
    }

    /**
     * Create system admin user
     */
    const user = await authServices.systemAdmin({ name, email, password });

    /**
     * Prepare JWT payload
     */
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    /**
     * Generate tokens
     */
    const accessToken = tokenServices.generateAccessToken(payload);
    const refreshToken = tokenServices.generateRefreshToken(payload);

    /**
     * Save refresh token in DB
     */
    await userServices.saveRefreshToken(user.id, refreshToken);

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
