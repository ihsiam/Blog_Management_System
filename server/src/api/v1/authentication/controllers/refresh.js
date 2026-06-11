const authServices = require("../../../../lib/authentication");
const { unauthorized } = require("../../../../utils/error");

/**
 * Refresh access token using refresh token from cookies
 */
const refresh = async (req, res, next) => {
  try {
    // Extract refresh token from HTTP-only cookie
    const refreshToken = req.cookies?.refreshToken;

    /**
     * Ensure refresh token exists
     */
    if (!refreshToken) {
      throw unauthorized("Refresh token is missing");
    }

    /**
     * Generate new access + refresh tokens
     */
    const { newAccessToken, newRefreshToken } =
      await authServices.refreshToken(refreshToken);

    /**
     * Update refresh token cookie
     */
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
    });

    /**
     * Return new access token
     */
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
