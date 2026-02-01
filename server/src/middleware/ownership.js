const articleService = require("../lib/articles");
const { authorizationError } = require("../utils/error");

const ownership =
  (model = "") =>
  async (req, _res, next) => {
    if (model === "article") {
      const owner = await articleService.CheckOwner({
        resourceId: req.params.id,
        userId: req.user._id,
      });

      if (owner) {
        return next();
      }
      return next(authorizationError());
    }
    return next(authorizationError());
  };

module.exports = ownership;
