const tokenServices = require("../lib/token");
const userServices = require("../lib/user");
const sessionServices = require("../lib/session");
const { ACCOUNT_STATUS } = require("../config/constants");

/**
 * Loads an authenticated user when a valid bearer token is provided.
 * Public requests continue without a user context.
 *
 * @param {import("express").Request} req - Express request object
 * @param {import("express").Response} _res - Express response object
 * @param {Function} next - Express middleware callback
 *
 * @returns {Promise<void>} Passes control to the next middleware
 */
const authenticateOptional = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];
    const decoded = tokenServices.verifyAccessToken(token);
    const user = await userServices.findAuthUserById(decoded.id);

    // Skip the session lookup when the user does not exist.
    const hasSession =
      user && (await sessionServices.hasActiveSession(user.id, decoded.sid));

    // Set `req.user` only for active accounts with an active session.
    if (hasSession && user.account_status === ACCOUNT_STATUS.ACTIVE) {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.account_status,
        sessionId: decoded.sid,
      };
    }

    return next();
  } catch (err) {
    // Forward token verification and unexpected errors to the error handler.
    return next(err);
  }
};

module.exports = authenticateOptional;
