const userServices = require("../../../../lib/user");
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
    const userId = req.user?.id;

    /**
     * If no refresh token exists, user is already logged out
     * or session is invalid.
     */
    if (!refreshToken) {
      throw unauthorized("Already logged out");
    }

    // Remove refresh token from database to prevent reuse.
    if (userId) {
      await userServices.clearRefreshToken(userId);
    }

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
