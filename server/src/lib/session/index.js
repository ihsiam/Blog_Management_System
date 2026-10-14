const mongoose = require("mongoose");
const Session = require("../../model/Session");
const { hashing } = require("../../utils");
const { TTL_MS } = require("../../config/constants");

/**
 * Save refresh token as a new session
 *
 * The token is stored as a SHA-256 digest so the session can be found with
 * an indexed lookup (bcrypt would truncate JWTs at 72 bytes).
 *
 * @param {Object} params
 * @param {string} params.id - User ID
 * @param {string|ObjectId} params.sessionId - Pre-generated session ID embedded in the token
 * @param {string} params.refreshToken - Raw refresh token
 * @param {string} [params.deviceInfo] - Client device information
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
 */
const saveRefreshToken = async (
  { id, sessionId, refreshToken, deviceInfo },
  session,
) => {
  const refreshTokenHash = hashing.generateDigest(refreshToken);

  const expiresAt = new Date(Date.now() + TTL_MS.SESSION);

  const sessionData = new Session({
    _id: sessionId,
    user_id: id,
    refresh_token_hash: refreshTokenHash,
    device_info: deviceInfo || "unknown",
    expiresAt,
  });

  await sessionData.save({ session });
};

/**
 * Clear all refresh-token sessions of a user
 *
 * @param {Object} params
 * @param {string} params.id - User ID
 * @param {string} [params.exceptSessionId] - Session ID to keep (e.g. the current device)
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
 */
const clearRefreshToken = async ({ id, exceptSessionId }, session) => {
  const filter = { user_id: id };

  if (exceptSessionId) filter._id = { $ne: exceptSessionId };

  await Session.deleteMany(filter, session ? { session } : undefined);
};

/**
 * Find a user's active session by session ID and raw refresh token.
 *
 * @param {Object} params
 * @param {string} params.id - User ID
 * @param {string} params.sessionId - Session ID taken from the verified token
 * @param {string} params.refreshToken - Raw refresh token
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object|null>} Matching session or null
 */
const findSessionByToken = async ({ id, sessionId, refreshToken }, session) => {
  if (!refreshToken || !mongoose.isValidObjectId(sessionId)) return null;

  const query = Session.findOne({
    _id: sessionId,
    user_id: id,
    refresh_token_hash: hashing.generateDigest(refreshToken),
    expiresAt: { $gt: new Date() },
  });
  if (session) query.session(session);

  return query;
};

/**
 * Get a user's active sessions
 *
 * @param {string} id - User ID
 * @param {string} [currentSessionId] - Session ID of the calling device
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Array<Object>>}
 */
const getActiveSessions = async (id, currentSessionId, session) => {
  const query = Session.find({
    user_id: id,
    expiresAt: { $gt: new Date() },
  }).sort({
    createdAt: -1,
  });
  if (session) query.session(session);

  const sessions = await query;

  return sessions.map((item) => ({
    id: item.id,
    deviceInfo: item.device_info,
    isCurrent: item.id === currentSessionId,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
  }));
};

/**
 * Check that a session is still active for a user
 *
 * @param {string} id - User ID
 * @param {string} sessionId - Session ID taken from the verified access token
 * @returns {Promise<boolean>}
 */
const hasActiveSession = async (id, sessionId) => {
  if (!mongoose.isValidObjectId(sessionId)) return false;

  const exists = await Session.exists({
    _id: sessionId,
    user_id: id,
    expiresAt: { $gt: new Date() },
  });

  return !!exists;
};

/**
 * Delete one session of a user
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<boolean>} True when a session was deleted
 */
const deleteSession = async (userId, sessionId, session) => {
  const query = Session.deleteOne({ _id: sessionId, user_id: userId });
  if (session) query.session(session);

  const result = await query;
  return result.deletedCount > 0;
};

/**
 * Delete expired sessions of a user
 *
 * Keeps the sessions collection from growing without a TTL index.
 *
 * @param {string} id - User ID
 * @returns {Promise<void>}
 */
const deleteExpiredSessions = async (id) => {
  await Session.deleteMany({ user_id: id, expiresAt: { $lte: new Date() } });
};

module.exports = {
  saveRefreshToken,
  clearRefreshToken,
  findSessionByToken,
  getActiveSessions,
  hasActiveSession,
  deleteSession,
  deleteExpiredSessions,
};
