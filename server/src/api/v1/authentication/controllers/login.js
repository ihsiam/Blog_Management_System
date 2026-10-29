const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");
const { validation } = require("../../../../utils");
const { setRefreshTokenCookie } = require("../../../../utils/cookie");

/**
 * Authenticate a user and issue access and refresh tokens.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.email - User email address.
 * @param {string} req.body.password - User password.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const errors = [];

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
    }

    if (errors.length > 0) {
      throw badRequest(errors, "Validation failed");
    }

    const { accessToken, refreshToken } = await authServices.login({
      email,
      password,
      deviceInfo: req.get("user-agent") || "unknown",
    });

    setRefreshTokenCookie(res, refreshToken);

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
