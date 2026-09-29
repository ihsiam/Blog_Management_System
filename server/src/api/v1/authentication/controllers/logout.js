const userServices = require("../../../../lib/user");
const tokenServices = require("../../../../lib/token");
const { unauthorized } = require("../../../../utils/error");

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

    const user = await userServices.findAuthUserById(decoded.id);

    if (!user) {
      throw unauthorized("Invalid session");
    }

    const session = await userServices.findSessionByToken(
      decoded.id,
      refreshToken,
    );

    if (!session) {
      await userServices.clearRefreshToken(decoded.id, refreshToken);
      throw unauthorized("Session already invalidated");
    }

    await userServices.clearRefreshToken(decoded.id, refreshToken);

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
