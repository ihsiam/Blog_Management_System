const sessionServices = require("../../../../lib/session");

/**
 * List the authenticated user's active sessions.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.id - Authenticated user ID.
 * @param {string} req.user.sessionId - Current session ID.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const listSessions = async (req, res, next) => {
  try {
    const sessions = await sessionServices.getActiveSessions(
      req.user.id,
      req.user.sessionId,
    );

    return res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data: sessions,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = listSessions;
