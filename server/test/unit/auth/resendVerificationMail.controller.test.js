/**
 * Unit tests for src/api/v1/authentication/controllers/resendVerificationMail.js
 *
 * Dependencies mocked:
 * - src/lib/user  (user lookup)
 * - src/lib/token (activation token generation)
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

const resendVerificationMailController = require("../../../src/api/v1/authentication/controllers/resendVerificationMail");
const { createMockResponse } = require("../helpers/mockExpress");

describe("resendVerificationMail controller", () => {
  let res;
  let next;

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

      await resendVerificationMailController(req, res, next);

      expect(mockFindUserByEmail).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });

    it("should reject an invalid email format", async () => {
      const req = { body: { email: "invalid" } };

      await resendVerificationMailController(req, res, next);

      expect(mockFindUserByEmail).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 400 }),
      );
    });
  });

  it("should reject when the user does not exist", async () => {
    mockFindUserByEmail.mockResolvedValue(null);

    const req = { body: { email: "missing@test.com" } };
    await resendVerificationMailController(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 404, message: "User not found" }),
    );
  });

  it("should reject when the account is already active", async () => {
    mockFindUserByEmail.mockResolvedValue({ id: "1", status: "approved" });

    const req = { body: { email: "jane@test.com" } };
    await resendVerificationMailController(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "Account is already active",
      }),
    );
  });

  it("should resend the verification email for a pending account", async () => {
    const user = {
      id: "1",
      name: "Jane",
      role: "user",
      email: "jane@test.com",
      status: "pending",
    };
    mockFindUserByEmail.mockResolvedValue(user);
    mockGenerateActiveResetToken.mockReturnValue("activation-token");
    mockSendMail.mockResolvedValue({ messageId: "abc" });

    const req = { body: { email: user.email } };
    await resendVerificationMailController(req, res, next);

    expect(mockGenerateActiveResetToken).toHaveBeenCalledWith({
      id: user.id,
      role: user.role,
      email: user.email,
    });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        email: user.email,
        subject: "Activate your account",
        text: expect.stringContaining(
          "http://localhost:4000/api/v1/auth/verify-email/activation-token",
        ),
      }),
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      code: 200,
      message: "Verification email sent",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should propagate the error when sending the email fails", async () => {
    mockFindUserByEmail.mockResolvedValue({
      id: "1",
      name: "Jane",
      role: "user",
      email: "jane@test.com",
      status: "pending",
    });
    mockGenerateActiveResetToken.mockReturnValue("activation-token");
    const smtpError = new Error("Email sending failed: SMTP down");
    mockSendMail.mockRejectedValue(smtpError);

    const req = { body: { email: "jane@test.com" } };
    await resendVerificationMailController(req, res, next);

    expect(next).toHaveBeenCalledWith(smtpError);
    expect(res.status).not.toHaveBeenCalled();
  });
});
