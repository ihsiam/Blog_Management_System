/**
 * Unit tests for src/lib/authentication/index.js
 *
 * Covers: register, systemAdmin, login, refreshToken, OTP flows, reset flow.
 */

const mongoose = require("mongoose");
const mockFindOneAndUpdate = jest.fn();
const mockUserExist = jest.fn();
const mockCreateUser = jest.fn();
const mockCreateAdmin = jest.fn();
const mockFindUserByEmail = jest.fn();
const mockSaveRefreshToken = jest.fn();
const mockFindAuthUserById = jest.fn();
const mockFindSessionByToken = jest.fn();
const mockClearRefreshToken = jest.fn();
const mockCreateOtp = jest.fn();
const mockFindValidOtp = jest.fn();
const mockMarkOtpUsed = jest.fn();
const mockUpdateUser = jest.fn();
const mockSavePasswordResetToken = jest.fn();
const mockFindPasswordResetToken = jest.fn();
const mockMarkPasswordResetTokenUsed = jest.fn();
const mockUpdatePassword = jest.fn();

jest.doMock("../../../src/model/SystemInfo", () => ({
  findOneAndUpdate: mockFindOneAndUpdate,
}));

jest.doMock("../../../src/lib/user", () => ({
  userExist: mockUserExist,
  createUser: mockCreateUser,
  createAdmin: mockCreateAdmin,
  findUserByEmail: mockFindUserByEmail,
  saveRefreshToken: mockSaveRefreshToken,
  findAuthUserById: mockFindAuthUserById,
  findSessionByToken: mockFindSessionByToken,
  clearRefreshToken: mockClearRefreshToken,
  createOtp: mockCreateOtp,
  findValidOtp: mockFindValidOtp,
  markOtpUsed: mockMarkOtpUsed,
  updateUser: mockUpdateUser,
  savePasswordResetToken: mockSavePasswordResetToken,
  findPasswordResetToken: mockFindPasswordResetToken,
  markPasswordResetTokenUsed: mockMarkPasswordResetTokenUsed,
  updatePassword: mockUpdatePassword,
}));

const mockGenerateHash = jest.fn();
const mockCompareHash = jest.fn();

jest.doMock("../../../src/utils", () => ({
  hashing: { generateHash: mockGenerateHash, compareHash: mockCompareHash },
}));

const mockGenerateAccessToken = jest.fn();
const mockGenerateRefreshToken = jest.fn();
const mockVerifyRefreshToken = jest.fn();

jest.doMock("../../../src/lib/token", () => ({
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
  verifyRefreshToken: mockVerifyRefreshToken,
}));

const authService = require("../../../src/lib/authentication");

describe("authentication service (src/lib/authentication)", () => {
  let session;

  beforeEach(() => {
    session = {
      withTransaction: jest.fn(async (callback) => callback()),
      endSession: jest.fn(),
    };
    jest.spyOn(mongoose, "startSession").mockResolvedValue(session);

    mockFindOneAndUpdate.mockReset();
    mockUserExist.mockReset();
    mockCreateUser.mockReset();
    mockCreateAdmin.mockReset();
    mockFindUserByEmail.mockReset();
    mockSaveRefreshToken.mockReset();
    mockFindAuthUserById.mockReset();
    mockFindSessionByToken.mockReset();
    mockClearRefreshToken.mockReset();
    mockCreateOtp.mockReset();
    mockFindValidOtp.mockReset();
    mockMarkOtpUsed.mockReset();
    mockUpdateUser.mockReset();
    mockSavePasswordResetToken.mockReset();
    mockFindPasswordResetToken.mockReset();
    mockMarkPasswordResetTokenUsed.mockReset();
    mockUpdatePassword.mockReset();
    mockGenerateHash.mockReset();
    mockCompareHash.mockReset();
    mockGenerateAccessToken.mockReset();
    mockGenerateRefreshToken.mockReset();
    mockVerifyRefreshToken.mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe("register", () => {
    it("should register a user successfully", async () => {
      mockUserExist.mockResolvedValue(false);
      mockGenerateHash.mockResolvedValue("hashed-password");
      const createdUser = {
        id: "1",
        name: "Jane",
        email: "jane@test.com",
        account_status: "pending",
      };
      mockCreateUser.mockResolvedValue(createdUser);

      const result = await authService.register({
        name: "Jane",
        email: "jane@test.com",
        password: "plain-password",
      });

      expect(mockUserExist).toHaveBeenCalledWith("jane@test.com", session);
      expect(mockGenerateHash).toHaveBeenCalledWith("plain-password");
      expect(mockCreateUser).toHaveBeenCalledWith(
        { name: "Jane", email: "jane@test.com", password: "hashed-password" },
        session,
      );
      expect(mockCreateOtp).toHaveBeenCalledWith(
        "1",
        "email_verification",
        expect.any(String),
        session,
      );
      expect(result).toMatchObject({
        id: "1",
        name: "Jane",
        email: "jane@test.com",
      });
      expect(result.verificationCode).toMatch(/^[0-9]{6}$/);
    });

    it("should reject registration when the email already exists", async () => {
      mockUserExist.mockResolvedValue(true);

      await expect(
        authService.register({
          name: "Jane",
          email: "jane@test.com",
          password: "plain-password",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        error: "Bad request",
        message: "Validation error",
        data: [{ field: "email", message: "User already exists", in: "body" }],
      });

      expect(mockCreateUser).not.toHaveBeenCalled();
    });
  });

  describe("systemAdmin", () => {
    it("should create the system administrator successfully", async () => {
      mockFindOneAndUpdate.mockResolvedValue({ adminSetup: true });
      mockUserExist.mockResolvedValue(false);
      mockGenerateHash.mockResolvedValue("hashed-password");
      const createdAdmin = {
        id: "1",
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      };
      mockCreateAdmin.mockResolvedValue(createdAdmin);

      const result = await authService.systemAdmin({
        name: "Admin",
        email: "admin@test.com",
        password: "plain-password",
      });

      expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
        { id: "system-admin", adminSetup: false },
        { $set: { adminSetup: true } },
        { new: true, upsert: true, session },
      );
      expect(mockCreateAdmin).toHaveBeenCalledWith(
        { name: "Admin", email: "admin@test.com", password: "hashed-password" },
        session,
      );
      expect(result).toEqual(createdAdmin);
    });

    it("should reject when a system administrator already exists", async () => {
      mockFindOneAndUpdate.mockResolvedValue(null);

      await expect(
        authService.systemAdmin({
          name: "Admin",
          email: "admin@test.com",
          password: "plain-password",
        }),
      ).rejects.toMatchObject({
        statusCode: 403,
        error: "Forbidden",
        message: "System admin already exists",
      });
    });
  });

  describe("login", () => {
    const approvedUser = {
      id: "1",
      email: "jane@test.com",
      password_hash: "hashed-password",
      role: "user",
      account_status: "active",
    };

    it("should authenticate valid credentials and issue a token pair", async () => {
      mockFindUserByEmail.mockResolvedValue(approvedUser);
      mockCompareHash.mockResolvedValue(true);
      mockGenerateAccessToken.mockReturnValue("access-token");
      mockGenerateRefreshToken.mockReturnValue("refresh-token");
      mockSaveRefreshToken.mockResolvedValue(undefined);

      const result = await authService.login({
        email: "jane@test.com",
        password: "plain-password",
        deviceInfo: "browser",
      });

      expect(mockCompareHash).toHaveBeenCalledWith(
        "plain-password",
        approvedUser.password_hash,
      );
      expect(mockGenerateAccessToken).toHaveBeenCalledWith({
        id: approvedUser.id,
        role: approvedUser.role,
        email: approvedUser.email,
      });
      expect(mockGenerateRefreshToken).toHaveBeenCalledWith({
        id: approvedUser.id,
        role: approvedUser.role,
        email: approvedUser.email,
      });
      expect(mockSaveRefreshToken).toHaveBeenCalledWith(
        approvedUser.id,
        "refresh-token",
        "browser",
      );
      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    it("should reject login when the password is incorrect", async () => {
      mockFindUserByEmail.mockResolvedValue(approvedUser);
      mockCompareHash.mockResolvedValue(false);

      await expect(
        authService.login({ email: approvedUser.email, password: "wrong" }),
      ).rejects.toMatchObject({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid credentials",
      });

      expect(mockGenerateAccessToken).not.toHaveBeenCalled();
    });

    it("should reject login when the account is not active", async () => {
      mockFindUserByEmail.mockResolvedValue({
        ...approvedUser,
        account_status: "pending",
      });
      mockCompareHash.mockResolvedValue(true);

      await expect(
        authService.login({ email: approvedUser.email, password: "x" }),
      ).rejects.toMatchObject({
        statusCode: 403,
        error: "Forbidden",
        message: "Account is not active",
      });

      expect(mockGenerateAccessToken).not.toHaveBeenCalled();
    });
  });

  describe("refreshToken", () => {
    const decodedPayload = { id: "1", role: "user", email: "jane@test.com" };
    const sessionUser = {
      id: "1",
      role: "user",
      email: "jane@test.com",
      account_status: "active",
    };

    it("should rotate tokens for a valid refresh token", async () => {
      mockVerifyRefreshToken.mockReturnValue(decodedPayload);
      mockFindAuthUserById.mockResolvedValue(sessionUser);
      mockFindSessionByToken.mockResolvedValue({ device_info: "browser" });
      mockGenerateAccessToken.mockReturnValue("new-access-token");
      mockGenerateRefreshToken.mockReturnValue("new-refresh-token");
      mockClearRefreshToken.mockResolvedValue(undefined);
      mockSaveRefreshToken.mockResolvedValue(undefined);

      const result = await authService.refreshToken("current-refresh-token");

      expect(mockFindSessionByToken).toHaveBeenCalledWith(
        sessionUser.id,
        "current-refresh-token",
      );
      expect(mockClearRefreshToken).toHaveBeenCalledWith(
        sessionUser.id,
        "current-refresh-token",
        session,
      );
      expect(mockSaveRefreshToken).toHaveBeenCalledWith(
        sessionUser.id,
        "new-refresh-token",
        "browser",
        session,
      );
      expect(result).toEqual({
        newAccessToken: "new-access-token",
        newRefreshToken: "new-refresh-token",
      });
    });

    it("should reject when the refresh token is revoked or no longer matches", async () => {
      mockVerifyRefreshToken.mockReturnValue(decodedPayload);
      mockFindAuthUserById.mockResolvedValue(sessionUser);
      mockFindSessionByToken.mockResolvedValueOnce(null);

      await expect(
        authService.refreshToken("current-refresh-token"),
      ).rejects.toMatchObject({
        statusCode: 401,
        error: "Unauthorized",
        message: "Refresh token is invalid or revoked",
      });
    });
  });

  describe("verifyEmailOtp", () => {
    it("should verify a valid OTP and activate the account", async () => {
      mockFindUserByEmail.mockResolvedValue({
        id: "1",
        email: "jane@test.com",
        account_status: "pending",
      });
      mockFindValidOtp.mockResolvedValue({
        id: "otp-1",
        code_hash: "hashed-code",
      });
      mockCompareHash.mockResolvedValue(true);
      mockMarkOtpUsed.mockResolvedValue(true);
      mockUpdateUser.mockResolvedValue({ id: "1", account_status: "active" });

      await authService.verifyEmailOtp({
        email: "jane@test.com",
        code: "123456",
      });

      expect(mockMarkOtpUsed).toHaveBeenCalledWith("otp-1", session);
      expect(mockUpdateUser).toHaveBeenCalledWith(
        {
          id: "1",
          status: "active",
          statusTransition: "emailVerification",
        },
        session,
      );
    });

    it("should reject an invalid or expired OTP", async () => {
      mockFindUserByEmail.mockResolvedValue({
        id: "1",
        email: "jane@test.com",
        account_status: "pending",
      });
      mockFindValidOtp.mockResolvedValue({
        id: "otp-1",
        code_hash: "hashed-code",
      });
      mockCompareHash.mockResolvedValue(false);

      await expect(
        authService.verifyEmailOtp({ email: "jane@test.com", code: "123456" }),
      ).rejects.toMatchObject({
        statusCode: 400,
        error: "Bad request",
        message: "Invalid or expired OTP",
      });
    });
  });

  describe("createVerificationOtp", () => {
    it("should create an email verification OTP for a pending account", async () => {
      const user = {
        id: "1",
        email: "jane@test.com",
        account_status: "pending",
      };
      mockFindUserByEmail.mockResolvedValue(user);
      mockGenerateHash.mockResolvedValue("code-hash");

      const result = await authService.createVerificationOtp("jane@test.com");

      expect(result.user).toMatchObject(user);
      expect(result.code).toMatch(/^[0-9]{6}$/);
      expect(mockCreateOtp).toHaveBeenCalledWith(
        "1",
        "email_verification",
        expect.any(String),
        session,
      );
    });
  });

  describe("createPasswordResetOtp", () => {
    it("should create a password reset OTP for an eligible account", async () => {
      const user = {
        id: "1",
        email: "jane@test.com",
        account_status: "active",
      };
      mockFindUserByEmail.mockResolvedValue(user);
      mockGenerateHash.mockResolvedValue("code-hash");

      const result = await authService.createPasswordResetOtp("jane@test.com");

      expect(result.user).toMatchObject(user);
      expect(result.code).toMatch(/^[0-9]{6}$/);
      expect(mockCreateOtp).toHaveBeenCalledWith(
        "1",
        "password_reset",
        expect.any(String),
        session,
      );
    });
  });

  describe("verifyResetOtp", () => {
    it("should verify a valid reset OTP and return a reset token", async () => {
      mockFindUserByEmail.mockResolvedValue({
        id: "1",
        email: "jane@test.com",
      });
      mockFindValidOtp.mockResolvedValue({
        id: "otp-1",
        code_hash: "hashed-code",
      });
      mockCompareHash.mockResolvedValue(true);
      mockGenerateHash.mockResolvedValue("reset-token-hash");
      mockMarkOtpUsed.mockResolvedValue(true);
      mockSavePasswordResetToken.mockResolvedValue(undefined);

      const result = await authService.verifyResetOtp({
        email: "jane@test.com",
        code: "123456",
      });

      expect(typeof result).toBe("string");
      expect(result).toHaveLength(64);
      expect(mockMarkOtpUsed).toHaveBeenCalledWith("otp-1", session);
      expect(mockSavePasswordResetToken).toHaveBeenCalledWith(
        "1",
        expect.any(String),
        session,
      );
    });
  });

  describe("resetPassword", () => {
    it("should reset the password and invalidate all sessions", async () => {
      mockFindPasswordResetToken.mockResolvedValue({
        id: "reset-1",
        user_id: "1",
      });
      mockUpdatePassword.mockResolvedValue({ id: "1" });
      mockMarkPasswordResetTokenUsed.mockResolvedValue(true);
      mockClearRefreshToken.mockResolvedValue(undefined);

      await authService.resetPassword({
        token: "valid-reset-token",
        password: "new-password",
      });

      expect(mockUpdatePassword).toHaveBeenCalledWith(
        { id: "1", password: "new-password" },
        session,
      );
      expect(mockMarkPasswordResetTokenUsed).toHaveBeenCalledWith(
        "reset-1",
        session,
      );
      expect(mockClearRefreshToken).toHaveBeenCalledWith(
        "1",
        undefined,
        session,
      );
    });

    it("should reject an invalid or expired reset token", async () => {
      mockFindPasswordResetToken.mockResolvedValue(null);

      await expect(
        authService.resetPassword({
          token: "invalid-token",
          password: "new-password",
        }),
      ).rejects.toMatchObject({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid or expired reset token",
      });
    });
  });
});
