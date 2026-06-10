const jwt = require("jsonwebtoken");
const { badRequest, unauthorized } = require("../../utils/error");

// =========================
// Config
// =========================
const CONFIG = {
  ACTIVE_RESET_EXPIRES: process.env.JWT_ACTIVE_RESET_EXPIRES || "5m",
  REFRESH_EXPIRES: process.env.JWT_REFRESH_EXPIRES || "7d",
  ACCESS_EXPIRES: process.env.JWT_ACCESS_EXPIRES || "15m",

  ACTIVE_RESET_SECRET: process.env.JWT_ACTIVE_RESET_SECRET,
  REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
};

// =========================
// Generic Helpers
// =========================
const signToken = (payload, secret, expiresIn, label) => {
  try {
    return jwt.sign(payload, secret, {
      algorithm: "HS256",
      expiresIn,
    });
  } catch (err) {
    console.error(`[JWT SIGN ERROR - ${label}]`, err);
    throw new Error(
      "We are sorry for the inconvenience. Please try again later.",
    );
  }
};

const verifyToken = (token, secret, label) => {
  try {
    if (!token) throw unauthorized(`${label} token missing`);

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

// =========================
// Token Generators
// =========================
const generateActiveResetToken = (payload) =>
  signToken(
    payload,
    CONFIG.ACTIVE_RESET_SECRET,
    CONFIG.ACTIVE_RESET_EXPIRES,
    "ACTIVE_RESET",
  );

const generateAccessToken = (payload) =>
  signToken(payload, CONFIG.ACCESS_SECRET, CONFIG.ACCESS_EXPIRES, "ACCESS");

const generateRefreshToken = (payload) =>
  signToken(payload, CONFIG.REFRESH_SECRET, CONFIG.REFRESH_EXPIRES, "REFRESH");

// =========================
// Token Verifiers
// =========================
const verifyActiveResetToken = (token) =>
  verifyToken(token, CONFIG.ACTIVE_RESET_SECRET, "Active/Reset");

const verifyAccessToken = (token) =>
  verifyToken(token, CONFIG.ACCESS_SECRET, "Access");

const verifyRefreshToken = (token) =>
  verifyToken(token, CONFIG.REFRESH_SECRET, "Refresh");

// =========================
// Decode
// =========================
const decodeToken = (token) => {
  try {
    const decoded = jwt.decode(token);

    if (!decoded) {
      throw badRequest(null, "Invalid JWT token format");
    }

    return decoded;
  } catch (err) {
    console.error("[JWT DECODE ERROR]", err);
    throw badRequest(null, "Invalid JWT token");
  }
};

// =========================
// Export
// =========================
module.exports = {
  generateActiveResetToken,
  generateAccessToken,
  generateRefreshToken,
  verifyActiveResetToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
