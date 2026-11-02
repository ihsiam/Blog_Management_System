/**
 * Unit tests for src/lib/email/index.js
 *
 * Dependencies mocked:
 * - src/utils/nodemailer (real SMTP delivery is an external service and
 *   must never run during unit tests)
 */

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.doMock("../../../src/utils/nodemailer", () => ({
  createTransporter: mockCreateTransport,
}));

const mockLoggerInfo = jest.fn();
const mockLoggerError = jest.fn();
jest.doMock("../../../src/utils/logger", () => ({
  info: mockLoggerInfo,
  error: mockLoggerError,
}));

const { sendMail } = require("../../../src/lib/email");

describe("email service (src/lib/email)", () => {
  beforeEach(() => {
    mockSendMail.mockReset();
    mockLoggerInfo.mockReset();
    mockLoggerError.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("input validation", () => {
    it("should reject when the email address is missing", async () => {
      await expect(sendMail({ subject: "Hi", text: "body" })).rejects.toThrow(
        "Missing required email fields (email, subject, text)",
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it("should reject when the subject is missing", async () => {
      await expect(
        sendMail({ email: "jane@test.com", text: "body" }),
      ).rejects.toThrow("Missing required email fields (email, subject, text)");
    });

    it("should reject when the text body is missing", async () => {
      await expect(
        sendMail({ email: "jane@test.com", subject: "Hi" }),
      ).rejects.toThrow("Missing required email fields (email, subject, text)");
    });
  });

  describe("successful delivery", () => {
    it("should send the email through the configured transporter", async () => {
      mockSendMail.mockResolvedValue({ messageId: "abc123" });

      const result = await sendMail({
        email: "jane@test.com",
        subject: "Welcome",
        text: "Hello Jane",
      });

      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "jane@test.com",
          subject: "Welcome",
          text: "Hello Jane",
        }),
      );
      expect(result).toEqual({ messageId: "abc123" });
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        "Email sent",
        expect.objectContaining({ messageId: "abc123" }),
      );
    });
  });

  describe("delivery failure", () => {
    it("should wrap SMTP errors in a generic error message", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP connection refused"));

      await expect(
        sendMail({ email: "jane@test.com", subject: "Hi", text: "body" }),
      ).rejects.toThrow("Email sending failed: SMTP connection refused");
      expect(mockLoggerError).toHaveBeenCalledWith(
        "Failed to send email",
        expect.objectContaining({ message: "SMTP connection refused" }),
      );
    });
  });
});
