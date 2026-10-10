const authServices = require("../../../../lib/authentication");
const { unauthorized } = require("../../../../utils/error");

/**
 * Issues a new access token for the device session of the refresh token.
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

    const { accessToken } = await authServices.refreshToken(refreshToken);

    return res.status(200).json({
      code: 200,
      message: "Token refreshed successfully",
      data: {
        accessToken,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = refresh;
