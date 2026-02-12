const { verifyToken } = require("../lib/token");
const { findUserByEmail } = require("../lib/user");
const { unauthorized } = require("../utils/error");

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Token missing
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return next(unauthorized("Authorization token missing"));
    }

    const token = authHeader.split(" ")[1];

    // Verify JWT
    const decoded = verifyToken(token);

    const user = await findUserByEmail(decoded.email);
    if (!user) {
      return next(unauthorized("Invalid authentication token"));
    }

    // Account status check
    if (user.status !== "approved") {
      return next(unauthorized("Your account is not active"));
    }

    // Attach user to request
    req.user = decoded;
    console.log(req.user);

    return next();
  } catch (e) {
    return next(unauthorized("Authentication failed"));
  }
};

module.exports = authenticate;
