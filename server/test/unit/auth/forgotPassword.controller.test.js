/**
 * Unit tests for src/api/v1/authentication/controllers/forgotPassword.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (password-reset OTP creation)
 * - src/lib/email          (SMTP email sending)
 */

const mockCreatePasswordResetOtp = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  createPasswordResetOtp: mockCreatePasswordResetOtp,
}));

const mockSendMail = jest.fn();
jest.doMock("../../../src/lib/email", () => ({ sendMail: mockSendMail }));

const forgotPasswordController = require("../../../src/api/v1/authentication/controllers/forgotPassword");
const { createMockResponse } = require("../helpers/mockExpress");

describe("forgotPassword controller", () => {
  let res;
  let next;

  const GENERIC_MESSAGE =
    "If an account with that email exists, a password reset code has been sent.";

  beforeEach(() => {
    mockCreatePasswordResetOtp.mockReset();
    mockSendMail.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject when email is missing", async () => {
      const req = { body: {} };

      await forgotPasswordController(req, res, next);

      expect(mockCreatePasswordResetOtp).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject an invalid email format", async () => {
      const req = { body: { email: "invalid" } };

      await forgotPasswordController(req, res, next);

      expect(mockCreatePasswordResetOtp).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  it("should return the generic message without sending an email when the user does not exist", async () => {
    mockCreatePasswordResetOtp.mockResolvedValue({
      user: null,
      code: "123456",
    });

    const req = { body: { email: "missing@test.com" } };
    await forgotPasswordController(req, res, next);

    expect(mockCreatePasswordResetOtp).toHaveBeenCalledWith("missing@test.com");
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: GENERIC_MESSAGE,
    });
  });

  it("should return the generic message without sending an email for a blocked account", async () => {
    mockCreatePasswordResetOtp.mockResolvedValue({
      user: { id: "1", email: "jane@test.com", account_status: "blocked" },
      code: "123456",
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
      email: "jane@test.com",
      account_status: "active",
    };
    mockCreatePasswordResetOtp.mockResolvedValue({ user, code: "123456" });
    mockSendMail.mockResolvedValue({ messageId: "abc" });

    const req = { body: { email: user.email } };
    await forgotPasswordController(req, res, next);

    expect(mockCreatePasswordResetOtp).toHaveBeenCalledWith(user.email);
    expect(mockSendMail).toHaveBeenCalledWith({
      email: user.email,
      subject: "Reset your password",
      text: expect.stringContaining("123456"),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: GENERIC_MESSAGE,
    });
  });

  it("should propagate the error when sending the reset email fails", async () => {
    mockCreatePasswordResetOtp.mockResolvedValue({
      user: {
        id: "1",
        name: "Jane",
        email: "jane@test.com",
        account_status: "active",
      },
      code: "123456",
    });
    const smtpError = new Error("Email sending failed: SMTP down");
    mockSendMail.mockRejectedValue(smtpError);

    const req = { body: { email: "jane@test.com" } };
    await forgotPasswordController(req, res, next);

    expect(next).toHaveBeenCalledWith(smtpError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
