const OTP = require("../../model/OTP");
const defaults = require("../../config/defaults");
const { deleteCache, incrementCounter } = require("../../utils/cache");

// OTPs are valid for 5 minutes
const OTP_TTL_SECONDS = 5 * 60;

const otpAttemptsKey = (userId, purpose) => `otp:attempts:${purpose}:${userId}`;

/**
 * Create or replace the OTP of a user for a purpose
 *
 * The previous code of the same purpose is invalidated by the overwrite.
 *
 * @param {string} userId - User ID
 * @param {string} purpose - OTP purpose
 * @param {string} codeHash - Hashed OTP code
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
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

  // a new code starts with a fresh attempt budget
  await deleteCache(otpAttemptsKey(userId, purpose));
};

/**
 * Atomically consume one verification attempt of a valid OTP
 *
 * The attempt is counted in Redis before the code is compared, so concurrent
 * guesses cannot exceed `defaults.otpMaxAttempts`. A code that ran out of
 * attempts is no longer returned and must be requested again. When Redis is
 * unavailable the counter is skipped and only the IP rate limit applies.
 *
 * @param {string} userId - User ID
 * @param {string} purpose - OTP purpose
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object|null>} OTP document or null
 */
const claimOtpAttempt = async (userId, purpose, session) => {
  const attempts = await incrementCounter(
    otpAttemptsKey(userId, purpose),
    OTP_TTL_SECONDS,
  );

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
 * Mark an OTP as used
 *
 * @param {string} id - OTP ID
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<boolean>} False when the OTP was already used
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
 * Delete all OTPs of a user
 *
 * @param {string} userId - User ID
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
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
