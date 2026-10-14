const PasswordResetToken = require("../../model/PasswordResetToken");
const { hashing } = require("../../utils");
const { TTL_MS } = require("../../config/constants");

/**
 * Create or replace the reset token of a user
 *
 * @param {string} userId - User ID
 * @param {string} tokenHash - SHA-256 digest of the raw reset token
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
 */
const savePasswordResetToken = async (userId, tokenHash, session) => {
  await PasswordResetToken.findOneAndUpdate(
    { user_id: userId },
    {
      $set: {
        token_hash: tokenHash,
        is_used: false,
        expiresAt: new Date(Date.now() + TTL_MS.RESET_TOKEN),
      },
    },
    { upsert: true, new: true, session },
  );
};

/**
 * Find an unused, unexpired password reset token by its raw value
 *
 * @param {string} token - Raw reset token
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object|null>} Reset token document or null
 */
const findPasswordResetToken = async (token, session) => {
  const query = PasswordResetToken.findOne({
    token_hash: hashing.generateDigest(token),
    is_used: false,
    expiresAt: { $gt: new Date() },
  });
  if (session) query.session(session);

  return query;
};

/**
 * Mark a reset token as used
 *
 * @param {string} id - Reset token ID
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<boolean>} False when the token was already used
 */
const markPasswordResetTokenUsed = async (id, session) => {
  const query = PasswordResetToken.updateOne(
    { _id: id, is_used: false },
    { $set: { is_used: true } },
  );
  if (session) query.session(session);

  const result = await query;
  return result.modifiedCount > 0;
};

/**
 * Delete the reset token of a user
 *
 * @param {string} userId - User ID
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
 */
const deletePasswordResetTokenByUser = async (userId, session) => {
  await PasswordResetToken.deleteMany(
    { user_id: userId },
    session ? { session } : undefined,
  );
};

module.exports = {
  savePasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  deletePasswordResetTokenByUser,
};
