/**
 * Unit tests for src/api/v1/authentication/controllers/resetPassword.js
 *
 * Dependencies mocked:
 * - src/lib/token (reset token verification)
 * - src/lib/user  (password update, session invalidation)
 */

const mockVerifyActiveResetToken = jest.fn();
jest.doMock("../../../src/lib/token", () => ({
  verifyActiveResetToken: mockVerifyActiveResetToken,
}));

const mockUpdatePassword = jest.fn();
const mockClearRefreshToken = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  updatePassword: mockUpdatePassword,
  clearRefreshToken: mockClearRefreshToken,
}));

const resetPasswordController = require("../../../src/api/v1/authentication/controllers/resetPassword");
const { createMockResponse } = require("../helpers/mockExpress");

describe("resetPassword controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockVerifyActiveResetToken.mockReset();
    mockUpdatePassword.mockReset();
    mockClearRefreshToken.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (token, password) => ({
    params: { token },
    body: { password },
  });

  describe("input validation", () => {
    it("should reject when password is missing", async () => {
      const req = buildRequest("some-token", undefined);

      await resetPasswordController(req, res, next);

      expect(mockVerifyActiveResetToken).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a password shorter than 8 characters", async () => {
      const req = buildRequest("some-token", "short");

      await resetPasswordController(req, res, next);

      expect(mockVerifyActiveResetToken).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        {
          field: "password",
          message: "Password must be at least 8 characters long",
          in: "body",
        },
      ]);
    });
  });

  it("should propagate the error when the reset token is invalid", async () => {
    const tokenError = new Error("Active/Reset token expired");
    mockVerifyActiveResetToken.mockImplementation(() => {
      throw tokenError;
    });

    const req = buildRequest("expired-token", "new-strong-password");
    await resetPasswordController(req, res, next);

    expect(next).toHaveBeenCalledWith(tokenError);
    expect(mockUpdatePassword).not.toHaveBeenCalled();
  });

  it("should update the password and invalidate active sessions", async () => {
    mockVerifyActiveResetToken.mockReturnValue({ id: "1" });
    mockUpdatePassword.mockResolvedValue({ id: "1" });
    mockClearRefreshToken.mockResolvedValue(undefined);

    const req = buildRequest("valid-token", "new-strong-password");
    await resetPasswordController(req, res, next);

    expect(mockUpdatePassword).toHaveBeenCalledWith({
      id: "1",
      password: "new-strong-password",
    });
    expect(mockClearRefreshToken).toHaveBeenCalledWith("1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 200,
        message: "Password reset successful",
      }),
    );
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when updating the password fails", async () => {
    mockVerifyActiveResetToken.mockReturnValue({ id: "1" });
    const notFoundError = Object.assign(new Error("Not found"), {
      statusCode: 404,
    });
    mockUpdatePassword.mockRejectedValue(notFoundError);

    const req = buildRequest("valid-token", "new-strong-password");
    await resetPasswordController(req, res, next);

    expect(next).toHaveBeenCalledWith(notFoundError);
    expect(mockClearRefreshToken).not.toHaveBeenCalled();
  });
});
