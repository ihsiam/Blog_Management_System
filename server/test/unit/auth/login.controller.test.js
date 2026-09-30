/**
 * Unit tests for src/api/v1/authentication/controllers/login.js
 *
 * Dependencies mocked:
 * - src/lib/authentication (login business logic)
 */

const mockLogin = jest.fn();
jest.doMock("../../../src/lib/authentication", () => ({ login: mockLogin }));

const loginController = require("../../../src/api/v1/authentication/controllers/login");
const { createMockResponse } = require("../helpers/mockExpress");

describe("login controller", () => {
  let res;
  let next;

  beforeEach(() => {
    mockLogin.mockReset();
    res = createMockResponse();
    next = jest.fn();
  });

  const buildRequest = (overrides = {}) => ({
    body: {
      email: "jane@test.com",
      password: "correct-password",
      ...overrides.body,
    },
    get: jest.fn().mockReturnValue("Mozilla/5.0"),
    ...overrides,
  });

  describe("input validation", () => {
    it("should reject when email is missing", async () => {
      const req = buildRequest({ body: { password: "some-password" } });

      await loginController(req, res, next);

      expect(mockLogin).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toMatchObject({ statusCode: 400, error: "Bad request" });
      expect(err.data).toEqual([
        { field: "email", message: "Email is required", in: "body" },
      ]);
    });

    it("should reject an invalid email format", async () => {
      const req = buildRequest({
        body: { email: "invalid", password: "some-password" },
      });

      await loginController(req, res, next);

      expect(mockLogin).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        { field: "email", message: "Invalid email format", in: "body" },
      ]);
    });

    it("should reject when password is missing", async () => {
      const req = buildRequest({ body: { email: "jane@test.com" } });
      delete req.body.password;

      await loginController(req, res, next);

      expect(mockLogin).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.data).toEqual([
        { field: "password", message: "Password is required", in: "body" },
      ]);
    });
  });

  describe("successful login", () => {
    it("should set the refresh token cookie and return only the access token", async () => {
      mockLogin.mockResolvedValue({
        accessToken: "access-token",
        refreshToken: "refresh-token",
      });

      const req = buildRequest();
      await loginController(req, res, next);

      expect(mockLogin).toHaveBeenCalledWith({
        email: "jane@test.com",
        password: "correct-password",
        deviceInfo: "Mozilla/5.0",
      });
      expect(res.cookie).toHaveBeenCalledWith("refreshToken", "refresh-token", {
        httpOnly: true,
        secure: true,
        sameSite: "strict",
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        code: 200,
        message: "Login successful",
        data: { accessToken: "access-token" },
        links: { self: "/api/v1/auth/sign-in" },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe("dependency failures", () => {
    it("should propagate the error when credentials are invalid", async () => {
      const authError = Object.assign(new Error("Invalid credentials"), {
        statusCode: 401,
      });
      mockLogin.mockRejectedValue(authError);

      const req = buildRequest();
      await loginController(req, res, next);

      expect(next).toHaveBeenCalledWith(authError);
      expect(res.cookie).not.toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
  });
});
