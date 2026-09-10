/**
 * Unit tests for src/middleware/authorize.js
 *
 * This middleware has no external dependencies to mock - it only reads
 * `req.user`, which is expected to have been attached by the
 * `authenticate` middleware earlier in the chain.
 */

const authorize = require("../../../src/middleware/authorize");

describe("authorize middleware", () => {
  let next;

  beforeEach(() => {
    next = jest.fn();
  });

  it("should call next() when the user's role is allowed", () => {
    const req = { user: { role: "admin" } };

    authorize(["admin", "user"])(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should default to requiring the admin role when no roles are provided", () => {
    const req = { user: { role: "admin" } };

    authorize()(req, {}, next);

    expect(next).toHaveBeenCalledWith();
  });

  it("should reject when the request has no authenticated user", () => {
    const req = {};

    authorize(["admin"])(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Authentication required",
      }),
    );
  });

  it("should reject when the authenticated user has no role", () => {
    const req = { user: {} };

    authorize(["admin"])(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 401,
        message: "Authentication required",
      }),
    );
  });

  it("should reject when the user's role is not in the allowed list", () => {
    const req = { user: { role: "user" } };

    authorize(["admin"])(req, {}, next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "You are not allowed to access this resource",
      }),
    );
  });
});
