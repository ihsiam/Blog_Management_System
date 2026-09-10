/**
 * Unit tests for src/lib/authentication/index.js
 *
 * Covers: register, systemAdmin, login, refreshToken.
 *
 * Dependencies mocked:
 * - src/lib/user       (database-backed user service)
 * - src/lib/token       (JWT generation)
 * - src/utils (hashing)  (bcrypt wrapper)
 *
 * src/utils/error is left real since it is a pure, dependency-free
 * factory and is part of the contract we want to verify.
 */

const mockUserExist = jest.fn();
const mockCreateUser = jest.fn();
const mockAdminExist = jest.fn();
const mockCreateAdmin = jest.fn();
const mockFindUserByEmail = jest.fn();
const mockSaveRefreshToken = jest.fn();
const mockFindAuthUserById = jest.fn();

jest.doMock("../../../src/lib/user", () => ({
  userExist: mockUserExist,
  createUser: mockCreateUser,
  adminExist: mockAdminExist,
  createAdmin: mockCreateAdmin,
  findUserByEmail: mockFindUserByEmail,
  saveRefreshToken: mockSaveRefreshToken,
  findAuthUserById: mockFindAuthUserById,
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
  beforeEach(() => {
    mockUserExist.mockReset();
    mockCreateUser.mockReset();
    mockAdminExist.mockReset();
    mockCreateAdmin.mockReset();
    mockFindUserByEmail.mockReset();
    mockSaveRefreshToken.mockReset();
    mockFindAuthUserById.mockReset();
    mockGenerateHash.mockReset();
    mockCompareHash.mockReset();
    mockGenerateAccessToken.mockReset();
    mockGenerateRefreshToken.mockReset();
    mockVerifyRefreshToken.mockReset();
  });

  describe("register", () => {
    it("should register a user successfully", async () => {
      mockUserExist.mockResolvedValue(false);
      mockGenerateHash.mockResolvedValue("hashed-password");
      const createdUser = { id: "1", name: "Jane", email: "jane@test.com" };
      mockCreateUser.mockResolvedValue(createdUser);

      const result = await authService.register({
        name: "Jane",
        email: "jane@test.com",
        password: "plain-password",
      });

      expect(mockUserExist).toHaveBeenCalledWith("jane@test.com");
      expect(mockGenerateHash).toHaveBeenCalledWith("plain-password");
      expect(mockCreateUser).toHaveBeenCalledWith({
        name: "Jane",
        email: "jane@test.com",
        password: "hashed-password",
      });
      expect(result).toBe(createdUser);
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

      expect(mockGenerateHash).not.toHaveBeenCalled();
      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it("should propagate the error when checking email uniqueness fails", async () => {
      mockUserExist.mockRejectedValue(new Error("connection lost"));

      await expect(
        authService.register({
          name: "Jane",
          email: "jane@test.com",
          password: "plain-password",
        }),
      ).rejects.toThrow("connection lost");

      expect(mockCreateUser).not.toHaveBeenCalled();
    });

    it("should propagate the error when password hashing fails", async () => {
      mockUserExist.mockResolvedValue(false);
      mockGenerateHash.mockRejectedValue(new Error("hashing failed"));

      await expect(
        authService.register({
          name: "Jane",
          email: "jane@test.com",
          password: "plain-password",
        }),
      ).rejects.toThrow("hashing failed");

      expect(mockCreateUser).not.toHaveBeenCalled();
    });
  });

  describe("systemAdmin", () => {
    it("should create the system administrator successfully", async () => {
      mockAdminExist.mockResolvedValue(false);
      mockUserExist.mockResolvedValue(false);
      mockGenerateHash.mockResolvedValue("hashed-password");
      const createdAdmin = { id: "1", name: "Admin", email: "admin@test.com" };
      mockCreateAdmin.mockResolvedValue(createdAdmin);

      const result = await authService.systemAdmin({
        name: "Admin",
        email: "admin@test.com",
        password: "plain-password",
      });

      expect(mockCreateAdmin).toHaveBeenCalledWith({
        name: "Admin",
        email: "admin@test.com",
        password: "hashed-password",
      });
      expect(result).toBe(createdAdmin);
    });

    it("should reject when a system administrator already exists", async () => {
      mockAdminExist.mockResolvedValue(true);

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

      expect(mockUserExist).not.toHaveBeenCalled();
      expect(mockCreateAdmin).not.toHaveBeenCalled();
    });

    it("should reject when the email is already taken", async () => {
      mockAdminExist.mockResolvedValue(false);
      mockUserExist.mockResolvedValue(true);

      await expect(
        authService.systemAdmin({
          name: "Admin",
          email: "admin@test.com",
          password: "plain-password",
        }),
      ).rejects.toMatchObject({
        statusCode: 400,
        error: "Bad request",
        message: "Validation error",
      });

      expect(mockCreateAdmin).not.toHaveBeenCalled();
    });
  });

  describe("login", () => {
    const approvedUser = {
      id: "1",
      email: "jane@test.com",
      password: "hashed-password",
      role: "user",
      status: "approved",
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
      });

      const expectedPayload = {
        id: approvedUser.id,
        role: approvedUser.role,
        email: approvedUser.email,
      };

      expect(mockCompareHash).toHaveBeenCalledWith(
        "plain-password",
        approvedUser.password,
      );
      expect(mockGenerateAccessToken).toHaveBeenCalledWith(expectedPayload);
      expect(mockGenerateRefreshToken).toHaveBeenCalledWith(expectedPayload);
      expect(mockSaveRefreshToken).toHaveBeenCalledWith(
        approvedUser.id,
        "refresh-token",
      );
      expect(result).toEqual({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });
    });

    it("should reject login when the user does not exist", async () => {
      mockFindUserByEmail.mockResolvedValue(null);

      await expect(
        authService.login({ email: "missing@test.com", password: "x" }),
      ).rejects.toMatchObject({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid credentials",
      });

      expect(mockCompareHash).not.toHaveBeenCalled();
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

    it("should reject login when the account is not approved", async () => {
      mockFindUserByEmail.mockResolvedValue({
        ...approvedUser,
        status: "pending",
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

    it("should propagate the error when the user lookup fails", async () => {
      mockFindUserByEmail.mockRejectedValue(new Error("db unavailable"));

      await expect(
        authService.login({ email: approvedUser.email, password: "x" }),
      ).rejects.toThrow("db unavailable");
    });
  });

  describe("refreshToken", () => {
    const decodedPayload = { id: "1", role: "user", email: "jane@test.com" };
    const sessionUser = {
      id: "1",
      role: "user",
      email: "jane@test.com",
      status: "approved",
      refreshToken: "current-refresh-token",
    };

    it("should rotate tokens for a valid refresh token", async () => {
      mockVerifyRefreshToken.mockReturnValue(decodedPayload);
      mockFindAuthUserById.mockResolvedValue(sessionUser);
      mockGenerateAccessToken.mockReturnValue("new-access-token");
      mockGenerateRefreshToken.mockReturnValue("new-refresh-token");
      mockSaveRefreshToken.mockResolvedValue(undefined);

      const result = await authService.refreshToken("current-refresh-token");

      expect(mockSaveRefreshToken).toHaveBeenCalledWith(
        sessionUser.id,
        "new-refresh-token",
      );
      expect(result).toEqual({
        newAccessToken: "new-access-token",
        newRefreshToken: "new-refresh-token",
      });
    });

    it("should propagate the error when the refresh token itself is invalid", async () => {
      mockVerifyRefreshToken.mockImplementation(() => {
        throw new Error("jwt malformed");
      });

      await expect(authService.refreshToken("bad-token")).rejects.toThrow(
        "jwt malformed",
      );
      expect(mockFindAuthUserById).not.toHaveBeenCalled();
    });

    it("should reject when the user no longer exists", async () => {
      mockVerifyRefreshToken.mockReturnValue(decodedPayload);
      mockFindAuthUserById.mockResolvedValue(null);

      await expect(authService.refreshToken("current-refresh-token")).rejects.toMatchObject({
        statusCode: 401,
        error: "Unauthorized",
        message: "Invalid refresh token",
      });
    });

    it("should reject when the account is not approved", async () => {
      mockVerifyRefreshToken.mockReturnValue(decodedPayload);
      mockFindAuthUserById.mockResolvedValue({
        ...sessionUser,
        status: "blocked",
      });

      await expect(authService.refreshToken("current-refresh-token")).rejects.toMatchObject({
        statusCode: 403,
        error: "Forbidden",
        message: "Account is not active",
      });
    });

    it("should invalidate the session and reject when the token has already been rotated", async () => {
      mockVerifyRefreshToken.mockReturnValue(decodedPayload);
      mockFindAuthUserById.mockResolvedValue({
        ...sessionUser,
        refreshToken: "a-different-token",
      });
      mockSaveRefreshToken.mockResolvedValue(undefined);

      await expect(authService.refreshToken("current-refresh-token")).rejects.toMatchObject({
        statusCode: 401,
        error: "Unauthorized",
        message: "Refresh token is invalid or revoked",
      });

      expect(mockSaveRefreshToken).toHaveBeenCalledWith(sessionUser.id, null);
      expect(mockGenerateAccessToken).not.toHaveBeenCalled();
    });
  });
});
