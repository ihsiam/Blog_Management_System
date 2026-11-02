const mongoose = require("mongoose");
const articleServices = require("../lib/articles");
const commentServices = require("../lib/comments");
const userServices = require("../lib/user");
const { forbidden, unauthorized, badRequest } = require("../utils/error");
const { ROLES } = require("../config/constants");

/**
 * Maps each supported resource type to its ownership service and label.
 *
 * @type {Record<string, { service: { checkOwner: Function }, label: string }>}
 */
const RESOURCES = {
  article: { service: articleServices, label: "article" },
  comment: { service: commentServices, label: "comment" },
  user: { service: userServices, label: "user" },
};

/**
 * Create middleware that allows the resource owner, and optionally admins.
 *
 * @param {"article" | "comment" | "user"} model - Resource type.
 * @param {Object} [options={}] - Middleware options.
 * @param {boolean} [options.allowAdmin=false] - Allow admins who are not owners.
 * @returns {import("express").RequestHandler} Ownership-checking middleware.
 * @throws {Error} When `model` is not a supported resource type.
 */
const ownership = (model, options = {}) => {
  const resource = RESOURCES[model];

  if (!resource) {
    throw new Error(`Unsupported ownership model: ${model}`);
  }

  /**
   * Allow the owner (and optionally an admin); otherwise pass an error.
   *
   * @param {import("express").Request} req - Express request.
   * @param {import("express").Response} _res - Express response.
   * @param {import("express").NextFunction} next - Next middleware.
   * @returns {Promise<void>} Resolves after `next` has been called.
   */
  return async (req, _res, next) => {
    try {
      if (!req.user?.id) {
        return next(unauthorized("Authentication required"));
      }

      // Ensure resource ID exists
      if (!req.params?.id) {
        return next(forbidden("Resource ID is required"));
      }

      // Reject malformed IDs before they reach the database query.
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return next(
          badRequest([{ field: "id", message: "invalid input", in: "params" }]),
        );
      }

      const isOwner = await resource.service.checkOwner({
        resourceId: req.params.id,
        userId: req.user.id,
      });

      if (isOwner) {
        return next();
      }

      // Admins may act on resources they do not own only when `allowAdmin` is set.
      if (options.allowAdmin && req.user.role === ROLES.ADMIN) {
        return next();
      }

      return next(
        forbidden(
          `You do not have permission to access this ${resource.label}`,
        ),
      );
    } catch (err) {
      // Forward errors from `checkOwner`, such as a missing resource.
      return next(err);
    }
  };
};

module.exports = ownership;
