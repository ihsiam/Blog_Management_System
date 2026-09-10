/**
 * Unit tests for src/api/v1/authentication/controllers/forgotPassword.js
 *
 * Dependencies mocked:
 * - src/lib/user  (user lookup)
 * - src/lib/token (reset token generation)
 * - src/lib/email (SMTP email sending)
 */

const mockFindUserByEmail = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  findUserByEmail: mockFindUserByEmail,
}));

const mockGenerateActiveResetToken = jest.fn();
jest.doMock("../../../src/lib/token", () => ({
  generateActiveResetToken: mockGenerateActiveResetToken,
}));

const mockSendMail = jest.fn();
jest.doMock("../../../src/lib/email", () => ({ sendMail: mockSendMail }));

const forgotPasswordController = require("../../../src/api/v1/authentication/controllers/forgotPassword");
const { createMockResponse } = require("../helpers/mockExpress");

describe("forgotPassword controller", () => {
  let res;
  let next;

  const GENERIC_MESSAGE =
    "If this email is registered, you will receive a password reset link.";

  beforeEach(() => {
    mockFindUserByEmail.mockReset();
    mockGenerateActiveResetToken.mockReset();
    mockSendMail.mockReset();
    res = createMockResponse();
    next = jest.fn();
    process.env.APP_URL = "http://localhost:4000";
  });

  describe("input validation", () => {
    it("should reject when email is missing", async () => {
      const req = { body: {} };

      await forgotPasswordController(req, res, next);

      expect(mockFindUserByEmail).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject an invalid email format", async () => {
      const req = { body: { email: "invalid" } };

      await forgotPasswordController(req, res, next);

      expect(mockFindUserByEmail).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  it("should return the generic message without sending an email when the user does not exist", async () => {
    mockFindUserByEmail.mockResolvedValue(null);

    const req = { body: { email: "missing@test.com" } };
    await forgotPasswordController(req, res, next);

    expect(mockGenerateActiveResetToken).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: GENERIC_MESSAGE,
    });
  });

  it("should return the generic message without sending an email for a declined account", async () => {
    mockFindUserByEmail.mockResolvedValue({
      id: "1",
      email: "jane@test.com",
      status: "declined",
    });

    const req = { body: { email: "jane@test.com" } };
    await forgotPasswordController(req, res, next);

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: GENERIC_MESSAGE,
    });
  });

  it("should send a reset email and return the same generic message for an active account", async () => {
    const user = {
      id: "1",
      name: "Jane",
      role: "user",
      email: "jane@test.com",
      status: "approved",
    };
    mockFindUserByEmail.mockResolvedValue(user);
    mockGenerateActiveResetToken.mockReturnValue("reset-token");
    mockSendMail.mockResolvedValue({ messageId: "abc" });

    const req = { body: { email: user.email } };
    await forgotPasswordController(req, res, next);

    expect(mockGenerateActiveResetToken).toHaveBeenCalledWith({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: user.email,
        subject: "Reset your password",
        text: expect.stringContaining(
          "http://localhost:4000/api/v1/auth/reset-password/reset-token",
        ),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: GENERIC_MESSAGE,
    });
  });

  it("should propagate the error when sending the reset email fails", async () => {
    mockFindUserByEmail.mockResolvedValue({
      id: "1",
      name: "Jane",
      role: "user",
      email: "jane@test.com",
      status: "approved",
    });
    mockGenerateActiveResetToken.mockReturnValue("reset-token");
    const smtpError = new Error("Email sending failed: SMTP down");
    mockSendMail.mockRejectedValue(smtpError);

    const req = { body: { email: "jane@test.com" } };
    await forgotPasswordController(req, res, next);

    expect(next).toHaveBeenCalledWith(smtpError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
