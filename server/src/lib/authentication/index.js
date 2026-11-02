const mongoose = require("mongoose");
const crypto = require("crypto");
const SystemInfo = require("../../model/SystemInfo");
const userServices = require("../user");
const sessionServices = require("../session");
const otpServices = require("../otp");
const passwordResetServices = require("../passwordReset");
const {
  ACCOUNT_STATUS,
  OTP_PURPOSE,
  STATUS_TRANSITION,
} = require("../../config/constants");
const { badRequest, unauthorized, forbidden } = require("../../utils/error");
const { hashing } = require("../../utils");
const tokenServices = require("../token");

/**
 * Generate a six-digit numeric OTP string.
 *
 * @returns {string} Plain-text OTP code.
 */
const createOtpCode = () => crypto.randomInt(100000, 1000000).toString();

/**
 * Create a new user account and an email verification OTP.
 *
 * @param {Object} params - Account details.
 * @param {string} params.name - Full name of the user.
 * @param {string} params.email - Unique user email.
 * @param {string} params.password - Plain-text password.
 * @returns {Promise<Object>} Created user plus `verificationCode`.
 * @throws {Error} When the email is already registered.
 */
const register = async ({ name, email, password }) => {
  // Hash the password before persistence.
  const hashPassword = await hashing.generateHash(password);
  const code = createOtpCode();
  const session = await mongoose.startSession();

  try {
    let user;
    // Create the user and the OTP in one transaction so neither is saved alone.
    await session.withTransaction(async () => {
      const hasUser = await userServices.userExist(email, session);

      if (hasUser) {
        throw badRequest(
          [{ field: "email", message: "User already exists", in: "body" }],
          "Validation error",
        );
      }

      user = await userServices.createUser(
        { name, email, password: hashPassword },
        session,
      );

      // Store only a hash of the OTP.
      const codeHash = await hashing.generateHash(code);

      await otpServices.createOtp(
        user.id,
        OTP_PURPOSE.EMAIL_VERIFICATION,
        codeHash,
        session,
      );
    });

    return { ...user, verificationCode: code };
  } finally {
    await session.endSession();
  }
};

/**
 * Create the first system administrator account.
 *
 * This is a one-time bootstrap operation.
 * It should be disabled or protected after initial setup.
 *
 * @param {Object} params - Administrator details.
 * @param {string} params.name - Full name of the administrator.
 * @param {string} params.email - Unique administrator email.
 * @param {string} params.password - Plain-text administrator password.
 * @returns {Promise<Object>} Created administrator user.
 * @throws {Error} When an administrator already exists.
 * @throws {Error} When the email is already taken.
 */
const systemAdmin = async ({ name, email, password }) => {
  // Hash the password before persistence.
  const hashPassword = await hashing.generateHash(password);

  const session = await mongoose.startSession();
  try {
    let admin;

    try {
      await session.withTransaction(async () => {
        // Ensure the setup document exists.
        await SystemInfo.updateOne(
          { id: "system-admin" },
          { $setOnInsert: { adminSetup: false } },
          { upsert: true, session },
        );

        // Atomically claim the one-time setup flag.
        const setup = await SystemInfo.findOneAndUpdate(
          { id: "system-admin", adminSetup: false },
          { $set: { adminSetup: true } },
          { new: true, session },
        );

        if (!setup) {
          throw forbidden("System admin already exists");
        }

        const hasUser = await userServices.userExist(email, session);

        if (hasUser) {
          throw badRequest(
            [{ field: "email", message: "User already exists", in: "body" }],
            "Validation error",
          );
        }

        admin = await userServices.createAdmin(
          { name, email, password: hashPassword },
          session,
        );
      });
    } catch (err) {
      // Treat a duplicate key error as an already completed setup.
      if (err.code === 11000) {
        throw forbidden("System admin already exists");
      }
      throw err;
    }

    return admin;
  } finally {
    await session.endSession();
  }
};

/**
 * Create a device session and issue a JWT token pair bound to it.
 *
 * The session ID is embedded in both tokens, so the session can be looked up
 * directly and an access token stops working once its session is removed.
 *
 * @param {Object} params - Session details.
 * @param {Object} params.user - Authenticated user.
 * @param {string} params.user.id - User ID.
 * @param {string} params.user.role - User role.
 * @param {string} params.user.email - User email.
 * @param {string} [params.deviceInfo] - Client device information.
 * @returns {Promise<{accessToken: string, refreshToken: string}>} Access and refresh tokens.
 */
const createSession = async ({ user, deviceInfo }) => {
  const sessionId = new mongoose.Types.ObjectId();

  // Drop this user's expired sessions so they do not pile up.
  await sessionServices.deleteExpiredSessions(user.id);

  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
    sid: sessionId.toString(),
  };

  const accessToken = tokenServices.generateAccessToken(payload);
  const refreshToken = tokenServices.generateRefreshToken(payload);

  await sessionServices.saveRefreshToken({
    id: user.id,
    sessionId,
    refreshToken,
    deviceInfo,
  });

  return { accessToken, refreshToken };
};

/**
 * Authenticate a user and issue a JWT token pair.
 *
 * Login is allowed only for active accounts.
 *
 * @param {Object} params - Login details.
 * @param {string} params.email - User email.
 * @param {string} params.password - Plain-text password.
 * @param {string} [params.deviceInfo] - Client device information.
 * @returns {Promise<{accessToken: string, refreshToken: string}>} Access and refresh tokens.
 * @throws {Error} When the credentials are invalid.
 * @throws {Error} When the account is not active.
 */
const login = async ({ email, password, deviceInfo }) => {
  const user = await userServices.findUserByEmail(email);

  // Prevent user enumeration with the same error for invalid credentials.
  if (!user) {
    throw unauthorized("Invalid credentials");
  }

  const isMatched = await hashing.compareHash(password, user.password_hash);

  if (!isMatched) {
    throw unauthorized("Invalid credentials");
  }

  if (user.account_status !== ACCOUNT_STATUS.ACTIVE) {
    throw forbidden("Account is not active");
  }

  return createSession({ user, deviceInfo });
};

/**
 * Issue a new access token for an active device session.
 *
 * @param {string} token - Refresh token from the client.
 * @returns {Promise<{accessToken: string}>} New access token.
 * @throws {Error} When the token is invalid, the user no longer exists, or the session is revoked.
 * @throws {Error} When the account is not active.
 */
const refreshToken = async (token) => {
  const decoded = tokenServices.verifyRefreshToken(token);

  const user = await userServices.findAuthUserById(decoded.id);

  if (!user) {
    throw unauthorized("Invalid refresh token");
  }

  if (user.account_status !== ACCOUNT_STATUS.ACTIVE) {
    throw forbidden("Account is not active");
  }

  // Require the token to match an active stored session.
  const activeSession = await sessionServices.findSessionByToken({
    id: user.id,
    sessionId: decoded.sid,
    refreshToken: token,
  });
  if (!activeSession) {
    throw unauthorized("Refresh token is invalid or revoked");
  }

  const accessToken = tokenServices.generateAccessToken({
    id: user.id,
    role: user.role,
    email: user.email,
    sid: activeSession.id,
  });

  return { accessToken };
};

/**
 * Verify an email OTP and activate the pending account.
 *
 * @param {Object} params - Verification details.
 * @param {string} params.email - User email.
 * @param {string} params.code - Plain-text OTP.
 * @returns {Promise<void>} Resolves after the account is activated.
 * @throws {Error} When the OTP is invalid, expired, or already used.
 * @throws {Error} When the account is not pending verification.
 */
const verifyEmailOtp = async ({ email, code }) => {
  // Count the attempt outside the transaction so a failure is not rolled back.
  const user = await userServices.findUserByEmail(email);
  const otp = user
    ? await otpServices.claimOtpAttempt(user.id, OTP_PURPOSE.EMAIL_VERIFICATION)
    : null;
  const valid = otp && (await hashing.compareHash(code, otp.code_hash));

  if (!user || !valid || user.account_status !== ACCOUNT_STATUS.PENDING) {
    throw badRequest(null, "Invalid or expired OTP");
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const used = await otpServices.markOtpUsed(otp.id, session);

      if (!used) {
        throw badRequest(null, "Invalid or expired OTP");
      }

      await userServices.updateUser(
        {
          id: user.id,
          status: ACCOUNT_STATUS.ACTIVE,
          statusTransition: STATUS_TRANSITION.EMAIL_VERIFICATION,
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
};

/**
 * Create an email verification OTP for a pending account.
 *
 * @param {string} email - User email.
 * @returns {Promise<{user: Object|null, code: string}>} User (if found) and plain-text OTP.
 */
const createVerificationOtp = async (email) => {
  const code = createOtpCode();
  const session = await mongoose.startSession();

  try {
    const user = await userServices.findUserByEmail(email, session);
    if (user && user.account_status === ACCOUNT_STATUS.PENDING) {
      await session.withTransaction(async () => {
        await otpServices.createOtp(
          user.id,
          OTP_PURPOSE.EMAIL_VERIFICATION,
          await hashing.generateHash(code),
          session,
        );
      });
    }

    return { user, code };
  } finally {
    await session.endSession();
  }
};

/**
 * Create a password reset OTP for an eligible (non-blocked) account.
 *
 * @param {string} email - User email.
 * @returns {Promise<{user: Object|null, code: string}>} User (if found) and plain-text OTP.
 */
const createPasswordResetOtp = async (email) => {
  const code = createOtpCode();
  const session = await mongoose.startSession();

  try {
    const user = await userServices.findUserByEmail(email, session);
    if (user && user.account_status !== ACCOUNT_STATUS.BLOCKED) {
      await session.withTransaction(async () => {
        await otpServices.createOtp(
          user.id,
          OTP_PURPOSE.PASSWORD_RESET,
          await hashing.generateHash(code),
          session,
        );
      });
    }

    return { user, code };
  } finally {
    await session.endSession();
  }
};

/**
 * Verify a password reset OTP and create a reset token.
 *
 * @param {Object} params - Verification details.
 * @param {string} params.email - User email.
 * @param {string} params.code - Plain-text OTP.
 * @returns {Promise<string>} Plain-text password reset token.
 * @throws {Error} When the OTP is invalid, expired, or already used.
 */
const verifyResetOtp = async ({ email, code }) => {
  const resetToken = crypto.randomBytes(32).toString("hex");

  // Count the attempt outside the transaction so a failure is not rolled back.
  const user = await userServices.findUserByEmail(email);
  const otp = user
    ? await otpServices.claimOtpAttempt(user.id, OTP_PURPOSE.PASSWORD_RESET)
    : null;
  const valid = otp && (await hashing.compareHash(code, otp.code_hash));

  if (!user || !valid) {
    throw badRequest(null, "Invalid or expired OTP");
  }

  const session = await mongoose.startSession();

  try {
    await session.withTransaction(async () => {
      const used = await otpServices.markOtpUsed(otp.id, session);

      if (!used) {
        throw badRequest(null, "Invalid or expired OTP");
      }

      // Store only a digest of the token so the raw value is never persisted.
      await passwordResetServices.savePasswordResetToken(
        user.id,
        hashing.generateDigest(resetToken),
        session,
      );
    });

    return resetToken;
  } finally {
    await session.endSession();
  }
};

/**
 * Reset a password and invalidate the user's refresh-token sessions.
 *
 * @param {Object} params - Reset details.
 * @param {string} params.token - Raw password reset token.
 * @param {string} params.password - New plain-text password.
 * @returns {Promise<void>} Resolves after the password has been reset.
 * @throws {Error} When the reset token is invalid, expired, or already used.
 */
const resetPassword = async ({ token, password }) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const resetToken = await passwordResetServices.findPasswordResetToken(
        token,
        session,
      );
      if (!resetToken) throw unauthorized("Invalid or expired reset token");

      await userServices.updatePassword(
        { id: resetToken.user_id, password },
        session,
      );
      const used = await passwordResetServices.markPasswordResetTokenUsed(
        resetToken.id,
        session,
      );
      if (!used) throw unauthorized("Invalid or expired reset token");
      // Revoke existing sessions so old logins stop working after the reset.
      await sessionServices.clearRefreshToken(
        { id: resetToken.user_id },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
};

module.exports = {
  register,
  systemAdmin,
  createSession,
  login,
  refreshToken,
  verifyEmailOtp,
  createVerificationOtp,
  createPasswordResetOtp,
  verifyResetOtp,
  resetPassword,
};
