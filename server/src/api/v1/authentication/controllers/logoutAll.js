const sessionServices = require("../../../../lib/session");
const { clearRefreshTokenCookie } = require("../../../../utils/cookie");

/**
 * Log the authenticated user out of all devices.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.id - User ID.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
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
