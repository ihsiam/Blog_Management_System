const { forbidden, unauthorized } = require("../utils/error");

const authorize =
  (roles = ["admin"]) =>
  (req, _res, next) => {
    // req header check
    if (!req.user || !req.user.role) {
      return next(unauthorized("Authentication required"));
    }

    // role check
    if (!roles.includes(req.user.role)) {
      return next(forbidden("You are not allowed to access this resource"));
    }

    return next();
  };

module.exports = authorize;
