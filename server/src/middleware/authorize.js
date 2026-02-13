const { forbidden, unauthorized } = require("../utils/error");

// Authorization Middleware
const authorize =
  (roles = ["admin"]) =>
  (req, _res, next) => {
    try {
      // req header check
      if (!req.user || !req.user.role) {
        return next(unauthorized("Authentication required"));
      }

      // role base permission check
      if (!roles.includes(req.user.role)) {
        return next(forbidden("You are not allowed to access this resource"));
      }

      return next();
    } catch (e) {
      return next(forbidden("You are not allowed to access this resource"));
    }
  };

module.exports = authorize;
