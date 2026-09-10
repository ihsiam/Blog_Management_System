/**
 * Unit tests for src/api/v1/authentication/controllers/setupAdmin.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (systemAdmin business logic)
 * - src/lib/token           (token generation)
 * - src/lib/user            (refresh token persistence)
 */

const mockSystemAdmin = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({
  systemAdmin: mockSystemAdmin,
}));

const mockGenerateAccessToken = jest.fn();
const mockGenerateRefreshToken = jest.fn();
jest.doMock("../../../src/lib/token", () => ({
  generateAccessToken: mockGenerateAccessToken,
  generateRefreshToken: mockGenerateRefreshToken,
}));

const mockSaveRefreshToken = jest.fn();
jest.doMock("../../../src/lib/user", () => ({
  saveRefreshToken: mockSaveRefreshToken,
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
    mockGenerateAccessToken.mockReset();
    mockGenerateRefreshToken.mockReset();
    mockSaveRefreshToken.mockReset();
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
      mockGenerateAccessToken.mockReturnValue("access-token");
      mockGenerateRefreshToken.mockReturnValue("refresh-token");
      mockSaveRefreshToken.mockResolvedValue(undefined);

      const req = { body: validBody };
      await setupAdminController(req, res, next);

      expect(mockSystemAdmin).toHaveBeenCalledWith(validBody);
      const expectedPayload = {
        id: createdAdmin.id,
        role: createdAdmin.role,
        email: createdAdmin.email,
      };
      expect(mockGenerateAccessToken).toHaveBeenCalledWith(expectedPayload);
      expect(mockGenerateRefreshToken).toHaveBeenCalledWith(expectedPayload);
      expect(mockSaveRefreshToken).toHaveBeenCalledWith(
        createdAdmin.id,
        "refresh-token",
      );
      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token", {
        httpOnly: true,
        secure: true,
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 201,
          data: { accessToken: "access-token" },
        }),
      );
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
      expect(mockGenerateAccessToken).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
