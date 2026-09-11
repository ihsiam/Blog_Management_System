/**
 * Unit tests for src/api/v1/authentication/controllers/logout.js
 *
 * Dependencies mocked:
 * - src/lib/user  (session/refresh-token persistence)
 * - src/lib/token (refresh token verification)
 */

const mockFindAuthUserById = jest.fn();
const mockClearRefreshToken = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  findAuthUserById: mockFindAuthUserById,
  clearRefreshToken: mockClearRefreshToken,
}));

const mockVerifyRefreshToken = jest.fn();
jest.doMock("../../../src/lib/token", () => ({
  verifyRefreshToken: mockVerifyRefreshToken,
}));

const logoutController = require("../../../src/api/v1/authentication/controllers/logout");
const { createMockResponse } = require("../helpers/mockExpress");

describe("logout controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockFindAuthUserById.mockReset();
    mockClearRefreshToken.mockReset();
    mockVerifyRefreshToken.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  it("should reject when there is no refresh token cookie", async () => {
    const req = { cookies: {} };

    await logoutController(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Already logged out",
      }),
    );
    expect(mockVerifyRefreshToken).not.toHaveBeenCalled();
  });

  it("should propagate the error when the refresh token is invalid", async () => {
    const tokenError = new Error("Invalid Refresh token");
    mockVerifyRefreshToken.mockImplementation(() => {
      throw tokenError;
    });

    const req = { cookies: { refreshToken: "bad-token" } };
    await logoutController(req, res, next);

    expect(next).toHaveBeenCalledWith(tokenError);
    expect(mockFindAuthUserById).not.toHaveBeenCalled();
  });

  it("should reject when the user no longer exists", async () => {
    mockVerifyRefreshToken.mockReturnValue({ id: "1" });
    mockFindAuthUserById.mockResolvedValue(null);

    const req = { cookies: { refreshToken: "some-token" } };
    await logoutController(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: "Invalid session" }),
    );
  });

  it("should invalidate the session and reject when the token no longer matches", async () => {
    mockVerifyRefreshToken.mockReturnValue({ id: "1" });
    mockFindAuthUserById.mockResolvedValue({
      id: "1",
      refreshToken: "a-newer-token",
    });
    mockClearRefreshToken.mockResolvedValue(undefined);

    const req = { cookies: { refreshToken: "stale-token" } };
    await logoutController(req, res, next);

    expect(mockClearRefreshToken).toHaveBeenCalledWith("1");
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Session already invalidated",
      }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should clear the session and cookie on successful logout", async () => {
    mockVerifyRefreshToken.mockReturnValue({ id: "1" });
    mockFindAuthUserById.mockResolvedValue({
      id: "1",
      refreshToken: "current-token",
    });
    mockClearRefreshToken.mockResolvedValue(undefined);

    const req = { cookies: { refreshToken: "current-token" } };
    await logoutController(req, res, next);

    expect(mockClearRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockClearRefreshToken).toHaveBeenCalledWith("1");
    expect(res.clearCookie).toHaveBeenCalledWith("refreshToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: "Logged out successfully",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when clearing the session fails", async () => {
    mockVerifyRefreshToken.mockReturnValue({ id: "1" });
    mockFindAuthUserById.mockResolvedValue({
      id: "1",
      refreshToken: "current-token",
    });
    const dbError = new Error("database unavailable");
    mockClearRefreshToken.mockRejectedValue(dbError);

    const req = { cookies: { refreshToken: "current-token" } };
    await logoutController(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
