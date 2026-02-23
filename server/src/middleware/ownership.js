const articleService = require("../lib/articles");
const { forbidden, unauthorized, badRequest } = require("../utils/error");

// Ownership Middleware
const ownership =
  (model = "", options = {}) =>
  async (req, _res, next) => {
    try {
      // Check if user exists
      if (!req.user || !req.user.id) {
        return next(unauthorized("Authentication required"));
      }

      // check params id
      if (!req.params?.id) {
        return next(
          badRequest(
            [{ field: "id", message: "Resource ID is required", in: "params" }],
            "Validation error",
          ),
        );
      }

      // Model-specific ownership checks

      // ownership for article model
      if (model === "article") {
        const isOwner = await articleService.CheckOwner({
          resourceId: req.params.id,
          userId: req.user.id,
          allowMissing: options.allowMissing,
        });

        // if owner or put request
        if (isOwner === null || isOwner === true) {
          return next();
        }

        return next(
          forbidden("You do not have permission to access this article"),
        );
      }
      return next(forbidden("You are not allowed to access this resource"));
    } catch (e) {
      return next(e);
    }
  };

module.exports = ownership;
