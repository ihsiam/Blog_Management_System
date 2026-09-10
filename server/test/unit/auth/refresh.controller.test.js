/**
 * Unit tests for src/api/v1/authentication/controllers/refresh.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (token rotation business logic)
 */

const mockRefreshToken = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  refreshToken: mockRefreshToken,
}));

const refreshController = require("../../../src/api/v1/authentication/controllers/refresh");
const { createMockResponse } = require("../helpers/mockExpress");

describe("refresh controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockRefreshToken.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  it("should reject when there is no refresh token cookie", async () => {
    const req = { cookies: {} };

    await refreshController(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Refresh token is missing",
      }),
    );
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it("should rotate tokens and return the new access token", async () => {
    mockRefreshToken.mockResolvedValue({
      newAccessToken: "new-access-token",
      newRefreshToken: "new-refresh-token",
    });

    const req = { cookies: { refreshToken: "current-refresh-token" } };
    await refreshController(req, res, next);

    expect(mockRefreshToken).toHaveBeenCalledWith("current-refresh-token");
    expect(res.cookie).toHaveBeenCalledWith(
      "refreshToken",
      "new-refresh-token",
      { httpOnly: true, secure: true, sameSite: "strict" },
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: "Token refreshed successfully",
      data: { accessToken: "new-access-token" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when the refresh token is invalid or revoked", async () => {
    const authError = Object.assign(
      new Error("Refresh token is invalid or revoked"),
      { statusCode: 401 },
    );
    mockRefreshToken.mockRejectedValue(authError);

    const req = { cookies: { refreshToken: "revoked-token" } };
    await refreshController(req, res, next);

    expect(next).toHaveBeenCalledWith(authError);
    expect(res.cookie).not.toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
