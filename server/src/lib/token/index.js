const jwt = require("jsonwebtoken");
const { badRequest, unauthorized } = require("../../utils/error");

const { JWT_SECRET } = process.env;
const JWT_EXPIRES_IN = "7d";

// auth token generate
const generateToken = (payload) => {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: JWT_EXPIRES_IN,
    });
  } catch (e) {
    console.log("[JWT GENERATE]:", e);
    throw new Error(
      "We are sorry for the inconvenience. Please try again later.",
    );
  }
};

// verify auth token
const verifyToken = (token) => {
  try {
    if (!token) {
      throw unauthorized("Authorization token missing");
    }

    return jwt.verify(token, JWT_SECRET, {
      algorithms: ["HS256"],
    });
  } catch (e) {
    console.log("[JWT VERIFY]:", e);

    // Token expired
    if (e.name === "TokenExpiredError") {
      throw unauthorized("JWT token expired");
    }

    // Invalid token
    if (e.name === "JsonWebTokenError") {
      throw unauthorized("Invalid JWT token");
    }

    // Token not active yet
    if (e.name === "NotBeforeError") {
      throw unauthorized("JWT token not active yet");
    }

    // Fallback
    throw unauthorized("Authentication failed");
  }
};

// decode the token
const decodeToken = (token) => {
  try {
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
  generateToken,
  verifyToken,
  decodeToken,
};
