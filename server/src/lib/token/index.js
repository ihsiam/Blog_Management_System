const jwt = require("jsonwebtoken");
const { badRequest, unauthorized } = require("../../utils/error");

// Keep JWT secrets and lifetimes in one configuration object.
const CONFIG = {
  REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || "30d",
  ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || "15m",

  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
};

/**
 * Signs a JWT token.
 *
 * @param {Object} payload - Data stored inside the token.
 * @param {string} secret - Secret key used to sign the token.
 * @param {string|number} expiresIn - Expiration time, such as "15m" or "7d".
 * @param {string} label - Token type label used for logging and debugging.
 *
 * @returns {string} Signed JWT token.
 *
 * @throws {Error} If token generation fails due to a JWT error.
 */
const signToken = (payload, secret, expiresIn, label) => {
  try {
    return jwt.sign(payload, secret, {
      algorithm: "HS256",
      expiresIn,
    });
  } catch (err) {
    console.error(`[JWT SIGN ERROR - ${label}]`, err);
    throw new Error("Failed to generate token");
  }
};

/**
 * Verifies a JWT token and returns decoded payload.
 *
 * Converts JWT errors into standardized authentication errors.
 *
 * @param {string} token - JWT token to verify.
 * @param {string} secret - Secret key used for verification.
 * @param {string} label - Token type label for logging and error context.
 *
 * @returns {Object} Decoded JWT payload.
 *
 * @throws {Error} Unauthorized if the token is missing, invalid, expired, or not active.
 */
const verifyToken = (token, secret, label) => {
  try {
    if (!token) {
      throw unauthorized(`${label} token missing`);
    }

    return jwt.verify(token, secret, {
      algorithms: ["HS256"],
    });
  } catch (err) {
    console.error(`[JWT VERIFY ERROR - ${label}]`, err);

    switch (err.name) {
      case "TokenExpiredError":
        throw unauthorized(`${label} token expired`);

      case "JsonWebTokenError":
        throw unauthorized(`Invalid ${label} token`);

      case "NotBeforeError":
        throw unauthorized(`${label} token not active yet`);

      default:
        throw unauthorized("Authentication failed");
    }
  }
};

/**
 * Generates short-lived access token for API authentication.
 *
 * @param {Object} payload - User identity and claims.
 * @returns {string} Signed JWT access token.
 */
const generateAccessToken = (payload) =>
  signToken(payload, CONFIG.ACCESS_SECRET, CONFIG.ACCESS_EXPIRES, "ACCESS");

/**
 * Generates long-lived refresh token for session management.
 *
 * @param {Object} payload - User identity and session data.
 * @returns {string} Signed JWT refresh token.
 */
const generateRefreshToken = (payload) =>
  signToken(payload, CONFIG.REFRESH_SECRET, CONFIG.REFRESH_EXPIRES, "REFRESH");

/**
 * Verifies access token used for API authentication.
 *
 * @param {string} token - JWT access token.
 * @returns {Object} Decoded payload.
 */
const verifyAccessToken = (token) =>
  verifyToken(token, CONFIG.ACCESS_SECRET, "Access");

/**
 * Verifies refresh token used for session continuation.
 *
 * @param {string} token - JWT refresh token.
 * @returns {Object} Decoded payload.
 */
const verifyRefreshToken = (token) =>
  verifyToken(token, CONFIG.REFRESH_SECRET, "Refresh");

/**
 * Decodes JWT payload without verifying signature.
 *
 * @param {string} token - JWT token.
 * @returns {Object} Decoded payload.
 *
 * @throws {Error} If the token format is invalid.
 */
const decodeToken = (token) => {
  const decoded = jwt.decode(token);

  if (!decoded) {
    throw badRequest(null, "Invalid JWT token format");
  }

  return decoded;
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
