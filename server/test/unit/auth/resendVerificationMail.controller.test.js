/**
 * Unit tests for src/api/v1/authentication/controllers/resendVerificationMail.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (verification OTP creation)
 * - src/lib/email          (SMTP email sending)
 */

const mockCreateVerificationOtp = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  createVerificationOtp: mockCreateVerificationOtp,
}));

const mockSendMail = jest.fn();
jest.doMock("../../../src/lib/email", () => ({ sendMail: mockSendMail }));

const resendVerificationMailController = require("../../../src/api/v1/authentication/controllers/resendVerificationMail");
const { createMockResponse } = require("../helpers/mockExpress");

describe("resendVerificationMail controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockCreateVerificationOtp.mockReset();
    mockSendMail.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject when email is missing", async () => {
      const req = { body: {} };

      await resendVerificationMailController(req, res, next);

      expect(mockCreateVerificationOtp).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject an invalid email format", async () => {
      const req = { body: { email: "invalid" } };

      await resendVerificationMailController(req, res, next);

      expect(mockCreateVerificationOtp).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  it("should return a generic success message when the user does not exist", async () => {
    mockCreateVerificationOtp.mockResolvedValue({ user: null, code: "123456" });

    const req = { body: { email: "missing@test.com" } };
    await resendVerificationMailController(req, res, next);

    expect(mockCreateVerificationOtp).toHaveBeenCalledWith("missing@test.com");
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message:
        "If an account with that email exists, a verification code has been sent.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return a generic success message when the account is already active", async () => {
    mockCreateVerificationOtp.mockResolvedValue({
      user: { id: "1", email: "jane@test.com", account_status: "active" },
      code: "123456",
    });

    const req = { body: { email: "jane@test.com" } };
    await resendVerificationMailController(req, res, next);

    expect(mockSendMail).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message:
        "If an account with that email exists, a verification code has been sent.",
    });
  });

  it("should resend the verification email for a pending account", async () => {
    const user = {
      id: "1",
      name: "Jane",
      email: "jane@test.com",
      account_status: "pending",
    };
    mockCreateVerificationOtp.mockResolvedValue({ user, code: "123456" });
    mockSendMail.mockResolvedValue({ messageId: "abc" });

    const req = { body: { email: user.email } };
    await resendVerificationMailController(req, res, next);

    expect(mockCreateVerificationOtp).toHaveBeenCalledWith(user.email);
    expect(mockSendMail).toHaveBeenCalledWith({
      email: user.email,
      subject: "Verify your account",
      text: expect.stringContaining("123456"),
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message:
        "If an account with that email exists, a verification code has been sent.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when sending the email fails", async () => {
    mockCreateVerificationOtp.mockResolvedValue({
      user: {
        id: "1",
        name: "Jane",
        email: "jane@test.com",
        account_status: "pending",
      },
      code: "123456",
    });
    const smtpError = new Error("Email sending failed: SMTP down");
    mockSendMail.mockRejectedValue(smtpError);

    const req = { body: { email: "jane@test.com" } };
    await resendVerificationMailController(req, res, next);

    expect(next).toHaveBeenCalledWith(smtpError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
