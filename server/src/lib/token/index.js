const jwt = require("jsonwebtoken");
const { serverError } = require("../../utils/error");

const { JWT_SECRET } = process.env;
const JWT_EXPIRES_IN = "7d";

const generateToken = (payload) => {
  try {
    return jwt.sign(payload, JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: JWT_EXPIRES_IN,
    });
  } catch (e) {
    console.log("[JWT]: ", e);
    throw serverError();
  }
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  } catch (e) {
    console.log("[JWT]: ", e);
    throw serverError();
  }
};

const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (e) {
    console.log("[JWT]: ", e);
    throw serverError();
  }
};

module.exports = { generateToken, verifyToken, decodeToken };
