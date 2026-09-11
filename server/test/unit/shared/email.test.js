/**
 * Unit tests for src/lib/email/index.js
 *
 * Dependencies mocked:
 * - nodemailer (real SMTP delivery is an external service and must
 *   never run during unit tests)
 */

const mockSendMail = jest.fn();
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.doMock("nodemailer", () => ({ createTransport: mockCreateTransport }));

const { sendMail } = require("../../../src/lib/email");

describe("email service (src/lib/email)", () => {
  let consoleLogSpy;
  let consoleErrorSpy;

  beforeEach(() => {
    mockSendMail.mockReset();
    consoleLogSpy = jest.spyOn(console, "log").mockImplementation(() => {});
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
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
      expect(consoleLogSpy).toHaveBeenCalledWith(
        "EMAIL SENT:",
        expect.objectContaining({ to: "jane@test.com" }),
      );
    });
  });

  describe("delivery failure", () => {
    it("should wrap SMTP errors in a generic error message", async () => {
      mockSendMail.mockRejectedValue(new Error("SMTP connection refused"));

      await expect(
        sendMail({ email: "jane@test.com", subject: "Hi", text: "body" }),
      ).rejects.toThrow("Email sending failed: SMTP connection refused");
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });
});
