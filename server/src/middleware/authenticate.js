const { verifyToken } = require("../lib/token");
const { findUserByEmail } = require("../lib/user");
const { unauthorized } = require("../utils/error");

// Authentication Middleware
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    //  checking Authorization header's existence
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(unauthorized("Authorization token missing"));
    }

    // Extract token
    const token = authHeader.split(" ")[1];

    // Verify token
    const decoded = verifyToken(token);

    // find user from db
    const user = await findUserByEmail(decoded.email);

    // if not found
    if (!user) {
      return next(unauthorized("Invalid authentication token"));
    }

    // Account status check
    if (user.status !== "approved") {
      return next(unauthorized("Your account is not active"));
    }

    // Attach user to request
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
    };

    return next();
  } catch (e) {
    return next(unauthorized("Authentication failed"));
  }
};

module.exports = authenticate;
