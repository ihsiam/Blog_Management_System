const mongoose = require("mongoose");
const crypto = require("crypto");
const SystemInfo = require("../../model/SystemInfo");
const userServices = require("../user");
const { badRequest, unauthorized, forbidden } = require("../../utils/error");
const { hashing } = require("../../utils");
const tokenServices = require("../token");

const createOtpCode = () => crypto.randomInt(100000, 1000000).toString();

/**
 * Creates a new user account.
 *
 * @param {Object} params - Account details.
 * @param {string} params.name - User full name.
 * @param {string} params.email - Unique user email.
 * @param {string} params.password - Plain text password.
 *
 * @returns {Promise<Object>} Created user record.
 *
 * @throws {Error} BadRequest if the email already exists.
 */
const register = async ({ name, email, password }) => {
  // Hash the password before persistence.
  const hashPassword = await hashing.generateHash(password);
  const code = createOtpCode();
  const session = await mongoose.startSession();

  try {
    let user;
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

      const codeHash = await hashing.generateHash(code);

      await userServices.createOtp(
        user.id,
        "email_verification",
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
 * Creates the first system administrator account.
 *
 * This is a one-time bootstrap operation.
 * It should be disabled or protected after initial setup.
 *
 * @param {Object} params - Administrator details.
 * @param {string} params.name - Administrator full name.
 * @param {string} params.email - Unique administrator email.
 * @param {string} params.password - Administrator password.
 *
 * @returns {Promise<Object>} Created administrator user.
 *
 * @throws {Error} Forbidden if an administrator already exists.
 * @throws {Error} BadRequest if the email is already taken.
 */
const systemAdmin = async ({ name, email, password }) => {
  // Hash the password before persistence.
  const hashPassword = await hashing.generateHash(password);

  const session = await mongoose.startSession();
  try {
    let admin;

    try {
      await session.withTransaction(async () => {
        const setup = await SystemInfo.findOneAndUpdate(
          { id: "system-admin", adminSetup: false },
          { $set: { adminSetup: true } },
          { new: true, upsert: true, session },
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
 * Authenticates a user and issues JWT token pair.
 *
 * Login is allowed only for active accounts.
 *
 * @param {Object} params - Login details.
 * @param {string} params.email - User email.
 * @param {string} params.password - Plain text password.
 * @param {string} [params.deviceInfo] - Client device information.
 *
 * @returns {Promise<{accessToken: string, refreshToken: string}>} Access and refresh tokens.
 *
 * @throws {Error} Unauthorized if credentials are invalid.
 * @throws {Error} Forbidden if the account is not active.
 * @throws {Error} Unauthorized if credentials are invalid.
 * @throws {Error} Forbidden if the account is not active.
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

  if (user.account_status !== "active") {
    throw forbidden("Account is not active");
  }

  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  const accessToken = tokenServices.generateAccessToken(payload);
  const refreshToken = tokenServices.generateRefreshToken(payload);

  await userServices.saveRefreshToken(user.id, refreshToken, deviceInfo);

  return { accessToken, refreshToken };
};

/**
 * Rotates a refresh token and issues a new JWT pair.
 *
 * @param {string} token - Refresh token from the client.
 *
 * @returns {Promise<{newAccessToken: string, newRefreshToken: string}>} Rotated token pair.
 *
 * @throws {Error} Unauthorized if the token is invalid or revoked.
 * @throws {Error} Forbidden if the account is inactive.
 */
const refreshToken = async (token) => {
  const decoded = tokenServices.verifyRefreshToken(token);

  const user = await userServices.findAuthUserById(decoded.id);

  if (!user) {
    throw unauthorized("Invalid refresh token");
  }

  if (user.account_status !== "active") {
    throw forbidden("Account is not active");
  }

  // Require the token to match an active stored session before rotation.
  const activeSession = await userServices.findSessionByToken(user.id, token);
  if (!activeSession) {
    throw unauthorized("Refresh token is invalid or revoked");
  }

  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  const newAccessToken = tokenServices.generateAccessToken(payload);
  const newRefreshToken = tokenServices.generateRefreshToken(payload);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const currentSession = await userServices.findSessionByToken(
        user.id,
        token,
        session,
      );

      if (!currentSession) {
        throw unauthorized("Refresh token is invalid or revoked");
      }

      await userServices.clearRefreshToken(user.id, token, session);
      await userServices.saveRefreshToken(
        user.id,
        newRefreshToken,
        currentSession.device_info,
        session,
      );
    });
  } finally {
    await session.endSession();
  }

  return { newAccessToken, newRefreshToken };
};

/**
 * Verifies an email OTP and activates the pending account.
 *
 * @param {{email: string, code: string}} params - Verification details.
 * @returns {Promise<void>} Resolves after the account is activated.
 * @throws {Error} BadRequest if the OTP is invalid, expired, or already used.
 */
const verifyEmailOtp = async ({ email, code }) => {
  const session = await mongoose.startSession();
  try {
    let user;
    await session.withTransaction(async () => {
      user = await userServices.findUserByEmail(email, session);
      const otp = user
        ? await userServices.findValidOtp(
            user.id,
            "email_verification",
            session,
          )
        : null;
      const valid = otp && (await hashing.compareHash(code, otp.code_hash));

      if (!user || !valid || user.account_status !== "pending") {
        throw badRequest(null, "Invalid or expired OTP");
      }

      await userServices.markOtpUsed(otp.id, session);
      await userServices.updateUser(
        {
          id: user.id,
          status: "active",
          statusTransition: "emailVerification",
        },
        session,
      );
    });
  } finally {
    await session.endSession();
  }
};

/**
 * Creates an email verification OTP for a pending account.
 *
 * @param {string} email - User email address.
 * @returns {Promise<{user: Object|null, code: string}>} User and plaintext OTP.
 */
const createVerificationOtp = async (email) => {
  const code = createOtpCode();
  const session = await mongoose.startSession();

  try {
    const user = await userServices.findUserByEmail(email, session);
    if (user && user.account_status === "pending") {
      await session.withTransaction(async () => {
        await userServices.createOtp(
          user.id,
          "email_verification",
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
 * Creates a password reset OTP for an eligible account.
 *
 * @param {string} email - User email address.
 * @returns {Promise<{user: Object|null, code: string}>} User and plaintext OTP.
 */
const createPasswordResetOtp = async (email) => {
  const code = createOtpCode();
  const session = await mongoose.startSession();

  try {
    const user = await userServices.findUserByEmail(email, session);
    if (user && user.account_status !== "blocked") {
      await session.withTransaction(async () => {
        await userServices.createOtp(
          user.id,
          "password_reset",
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
 * Verifies a password reset OTP and creates a reset token.
 *
 * @param {{email: string, code: string}} params - Verification details.
 * @returns {Promise<string>} Plaintext password reset token.
 * @throws {Error} BadRequest if the OTP is invalid or expired.
 */
const verifyResetOtp = async ({ email, code }) => {
  const session = await mongoose.startSession();
  const resetToken = crypto.randomBytes(32).toString("hex");

  try {
    let user;
    await session.withTransaction(async () => {
      user = await userServices.findUserByEmail(email, session);
      const otp = user
        ? await userServices.findValidOtp(user.id, "password_reset", session)
        : null;
      const valid = otp && (await hashing.compareHash(code, otp.code_hash));

      if (!user || !valid) {
        throw badRequest(null, "Invalid or expired OTP");
      }

      await userServices.markOtpUsed(otp.id, session);
      await userServices.savePasswordResetToken(
        user.id,
        await hashing.generateHash(resetToken),
        session,
      );
    });

    return resetToken;
  } finally {
    await session.endSession();
  }
};

/**
 * Resets a password and invalidates the user's refresh-token sessions.
 *
 * @param {{token: string, password: string}} params - Reset details.
 * @returns {Promise<void>} Resolves after the password has been reset.
 * @throws {Error} Unauthorized if the reset token is invalid, expired, or used.
 */
const resetPassword = async ({ token, password }) => {
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const resetToken = await userServices.findPasswordResetToken(
        token,
        session,
      );
      if (!resetToken) throw unauthorized("Invalid or expired reset token");

      await userServices.updatePassword(
        { id: resetToken.user_id, password },
        session,
      );
      const used = await userServices.markPasswordResetTokenUsed(
        resetToken.id,
        session,
      );
      if (!used) throw unauthorized("Invalid or expired reset token");
      await userServices.clearRefreshToken(
        resetToken.user_id,
        undefined,
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
  login,
  refreshToken,
  verifyEmailOtp,
  createVerificationOtp,
  createPasswordResetOtp,
  verifyResetOtp,
  resetPassword,
};
