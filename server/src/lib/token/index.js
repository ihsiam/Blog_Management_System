const jwt = require("jsonwebtoken");

const { JWT_SECRET } = process.env;
const JWT_EXPIRES_IN = "7d";

const generateToken = (payload) =>
  jwt.sign(payload, JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: JWT_EXPIRES_IN,
  });

const verifyToken = (token) =>
  jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });

module.exports = { generateToken, verifyToken };
