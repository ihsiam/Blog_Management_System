/**
 * Unit tests for src/api/v1/authentication/controllers/logout.js
 *
 * Dependencies mocked:
 * - src/lib/session (session/refresh-token persistence)
 * - src/lib/token (refresh token verification)
 */

const mockFindSessionByToken = jest.fn();
const mockDeleteSession = jest.fn();
jest.doMock("../../../src/lib/session", () => ({
  findSessionByToken: mockFindSessionByToken,
  deleteSession: mockDeleteSession,
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
    mockFindSessionByToken.mockReset();
    mockDeleteSession.mockReset();
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
    expect(mockFindSessionByToken).not.toHaveBeenCalled();
  });

  it("should reject when the token belongs to another authenticated user", async () => {
    mockVerifyRefreshToken.mockReturnValue({ id: "1", sid: "session-1" });

    const req = {
      cookies: { refreshToken: "some-token" },
      user: { id: "2" },
    };
    await logoutController(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 401, message: "Invalid session" }),
    );
  });

  it("should invalidate the session and reject when the token no longer matches", async () => {
    mockVerifyRefreshToken.mockReturnValue({ id: "1", sid: "session-1" });
    mockFindSessionByToken.mockResolvedValue(null);

    const req = {
      cookies: { refreshToken: "stale-token" },
      user: { id: "1" },
    };
    await logoutController(req, res, next);

    expect(mockFindSessionByToken).toHaveBeenCalledWith({
      id: "1",
      sessionId: "session-1",
      refreshToken: "stale-token",
    });
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Session already invalidated",
      }),
    );
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should clear the session and cookie on successful logout", async () => {
    mockVerifyRefreshToken.mockReturnValue({ id: "1", sid: "session-1" });
    mockFindSessionByToken.mockResolvedValue({ id: "session-1" });
    mockDeleteSession.mockResolvedValue(true);

    const req = {
      cookies: { refreshToken: "current-token" },
      user: { id: "1" },
    };
    await logoutController(req, res, next);

    expect(mockDeleteSession).toHaveBeenCalledWith("1", "session-1");
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
    mockVerifyRefreshToken.mockReturnValue({ id: "1", sid: "session-1" });
    mockFindSessionByToken.mockResolvedValue({ id: "session-1" });
    const dbError = new Error("database unavailable");
    mockDeleteSession.mockRejectedValue(dbError);

    const req = {
      cookies: { refreshToken: "current-token" },
      user: { id: "1" },
    };
    await logoutController(req, res, next);

    expect(next).toHaveBeenCalledWith(dbError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
