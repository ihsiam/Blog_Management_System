/**
 * Unit tests for src/utils/error.js
 *
 * This module is a pure, dependency-free error factory used throughout
 * the whole application as the custom error contract. It has been
 * exercised indirectly (with explicit arguments) in every prior phase;
 * this file directly verifies its own default-value contract, which
 * callers throughout the codebase implicitly rely on.
 */

const {
  badRequest,
  unauthorized,
  forbidden,
  notFound,
} = require("../../../src/utils/error");

describe("error factory (src/utils/error)", () => {
  describe("badRequest", () => {
    it("should default to statusCode 400 and message 'invalid input' when called with no arguments", () => {
      const err = badRequest();

      expect(err).toBeInstanceOf(Error);
      expect(err.statusCode).toBe(400);
      expect(err.error).toBe("Bad request");
      expect(err.message).toBe("invalid input");
    });

    it("should attach the given data and message", () => {
      const data = [{ field: "email", message: "Invalid email", in: "body" }];
      const err = badRequest(data, "Validation failed");

      expect(err.data).toBe(data);
      expect(err.message).toBe("Validation failed");
    });

    it("should attach data even when it is explicitly null", () => {
      const err = badRequest(null, "Invalid token");

      expect(err).toHaveProperty("data", null);
    });

    it("should not attach a data property when data is undefined", () => {
      const err = badRequest(undefined, "invalid input");

      expect(err).not.toHaveProperty("data");
    });
  });

  describe("unauthorized", () => {
    it("should default to statusCode 401 and a generic permission message", () => {
      const err = unauthorized();

      expect(err.statusCode).toBe(401);
      expect(err.error).toBe("Unauthorized");
      expect(err.message).toBe("You don't have the right permission.");
      expect(err).not.toHaveProperty("data");
    });

    it("should use the given message", () => {
      const err = unauthorized("Invalid credentials");

      expect(err.message).toBe("Invalid credentials");
    });
  });

  describe("forbidden", () => {
    it("should default to statusCode 403 and message 'Permission denied'", () => {
      const err = forbidden();

      expect(err.statusCode).toBe(403);
      expect(err.error).toBe("Forbidden");
      expect(err.message).toBe("Permission denied");
    });

    it("should use the given message", () => {
      const err = forbidden("You are not allowed to access this resource");

      expect(err.message).toBe(
        "You are not allowed to access this resource",
      );
    });
  });

  describe("notFound", () => {
    it("should default to statusCode 404 and message 'Requested resource not found'", () => {
      const err = notFound();

      expect(err.statusCode).toBe(404);
      expect(err.error).toBe("Not found");
      expect(err.message).toBe("Requested resource not found");
    });

    it("should use the given message", () => {
      const err = notFound("Article not found");

      expect(err.message).toBe("Article not found");
    });
  });

  it("should produce plain Error instances usable with Express's next(err)", () => {
    const err = notFound();

    expect(err instanceof Error).toBe(true);
    expect(typeof err.message).toBe("string");
  });
});
