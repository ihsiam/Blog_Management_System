/**
 * Unit tests for src/api/v1/authentication/controllers/resetPassword.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (password reset orchestration)
 */

const mockResetPassword = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  resetPassword: mockResetPassword,
}));

const resetPasswordController = require("../../../src/api/v1/authentication/controllers/resetPassword");
const { createMockResponse } = require("../helpers/mockExpress");

describe("resetPassword controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockResetPassword.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (token, password) => ({
    body: { password },
    cookies: token === undefined ? {} : { resetToken: token },
  });

  describe("input validation", () => {
    it("should reject when password is missing", async () => {
      const req = buildRequest("some-token", undefined);

      await resetPasswordController(req, res, next);

      expect(mockResetPassword).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject a password shorter than 8 characters", async () => {
      const req = buildRequest("some-token", "short");

      await resetPasswordController(req, res, next);

      expect(mockResetPassword).not.toHaveBeenCalled();
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

  it("should reject when the reset token is missing", async () => {
    const req = buildRequest(undefined, "new-strong-password");

    await resetPasswordController(req, res, next);

    expect(mockResetPassword).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Reset token is missing",
      }),
    );
  });

  it("should update the password and clear the reset token cookie", async () => {
    mockResetPassword.mockResolvedValue(undefined);

    const req = buildRequest("valid-token", "new-strong-password");
    await resetPasswordController(req, res, next);

    expect(mockResetPassword).toHaveBeenCalledWith({
      token: "valid-token",
      password: "new-strong-password",
    });
    expect(res.clearCookie).toHaveBeenCalledWith("resetToken", {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: "Password reset successful",
      links: { "sign-in": "/api/v1/auth/sign-in" },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when resetting the password fails", async () => {
    const resetError = Object.assign(
      new Error("Invalid or expired reset token"),
      {
        statusCode: 401,
      },
    );
    mockResetPassword.mockRejectedValue(resetError);

    const req = buildRequest("expired-token", "new-strong-password");
    await resetPasswordController(req, res, next);

    expect(next).toHaveBeenCalledWith(resetError);
    expect(res.clearCookie).not.toHaveBeenCalled();
  });
});
