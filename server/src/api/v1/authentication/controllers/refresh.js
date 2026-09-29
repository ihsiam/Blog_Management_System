const authServices = require("../../../../lib/authentication");
const { unauthorized } = require("../../../../utils/error");

/**
 * Refreshes the access token and rotates the refresh-token session.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.cookies - Request cookies.
 * @param {string} [req.cookies.refreshToken] - Refresh token cookie.
 *
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 *
 * @returns {Promise<void>} Sends a new access token to the client.
 *
 * @throws {Error} Unauthorized error if refresh token is missing or invalid
 */
const refresh = async (req, res, next) => {
  try {
    const refreshToken = req.cookies?.refreshToken;

    if (!refreshToken) {
      throw unauthorized("Refresh token is missing");
    }

    const { newAccessToken, newRefreshToken } =
      await authServices.refreshToken(refreshToken);

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
