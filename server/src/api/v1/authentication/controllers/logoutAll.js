const sessionServices = require("../../../../lib/session");
const { clearRefreshTokenCookie } = require("../../../../utils/cookie");

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
    await sessionServices.clearRefreshToken({ id: req.user.id });
    clearRefreshTokenCookie(res);

    return res.status(200).json({
      code: 200,
      message: "Logged out from all devices successfully.",
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = logoutAll;
