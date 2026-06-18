const mongoose = require("mongoose");
const articleServices = require("../lib/articles");
const commentServices = require("../lib/comments");
const userServices = require("../lib/user");
const { forbidden, unauthorized, badRequest } = require("../utils/error");

/**
 * Ownership-based authorization middleware.
 * Restricts access to resources based on ownership rules.
 *
 * @param {string} model - Resource type (e.g., "article", "comment")
 * @param {Object} [options={}] - Middleware configuration options
 * @param {boolean} [options.allowMissing=false] - If true, allows missing resource handling in service layer
 *
 * @returns {import("express").RequestHandler} Express middleware function
 */
const ownership =
  (model, options = {}) =>
  async (req, _res, next) => {
    try {
      // Ensure user is authenticated
      if (!req.user || !req.user.id) {
        return next(unauthorized("Authentication required"));
      }

      // Ensure resource ID exists
      if (!req.params?.id) {
        return next(forbidden("Resource ID is required"));
      }

      // id validation
      if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        throw badRequest([
          {
            field: "id",
            message: "invalid input",
            in: "params",
          },
        ]);
      }

      /**
       * ARTICLE ownership check
       */
      if (model === "article") {
        const isOwner = await articleServices.checkOwner({
          resourceId: req.params.id,
          userId: req.user.id,
          allowMissing: options.allowMissing,
        });

        // Allow access if owner or service allows missing resource
        if (isOwner === null || isOwner === true) {
          return next();
        }

        // Admin override
        if (req.user.role === "admin" && !options.allowMissing) {
          req.adminOverride = true;
          return next();
        }

        return next(
          forbidden("You do not have permission to access this article"),
        );
      }

      /**
       * COMMENT ownership check
       */
      if (model === "comment") {
        const isOwner = await commentServices.checkOwner({
          resourceId: req.params.id,
          userId: req.user.id,
        });

        // Allow access if user is owner
        if (isOwner) {
          return next();
        }

        // Admin override
        if (req.user.role === "admin") {
          req.adminOverride = true;
          return next();
        }

        return next(
          forbidden("You do not have permission to access this comment"),
        );
      }

      /**
       * User ownership check
       */
      if (model === "user") {
        const isOwner = await userServices.checkOwner({
          resourceId: req.params.id,
          userId: req.user.id,
        });

        // Allow access if user is owner
        if (isOwner) {
          return next();
        }

        // Allow admin access when needed
        if (options.allowAdmin && req.user.role === "admin") {
          return next();
        }

        return next(
          forbidden("You do not have permission to access this user"),
        );
      }

      // Unsupported model fallback
      return next(forbidden("You are not allowed to access this resource"));
    } catch (err) {
      return next(err);
    }
  };

module.exports = ownership;
