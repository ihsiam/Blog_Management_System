const PasswordResetToken = require("../../model/PasswordResetToken");
const { hashing } = require("../../utils");
const { TTL_MS } = require("../../config/constants");

/**
 * Create or replace the password reset token for a user.
 *
 * @param {string} userId - User ID.
 * @param {string} tokenHash - SHA-256 digest of the raw reset token.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<void>} Resolves when the token document is saved.
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
    // Upsert so the first request for a user creates the document.
    { upsert: true, new: true, session },
  );
};

/**
 * Find an unused, unexpired password reset token by its raw value.
 *
 * @param {string} token - Raw reset token.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object|null>} Reset token document, or null when invalid.
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
 * Mark a reset token as used.
 *
 * @param {string} id - Reset token ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<boolean>} True when the token was marked as used, or false when it was already used or does not exist.
 */
const markPasswordResetTokenUsed = async (id, session) => {
  const query = PasswordResetToken.updateOne(
    // Match only unused tokens so a token cannot be consumed twice.
    { _id: id, is_used: false },
    { $set: { is_used: true } },
  );
  if (session) query.session(session);

  const result = await query;
  return result.modifiedCount > 0;
};

/**
 * Delete all password reset tokens for a user.
 *
 * @param {string} userId - User ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<void>} Resolves when matching token documents are deleted.
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
