const authServices = require("../../../../lib/authentication");
const { unauthorized } = require("../../../../utils/error");

/**
 * Refreshes the access token using a valid refresh token.
 *
 * Reads refresh token from HTTP-only cookie
 * Validates and rotates tokens via authentication service
 * Issues new access token and refresh token
 * Updates refresh token cookie
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.cookies - Request cookies
 * @param {string} [req.cookies.refreshToken] - Refresh token cookie
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error-handling middleware
 *
 * @returns {Promise<void>} Sends new access token to client
 *
 * @throws {Error} Unauthorized error if refresh token is missing or invalid
 */
const refresh = async (req, res, next) => {
  try {
    // Extract refresh token from cookie
    const refreshToken = req.cookies?.refreshToken;

    /**
     * Ensure refresh token exists before processing
     */
    if (!refreshToken) {
      throw unauthorized("Refresh token is missing");
    }

    /**
     * Validate refresh token and rotate session tokens
     */
    const { newAccessToken, newRefreshToken } =
      await authServices.refreshToken(refreshToken);

    /**
     * Update refresh token cookie with new rotated token
     */
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      code: 200,
      message: "Token refreshed successfully",
      data: {
        accessToken: newAccessToken,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = refresh;
