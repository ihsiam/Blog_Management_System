/**
 * Unit tests for src/api/v1/authentication/controllers/register.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (register business logic)
 * - src/lib/email          (SMTP email sending)
 */

const mockRegister = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  register: mockRegister,
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
    mockSendMail.mockReset();
    res = createMockResponse();
    next = jest.fn();
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
    it("should create the account, send a verification code email, and return a sanitized user payload", async () => {
      const createdUser = {
        id: "1",
        name: "Jane",
        email: "jane@test.com",
        account_status: "pending",
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-01-01T00:00:00.000Z",
        verificationCode: "123456",
      };
      mockRegister.mockResolvedValue(createdUser);
      mockSendMail.mockResolvedValue({ messageId: "abc" });

      const req = { body: validBody };
      await registerController(req, res, next);

      expect(mockRegister).toHaveBeenCalledWith(validBody);
      expect(mockSendMail).toHaveBeenCalledWith({
        email: validBody.email,
        subject: "Activate your account",
        text: expect.stringContaining("123456"),
      });

      expect(res.status).toHaveBeenCalledWith(201);
      const jsonPayload = res.json.mock.calls[0][0];
      expect(jsonPayload).toMatchObject({
        code: 201,
        message:
          "Account created successfully. Please check your email to activate your account.",
        data: {
          id: createdUser.id,
          name: createdUser.name,
          email: createdUser.email,
          status: createdUser.account_status,
          createdAt: createdUser.createdAt,
          updatedAt: createdUser.updatedAt,
        },
        links: { self: "/api/v1/auth/sign-up" },
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
        account_status: "pending",
        verificationCode: "123456",
      });
      const smtpError = new Error("Email sending failed: SMTP down");
      mockSendMail.mockRejectedValue(smtpError);

      const req = { body: validBody };
      await registerController(req, res, next);

      expect(next).toHaveBeenCalledWith(smtpError);
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
