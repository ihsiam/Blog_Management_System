/**
 * Unit tests for src/api/v1/authentication/controllers/register.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (register business logic)
 * - src/lib/token           (activation token generation)
 * - src/lib/email           (SMTP email sending)
 */

const mockRegister = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  register: mockRegister,
}));

const mockGenerateActiveResetToken = jest.fn();
jest.doMock("../../../src/lib/token", () => ({
  generateActiveResetToken: mockGenerateActiveResetToken,
}));

const mockSendMail = jest.fn();
jest.doMock("../../../src/lib/email", () => ({ sendMail: mockSendMail }));

const registerController = require("../../../src/api/v1/authentication/controllers/register");
const { createMockResponse } = require("../helpers/mockExpress");

describe("register controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockRegister.mockReset();
    mockGenerateActiveResetToken.mockReset();
    mockSendMail.mockReset();
    res = createMockResponse();
    next = jest.fn();
    process.env.APP_URL = "http://localhost:4000";
  });

  const validBody = {
    name: "Jane",
    email: "jane@test.com",
    password: "strong-password",
  };

  describe("input validation", () => {
    it("should reject when name, email, and password are all missing", async () => {
      const req = { body: {} };

      await registerController(req, res, next);

      expect(mockRegister).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledTimes(1);

      const err = next.mock.calls[0][0];
      expect(err).toMatchObject({ statusCode: 400, error: "Bad request" });
      expect(err.data).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "name" }),
          expect.objectContaining({ field: "email" }),
          expect.objectContaining({ field: "password" }),
        ]),
      );
    });

    it("should reject an invalid email format", async () => {
      const req = { body: { ...validBody, email: "not-an-email" } };

      await registerController(req, res, next);

      expect(mockRegister).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        { field: "email", message: "Invalid email format", in: "body" },
      ]);
    });

    it("should reject a password shorter than 8 characters", async () => {
      const req = { body: { ...validBody, password: "short" } };

      await registerController(req, res, next);

      expect(mockRegister).not.toHaveBeenCalled();
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

  describe("successful registration", () => {
    it("should create the account, send an activation email, and return sanitized user data", async () => {
      const createdUser = {
        id: "1",
        name: "Jane",
        email: "jane@test.com",
        password: "hashed-password",
        status: "pending",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
      };
      mockRegister.mockResolvedValue(createdUser);
      mockGenerateActiveResetToken.mockReturnValue("activation-token");
      mockSendMail.mockResolvedValue({ messageId: "abc" });

      const req = { body: validBody };
      await registerController(req, res, next);

      expect(mockRegister).toHaveBeenCalledWith(validBody);
      expect(mockGenerateActiveResetToken).toHaveBeenCalledWith({
        id: createdUser.id,
        role: createdUser.role,
        email: createdUser.email,
      });
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: validBody.email,
          subject: "Activate your account",
          text: expect.stringContaining(
            "http://localhost:4000/api/v1/auth/verify-email/activation-token",
          ),
        }),
      );

      expect(res.status).toHaveBeenCalledWith(201);
      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload.data).toEqual({
        id: createdUser.id,
        name: createdUser.name,
        email: createdUser.email,
        status: createdUser.status,
        createdAt: createdUser.createdAt,
        updatedAt: createdUser.updatedAt,
      });
      expect(jsonPayload.data.password).toBeUndefined();
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when the email already exists", async () => {
      const conflictError = Object.assign(new Error("Validation error"), {
        statusCode: 400,
      });
      mockRegister.mockRejectedValue(conflictError);

      const req = { body: validBody };
      await registerController(req, res, next);

      expect(next).toHaveBeenCalledWith(conflictError);
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    it("should propagate the error when sending the activation email fails", async () => {
      mockRegister.mockResolvedValue({
        id: "1",
        name: "Jane",
        email: "jane@test.com",
        role: "user",
      });
      mockGenerateActiveResetToken.mockReturnValue("activation-token");
      const smtpError = new Error("Email sending failed: SMTP down");
      mockSendMail.mockRejectedValue(smtpError);

      const req = { body: validBody };
      await registerController(req, res, next);

      expect(next).toHaveBeenCalledWith(smtpError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
