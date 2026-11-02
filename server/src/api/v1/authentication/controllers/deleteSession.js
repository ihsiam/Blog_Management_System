const mongoose = require("mongoose");
const sessionServices = require("../../../../lib/session");
const { badRequest, notFound } = require("../../../../utils/error");

/**
 * Delete an authenticated user's session.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.sessionId - Session identifier.
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.id - Authenticated user ID.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 204 reply, or undefined when an error is forwarded to `next`.
 */
const deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) throw badRequest(null, "Session ID is required");
    if (!mongoose.isValidObjectId(sessionId)) {
      throw badRequest(null, "Invalid session ID");
    }

    const deleted = await sessionServices.deleteSession(req.user.id, sessionId);
    if (!deleted) throw notFound("Session not found");

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};

module.exports = deleteSession;
