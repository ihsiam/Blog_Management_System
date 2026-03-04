const jwt = require("jsonwebtoken");
const { badRequest, unauthorized } = require("../../utils/error");

// jwt credentials
const JWT_REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES || "7d";
const JWT_ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES || "15m";
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
const ACCESS_SECRET = process.env.JWT_ACCESS_SECRET;

// access token generate
const generateAccessToken = (payload) => {
  try {
    // generate token
    return jwt.sign(payload, ACCESS_SECRET, {
      algorithm: "HS256",
      expiresIn: JWT_ACCESS_EXPIRES,
    });
  } catch (e) {
    console.log("[JWT ACCESS GENERATE]:", e);
    throw new Error(
      "We are sorry for the inconvenience. Please try again later.",
    );
  }
};

// refresh token generate
const generateRefreshToken = (payload) => {
  try {
    // generate token
    return jwt.sign(payload, REFRESH_SECRET, {
      algorithm: "HS256",
      expiresIn: JWT_REFRESH_EXPIRES,
    });
  } catch (e) {
    console.log("[JWT REFRESH GENERATE]:", e);
    throw new Error(
      "We are sorry for the inconvenience. Please try again later.",
    );
  }
};

// verify access token
const verifyAccessToken = (token) => {
  try {
    // if no token
    if (!token) {
      throw unauthorized("Authorization token missing");
    }

    // verify token
    return jwt.verify(token, ACCESS_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (e) {
    console.log("[JWT ACCESS VERIFY]:", e);

    // Token expired
    if (e.name === "TokenExpiredError") {
      throw unauthorized("Access token expired");
    }

    // Invalid token
    if (e.name === "JsonWebTokenError") {
      throw unauthorized("Invalid access token");
    }

    // Token not active yet
    if (e.name === "NotBeforeError") {
      throw unauthorized("Access token not active yet");
    }

    // Fallback
    throw unauthorized("Authentication failed");
  }
};

// verify auth token
const verifyRefreshToken = (token) => {
  try {
    // if no token
    if (!token) {
      throw unauthorized("Refresh token missing");
    }

    // verify token
    return jwt.verify(token, REFRESH_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (e) {
    console.log("[JWT REFRESH VERIFY]:", e);

    // Token expired
    if (e.name === "TokenExpiredError") {
      throw unauthorized("Refresh token expired");
    }

    // Invalid token
    if (e.name === "JsonWebTokenError") {
      throw unauthorized("Invalid Refresh token");
    }

    // Token not active yet
    if (e.name === "NotBeforeError") {
      throw unauthorized("Refresh token not active yet");
    }

    // Fallback
    throw unauthorized("Authentication failed");
  }
};

// decode the token
const decodeToken = (token) => {
  try {
    // decode token
    const decoded = jwt.decode(token);

    // if not decoded
    if (!decoded) {
      throw badRequest(null, "Invalid JWT token format");
    }

    return decoded;
  } catch (e) {
    console.log("[JWT DECODE]:", e);
    throw badRequest(null, "Invalid JWT token");
  }
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  decodeToken,
};
