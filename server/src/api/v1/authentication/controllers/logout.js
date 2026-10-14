const sessionServices = require("../../../../lib/session");
const tokenServices = require("../../../../lib/token");
const { unauthorized } = require("../../../../utils/error");
const { clearRefreshTokenCookie } = require("../../../../utils/cookie");

/**
 * Invalidates the current refresh-token session and clears its cookie.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.cookies - Request cookies.
 * @param {string} [req.cookies.refreshToken] - Refresh token cookie.
 *
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.id - User ID.
 *
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 *
 * @returns {Promise<void>} Sends a logout confirmation response.
 *
 * @throws {Error} Unauthorized error when session is invalid or already logged out
 */
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw unauthorized("Already logged out");
    }

    const decoded = tokenServices.verifyRefreshToken(refreshToken);

    // The cookie must belong to the authenticated user.
    if (decoded.id !== req.user.id) {
      throw unauthorized("Invalid session");
    }

    const session = await sessionServices.findSessionByToken({
      id: decoded.id,
      sessionId: decoded.sid,
      refreshToken,
    });

    if (!session) {
      throw unauthorized("Session already invalidated");
    }

    await sessionServices.deleteSession(decoded.id, session.id);

    clearRefreshTokenCookie(res);

    return res.status(200).json({
      code: 200,
      message: "Logged out successfully",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = logout;
