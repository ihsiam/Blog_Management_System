/**
 * Unit tests for src/api/v1/authentication/controllers/setupAdmin.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (systemAdmin business logic)
 * - src/lib/token           (token generation)
 * - src/lib/user            (refresh token persistence)
 */

const mockSystemAdmin = jest.fn();
const mockCreateSession = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  systemAdmin: mockSystemAdmin,
  createSession: mockCreateSession,
}));

const setupAdminController = require("../../../src/api/v1/authentication/controllers/setupAdmin");
const { createMockResponse } = require("../helpers/mockExpress");

describe("setupAdmin controller", () => {
  let res;
  let next;

  const validBody = {
    name: "Admin",
    email: "admin@test.com",
    password: "strong-password",
  };

  beforeEach(() => {
    mockSystemAdmin.mockReset();
    mockCreateSession.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  describe("input validation", () => {
    it("should reject when required fields are missing", async () => {
      const req = { body: {} };

      await setupAdminController(req, res, next);

      expect(mockSystemAdmin).not.toHaveBeenCalled();
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

    it("should reject a weak password", async () => {
      const req = { body: { ...validBody, password: "weak" } };

      await setupAdminController(req, res, next);

      expect(mockSystemAdmin).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        {
          field: "password",
          message: "Password must be at least 8 characters",
          in: "body",
        },
      ]);
    });
  });

  describe("successful setup", () => {
    it("should create the admin, persist the refresh token, and return an access token", async () => {
      const createdAdmin = {
        id: "1",
        name: "Admin",
        email: "admin@test.com",
        role: "admin",
      };
      mockSystemAdmin.mockResolvedValue(createdAdmin);
      mockCreateSession.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      const req = {
        body: validBody,
        get: jest.fn().mockReturnValue("Mozilla/5.0"),
      };
      await setupAdminController(req, res, next);

      expect(mockSystemAdmin).toHaveBeenCalledWith(validBody);
      expect(mockCreateSession).toHaveBeenCalledWith({
        user: createdAdmin,
        deviceInfo: "Mozilla/5.0",
      });
      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        code: 201,
        message: "System administrator created successfully",
        data: { accessToken: "access-token" },
        links: { "sign-in": "/api/v1/auth/sign-in" },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when a system administrator already exists", async () => {
      const conflictError = Object.assign(
        new Error("System admin already exists"),
        { statusCode: 403 },
      );
      mockSystemAdmin.mockRejectedValue(conflictError);

      const req = { body: validBody };
      await setupAdminController(req, res, next);

      expect(next).toHaveBeenCalledWith(conflictError);
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
