/**
 * Unit tests for src/api/v1/authentication/controllers/verifyEmail.js
 *
 * Dependencies mocked:
 * - src/lib/token (activation token verification/generation)
 * - src/lib/user  (user lookup/update, refresh token persistence)
 */

const mockVerifyActiveResetToken = jest.fn();
const mockGenerateRefreshToken = jest.fn();
const mockGenerateAccessToken = jest.fn();
jest.doMock("../../../src/lib/token", () => ({
  verifyActiveResetToken: mockVerifyActiveResetToken,
  generateRefreshToken: mockGenerateRefreshToken,
  generateAccessToken: mockGenerateAccessToken,
}));

const mockFindUserById = jest.fn();
const mockUpdateUser = jest.fn();
const mockSaveRefreshToken = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  findUserById: mockFindUserById,
  updateUser: mockUpdateUser,
  saveRefreshToken: mockSaveRefreshToken,
}));

const verifyEmailController = require("../../../src/api/v1/authentication/controllers/verifyEmail");
const { createMockResponse } = require("../helpers/mockExpress");

describe("verifyEmail controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockVerifyActiveResetToken.mockReset();
    mockGenerateRefreshToken.mockReset();
    mockGenerateAccessToken.mockReset();
    mockFindUserById.mockReset();
    mockUpdateUser.mockReset();
    mockSaveRefreshToken.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (token) => ({ params: { token } });

  it("should propagate the error when the activation token is invalid", async () => {
    const tokenError = new Error("Invalid Active/Reset token");
    mockVerifyActiveResetToken.mockImplementation(() => {
      throw tokenError;
    });

    await verifyEmailController(buildRequest("bad-token"), res, next);

    expect(next).toHaveBeenCalledWith(tokenError);
    expect(mockFindUserById).not.toHaveBeenCalled();
  });

  it("should reject when the user no longer exists", async () => {
    mockVerifyActiveResetToken.mockReturnValue({ id: "1" });
    mockFindUserById.mockResolvedValue(null);

    await verifyEmailController(buildRequest("valid-token"), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: "User not found" }),
    );
  });

  it("should reject when the account has already been verified", async () => {
    mockVerifyActiveResetToken.mockReturnValue({ id: "1" });
    mockFindUserById.mockResolvedValue({ id: "1", status: "approved" });

    await verifyEmailController(buildRequest("valid-token"), res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: "Account already verified",
      }),
    );
    expect(mockUpdateUser).not.toHaveBeenCalled();
  });

  it("should activate a pending account and return an access token", async () => {
    mockVerifyActiveResetToken.mockReturnValue({ id: "1" });
    mockFindUserById.mockResolvedValue({ id: "1", status: "pending" });
    const updatedUser = {
      id: "1",
      role: "user",
      email: "jane@test.com",
      status: "approved",
    };
    mockUpdateUser.mockResolvedValue(updatedUser);
    mockGenerateRefreshToken.mockReturnValue("refresh-token");
    mockGenerateAccessToken.mockReturnValue("access-token");
    mockSaveRefreshToken.mockResolvedValue(undefined);

    await verifyEmailController(buildRequest("valid-token"), res, next);

    expect(mockUpdateUser).toHaveBeenCalledWith({ id: "1", status: "approved" });
    expect(mockSaveRefreshToken).toHaveBeenCalledWith("1", "refresh-token");
    expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 200,
        data: { accessToken: "access-token" },
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when activating the account fails", async () => {
    mockVerifyActiveResetToken.mockReturnValue({ id: "1" });
    mockFindUserById.mockResolvedValue({ id: "1", status: "pending" });
    const dbError = new Error("database unavailable");
    mockUpdateUser.mockRejectedValue(dbError);

    await verifyEmailController(buildRequest("valid-token"), res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
