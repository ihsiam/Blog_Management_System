const tokenServices = require("../lib/token");
const userServices = require("../lib/user");
const sessionServices = require("../lib/session");
const { ACCOUNT_STATUS } = require("../config/constants");
const { unauthorized, forbidden } = require("../utils/error");

/**
 * Authenticate the request from a Bearer JWT and attach `req.user`.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.headers - Incoming request headers.
 * @param {string} [req.headers.authorization] - Bearer access token.
 *
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express middleware callback.
 *
 * @returns {Promise<void>} Passes control to the next middleware.
 *
 * @throws {Error} Unauthorized error for invalid authentication.
 * @throws {Error} Forbidden error for inactive accounts.
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(unauthorized("Authorization token missing"));
    }

    const token = authHeader.split(" ")[1];

    const decoded = tokenServices.verifyAccessToken(token);

    const user = await userServices.findAuthUserById(decoded.id);

    if (!user) {
      return next(unauthorized("Invalid authentication token"));
    }

    // Access tokens are bound to the device session they were issued for.
    const hasSession = await sessionServices.hasActiveSession(
      user.id,
      decoded.sid,
    );

    if (!hasSession) {
      return next(unauthorized("Session expired"));
    }

    // Block inactive accounts even when the access token is otherwise valid.
    if (user.account_status !== ACCOUNT_STATUS.ACTIVE) {
      return next(forbidden("Your account is not active"));
    }

    // Expose only the fields that later handlers need.
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.account_status,
      sessionId: decoded.sid,
    };

    return next();
  } catch (err) {
    // Forward unexpected and token verification errors to the error handler.
    return next(err);
  }
};

module.exports = authenticate;
