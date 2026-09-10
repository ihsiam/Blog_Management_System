/**
 * Unit tests for src/lib/token/index.js
 *
 * jsonwebtoken itself is NOT mocked: it is a pure, local, deterministic
 * library (no network/db/filesystem I/O), so exercising real sign/verify
 * round-trips is the most meaningful way to test this wrapper's logic.
 * `jwt.sign` is spied on for exactly one test to force the internal
 * error-handling branch of `signToken`.
 *
 * Secrets are set on `process.env` before the module is first required,
 * since the module reads them into a config object at import time.
 */

process.env.JWT_ACCESS_SECRET = "test-access-secret";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret";
process.env.JWT_ACTIVE_RESET_SECRET = "test-active-reset-secret";
process.env.JWT_ACCESS_EXPIRES = "15m";
process.env.JWT_REFRESH_EXPIRES = "7d";
process.env.JWT_ACTIVE_RESET_EXPIRES = "5m";

const jwt = require("jsonwebtoken");
const tokenService = require("../../../src/lib/token");

describe("token service (src/lib/token)", () => {
  afterAll(() => {
    delete process.env.JWT_ACCESS_SECRET;
    delete process.env.JWT_REFRESH_SECRET;
    delete process.env.JWT_ACTIVE_RESET_SECRET;
    delete process.env.JWT_ACCESS_EXPIRES;
    delete process.env.JWT_REFRESH_EXPIRES;
    delete process.env.JWT_ACTIVE_RESET_EXPIRES;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  const payload = { id: "1", role: "user", email: "jane@test.com" };

  describe("token generation", () => {
    it("should generate a valid access token that verifies with the access secret", () => {
      const token = tokenService.generateAccessToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

      expect(decoded).toMatchObject(payload);
    });

    it("should generate a valid refresh token that verifies with the refresh secret", () => {
      const token = tokenService.generateRefreshToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_REFRESH_SECRET);

      expect(decoded).toMatchObject(payload);
    });

    it("should generate a valid active/reset token that verifies with the active/reset secret", () => {
      const token = tokenService.generateActiveResetToken(payload);
      const decoded = jwt.verify(token, process.env.JWT_ACTIVE_RESET_SECRET);

      expect(decoded).toMatchObject(payload);
    });

    it("should wrap JWT signing failures in a generic error", () => {
      jest.spyOn(jwt, "sign").mockImplementation(() => {
        throw new Error("boom");
      });

      expect(() => tokenService.generateAccessToken(payload)).toThrow(
        "Failed to generate token",
      );
    });
  });

  describe("token verification", () => {
    it("should verify a valid access token and return its decoded payload", () => {
      const token = tokenService.generateAccessToken(payload);

      expect(tokenService.verifyAccessToken(token)).toMatchObject(payload);
    });

    it("should verify a valid refresh token and return its decoded payload", () => {
      const token = tokenService.generateRefreshToken(payload);

      expect(tokenService.verifyRefreshToken(token)).toMatchObject(payload);
    });

    it("should reject verification when the token is expired", () => {
      const expiredToken = jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
        expiresIn: "-10s",
      });

      expect(() => tokenService.verifyAccessToken(expiredToken)).toThrow(
        expect.objectContaining({
          statusCode: 401,
          error: "Unauthorized",
          message: "Access token expired",
        }),
      );
    });

    it("should reject verification when the token signature is invalid", () => {
      const tokenSignedWithWrongSecret = jwt.sign(payload, "wrong-secret");

      expect(() =>
        tokenService.verifyAccessToken(tokenSignedWithWrongSecret),
      ).toThrow(
        expect.objectContaining({
          statusCode: 401,
          error: "Unauthorized",
          message: "Invalid Access token",
        }),
      );
    });

    it("should reject verification when the refresh token signature is invalid", () => {
      const tokenSignedWithWrongSecret = jwt.sign(payload, "wrong-secret");

      expect(() =>
        tokenService.verifyRefreshToken(tokenSignedWithWrongSecret),
      ).toThrow(
        expect.objectContaining({
          statusCode: 401,
          error: "Unauthorized",
          message: "Invalid Refresh token",
        }),
      );
    });

    it("should reject verification when the token is missing", () => {
      // NOTE: see "Bugs discovered" in the final report — the specific
      // "<label> token missing" message is never surfaced to the caller
      // because of how the catch block is structured. This test documents
      // the current, actual behavior.
      expect(() => tokenService.verifyAccessToken(undefined)).toThrow(
        expect.objectContaining({
          statusCode: 401,
          error: "Unauthorized",
          message: "Authentication failed",
        }),
      );
    });
  });

  describe("decodeToken", () => {
    it("should decode a token's payload without verifying its signature", () => {
      const tokenSignedWithAnySecret = jwt.sign(payload, "any-secret-at-all");

      expect(tokenService.decodeToken(tokenSignedWithAnySecret)).toMatchObject(
        payload,
      );
    });

    it("should reject decoding when the token format is invalid", () => {
      expect(() => tokenService.decodeToken("not-a-jwt-token")).toThrow(
        expect.objectContaining({
          statusCode: 400,
          error: "Bad request",
          message: "Invalid JWT token format",
        }),
      );
    });
  });
});
