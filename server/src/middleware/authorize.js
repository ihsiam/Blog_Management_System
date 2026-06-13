const { forbidden, unauthorized } = require("../utils/error");

/**
 * Creates a role-based authorization middleware.
 *
 * @param {string[]} [roles=["admin"]] - Allowed roles for the protected resource
 *
 * @returns {import("express").RequestHandler} Express middleware function
 */
const authorize =
  (roles = ["admin"]) =>
  (req, _res, next) => {
    // Ensure request is authenticated before checking permissions.
    if (!req.user || !req.user.role) {
      return next(unauthorized("Authentication required"));
    }

    // Verify that the authenticated user's role
    if (!roles.includes(req.user.role)) {
      return next(forbidden("You are not allowed to access this resource"));
    }

    // Authorization successful
    return next();
  };

module.exports = authorize;
