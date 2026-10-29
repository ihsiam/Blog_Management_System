const OTP = require("../../model/OTP");
const defaults = require("../../config/defaults");
const { deleteCache, incrementCounter } = require("../../utils/cache");

// OTP lifetime, in seconds
const OTP_TTL_SECONDS = 5 * 60;

/**
 * Build the Redis key for OTP attempt counting.
 *
 * @param {string} userId - User ID.
 * @param {string} purpose - OTP purpose.
 * @returns {string} Cache key for the attempt counter.
 */
const otpAttemptsKey = (userId, purpose) => `otp:attempts:${purpose}:${userId}`;

/**
 * Create or replace the OTP for a user and purpose.
 *
 * @param {string} userId - User ID.
 * @param {string} purpose - OTP purpose.
 * @param {string} codeHash - Hashed OTP code.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<void>} Resolves when the OTP document is saved.
 */
const createOtp = async (userId, purpose, codeHash, session) => {
  await OTP.findOneAndUpdate(
    { user_id: userId, purpose },
    {
      $set: {
        code_hash: codeHash,
        is_used: false,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    },
    { upsert: true, new: true, session },
  );

  // A new code starts with a fresh attempt budget.
  await deleteCache(otpAttemptsKey(userId, purpose));
};

/**
 * Consume one verification attempt against a valid OTP.
 *
 * @param {string} userId - User ID.
 * @param {string} purpose - OTP purpose.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object|null>} OTP document, or null when the attempt limit is exceeded or no unused, unexpired OTP exists.
 */
const claimOtpAttempt = async (userId, purpose, session) => {
  const attempts = await incrementCounter(
    otpAttemptsKey(userId, purpose),
    OTP_TTL_SECONDS,
  );

  // A null count means no counter is available, so the limit is not enforced here.
  if (attempts !== null && attempts > defaults.otpMaxAttempts) {
    return null;
  }

  const query = OTP.findOne({
    user_id: userId,
    purpose,
    is_used: false,
    expiresAt: { $gt: new Date() },
  });
  if (session) query.session(session);

  return query;
};

/**
 * Mark an OTP as used.
 *
 * @param {string} id - OTP ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<boolean>} True when the OTP was marked as used, false when it was already used or does not exist.
 */
const markOtpUsed = async (id, session) => {
  const query = OTP.updateOne(
    { _id: id, is_used: false },
    { $set: { is_used: true } },
  );
  if (session) query.session(session);

  const result = await query;
  return result.modifiedCount > 0;
};

/**
 * Delete all OTPs belonging to a user.
 *
 * @param {string} userId - User ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<void>} Resolves when matching OTP documents are deleted.
 */
const deleteOtpsByUser = async (userId, session) => {
  await OTP.deleteMany({ user_id: userId }, session ? { session } : undefined);
};

module.exports = {
  createOtp,
  claimOtpAttempt,
  markOtpUsed,
  deleteOtpsByUser,
};
