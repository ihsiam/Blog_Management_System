const userServices = require("../../../../lib/user");
const tokenServices = require("../../../../lib/token");
const { unauthorized } = require("../../../../utils/error");

/**
 * Handles user logout request.
 *
 * Invalidates user session by clearing refresh token from database
 * Removes refresh token cookie from client
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.cookies - Request cookies
 * @param {string} [req.cookies.refreshToken] - Refresh token cookie
 *
 * @param {Object} req.user - Authenticated user (if attached by middleware)
 * @param {string} req.user.id - User ID
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error-handling middleware
 *
 * @returns {Promise<void>} Sends logout confirmation response
 *
 * @throws {Error} Unauthorized error when session is invalid or already logged out
 */
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    /**
     * No refresh token means session is already invalid or missing
     */
    if (!refreshToken) {
      throw unauthorized("Already logged out");
    }

    /**
     * Verify refresh token signature and decode payload
     */
    const decoded = tokenServices.verifyRefreshToken(refreshToken);

    /**
     * Fetch user
     */
    const user = await userServices.findAuthUserById(decoded.id);

    if (!user) {
      throw unauthorized("Invalid session");
    }

    /**
     * Ensure token matches stored session token
     * Prevents reuse of old or revoked tokens
     */
    if (user.refreshToken !== refreshToken) {
      await userServices.clearRefreshToken(decoded.id);
      throw unauthorized("Session already invalidated");
    }

    /**
     * Invalidate session in database
     */
    await userServices.clearRefreshToken(decoded.id);

    /**
     * Remove refresh token cookie from client
     */
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      code: 200,
      message: "Logged out successfully",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = logout;
