const userServices = require("../../../../lib/user");

/**
 * Logs the authenticated user out of all devices.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 * @returns {Promise<void>} Sends a logout confirmation response.
 */
const logoutAll = async (req, res, next) => {
  try {
    await userServices.clearRefreshToken(req.user.id);
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      code: 200,
      message: "Logged out from all devices successfully.",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = logoutAll;
