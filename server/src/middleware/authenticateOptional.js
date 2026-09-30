const tokenServices = require("../lib/token");
const userServices = require("../lib/user");

/**
 * Loads an authenticated user when a valid bearer token is provided.
 * Public requests continue without a user context.
 *
 * @param {import("express").Request} req - Express request object
 * @param {import("express").Response} _res - Express response object
 * @param {Function} next - Express middleware callback
 *
 * @returns {Promise<void>} Passes control to the next middleware
 */
const authenticateOptional = async (req, _res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

    const token = authHeader.split(" ")[1];
    const decoded = tokenServices.verifyAccessToken(token);
    const user = await userServices.findAuthUserById(decoded.id);

    if (user && user.account_status === "active") {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
        status: user.account_status,
      };
    }

    return next();
  } catch (err) {
    return next(err);
  }
};

module.exports = authenticateOptional;
