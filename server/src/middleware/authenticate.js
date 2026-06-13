const tokenServices = require("../lib/token");
const userServices = require("../lib/user");
const { unauthorized, forbidden } = require("../utils/error");

/**
 * Authenticates incoming requests using a JWT access token.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.headers - Incoming request headers
 * @param {string} [req.headers.authorization] - Bearer access token
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express middleware callback
 *
 * @returns {Promise<void>} Passes control to the next middleware
 *
 * @throws {Error} Unauthorized error for invalid authentication
 * @throws {Error} Forbidden error for inactive accounts
 */
const authenticate = async (req, res, next) => {
  try {
    // Extract Authorization header
    const authHeader = req.headers.authorization;

    // Validate Authorization header format.
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(unauthorized("Authorization token missing"));
    }

    // Extract raw JWT access token
    const token = authHeader.split(" ")[1];

    // Verify & decode token
    const decoded = tokenServices.verifyAccessToken(token);

    // Retrieve authenticated user from database
    const user = await userServices.findAuthUserById(decoded.id);

    if (!user) {
      return next(unauthorized("Invalid authentication token"));
    }

    // Ensure user still has a valid session.
    if (!user.refreshToken) {
      return next(unauthorized("Session expired"));
    }

    /**
     * Prevent access for accounts that have not been
     * activated or are otherwise restricted.
     */
    if (user.status !== "approved") {
      return next(forbidden("Your account is not active"));
    }

    // Attach authenticated user context to the request.
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = authenticate;
