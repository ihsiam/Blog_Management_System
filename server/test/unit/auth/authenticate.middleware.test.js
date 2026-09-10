/**
 * Unit tests for src/middleware/authenticate.js
 *
 * Dependencies mocked:
 * - src/lib/token (JWT verification)
 * - src/lib/user  (database-backed user lookup)
 */

const mockVerifyAccessToken = jest.fn();
jest.doMock("../../../src/lib/token", () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

const mockFindAuthUserById = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  findAuthUserById: mockFindAuthUserById,
}));

const authenticate = require("../../../src/middleware/authenticate");

describe("authenticate middleware", () => {
  let next;

  beforeEach(() => {
    mockVerifyAccessToken.mockReset();
    mockFindAuthUserById.mockReset();
    next = jest.fn();
  });

  const buildRequest = (authorization) => ({ headers: { authorization } });

  it("should attach the authenticated user and call next() for a valid token", async () => {
    mockVerifyAccessToken.mockReturnValue({ id: "1" });
    mockFindAuthUserById.mockResolvedValue({
      id: "1",
      email: "jane@test.com",
      role: "user",
      status: "approved",
      refreshToken: "some-refresh-token",
      password: "should-not-leak",
    });

    const req = buildRequest("Bearer valid-token");
    await authenticate(req, {}, next);

    expect(mockVerifyAccessToken).toHaveBeenCalledWith("valid-token");
    expect(req.user).toEqual({
      id: "1",
      email: "jane@test.com",
      role: "user",
      status: "approved",
    });
    expect(req.user.password).toBeUndefined();
    expect(next).toHaveBeenCalledWith();
  });

  it("should reject the request when the Authorization header is missing", async () => {
    const req = buildRequest(undefined);
    await authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Authorization token missing",
      }),
    );
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("should reject the request when the Authorization header lacks the Bearer prefix", async () => {
    const req = buildRequest("Token some-token");
    await authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Authorization token missing",
      }),
    );
    expect(mockVerifyAccessToken).not.toHaveBeenCalled();
  });

  it("should propagate the error when token verification fails", async () => {
    const verificationError = new Error("Access token expired");
    mockVerifyAccessToken.mockImplementation(() => {
      throw verificationError;
    });

    const req = buildRequest("Bearer expired-token");
    await authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(verificationError);
    expect(mockFindAuthUserById).not.toHaveBeenCalled();
  });

  it("should reject the request when the user no longer exists", async () => {
    mockVerifyAccessToken.mockReturnValue({ id: "1" });
    mockFindAuthUserById.mockResolvedValue(null);

    const req = buildRequest("Bearer valid-token");
    await authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Invalid authentication token",
      }),
    );
  });

  it("should reject the request when the user has no active session", async () => {
    mockVerifyAccessToken.mockReturnValue({ id: "1" });
    mockFindAuthUserById.mockResolvedValue({
      id: "1",
      status: "approved",
      refreshToken: null,
    });

    const req = buildRequest("Bearer valid-token");
    await authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Session expired",
      }),
    );
  });

  it("should reject the request when the account is not approved", async () => {
    mockVerifyAccessToken.mockReturnValue({ id: "1" });
    mockFindAuthUserById.mockResolvedValue({
      id: "1",
      status: "pending",
      refreshToken: "some-refresh-token",
    });

    const req = buildRequest("Bearer valid-token");
    await authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "Your account is not active",
      }),
    );
  });

  it("should propagate the error when the user lookup dependency fails", async () => {
    mockVerifyAccessToken.mockReturnValue({ id: "1" });
    const dbError = new Error("database unavailable");
    mockFindAuthUserById.mockRejectedValue(dbError);

    const req = buildRequest("Bearer valid-token");
    await authenticate(req, {}, next);

    expect(next).toHaveBeenCalledWith(dbError);
  });
});
