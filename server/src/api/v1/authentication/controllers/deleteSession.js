const mongoose = require("mongoose");
const userServices = require("../../../../lib/user");
const { badRequest, notFound } = require("../../../../utils/error");

/**
 * Deletes an authenticated user's session.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {string} req.params.sessionId - Session identifier.
 * @param {import("express").Response} res - Express response object.
 * @param {Function} next - Express error-handling middleware.
 * @returns {Promise<void>} Sends an empty response after deletion.
 * @throws {Error} BadRequest if the session ID is invalid.
 * @throws {Error} NotFound if the session does not exist.
 */
const deleteSession = async (req, res, next) => {
  try {
    const { sessionId } = req.params;
    if (!sessionId) throw badRequest(null, "Session ID is required");
    if (!mongoose.isValidObjectId(sessionId)) {
      throw badRequest(null, "Invalid session ID");
    }

    const deleted = await userServices.deleteSession(req.user.id, sessionId);
    if (!deleted) throw notFound("Session not found");

    return res.status(204).send();
  } catch (err) {
    return next(err);
  }
};

module.exports = deleteSession;
