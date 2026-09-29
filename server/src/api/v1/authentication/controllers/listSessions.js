const userServices = require("../../../../lib/user");

/**
 * Lists the authenticated user's active sessions.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 * @returns {Promise<void>} Sends the active sessions.
 */
const listSessions = async (req, res, next) => {
  try {
    const sessions = await userServices.getActiveSessions(
      req.user.id,
      req.cookies?.refreshToken,
    );

    return res.status(200).json({
      code: 200,
      message: "Data retrieved.",
      data: sessions,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = listSessions;
