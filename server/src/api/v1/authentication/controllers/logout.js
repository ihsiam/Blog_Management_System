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
 * @param {string} req.cookies.refreshToken - User refresh token cookie
 * @param {Object} req.user - Authenticated user (set by auth middleware)
 * @param {string} req.user.id - Authenticated user ID
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends logout confirmation response
 *
 * @throws {Error} Unauthorized error if user is already logged out
 */
const logout = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    /**
     * If no refresh token exists, user is already logged out
     * or session is invalid.
     */
    if (!refreshToken) {
      throw unauthorized("Already logged out");
    }

    // verify token
    const decoded = tokenServices.verifyRefreshToken(refreshToken);

    // find user
    const user = await userServices.findUserById(decoded.id);

    if (!user) {
      throw unauthorized("Invalid session");
    }

    // validate token match
    if (user.refreshToken !== refreshToken) {
      await userServices.clearRefreshToken(decoded.id);
      throw unauthorized("Session already invalidated");
    }

    // clear session
    await userServices.clearRefreshToken(decoded.id);

    // Clear authentication cookie from browser.
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    // Logout success response
    return res.status(200).json({
      code: 200,
      message: "Logged out successfully",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = logout;
