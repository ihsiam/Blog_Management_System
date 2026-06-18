const mongoose = require("mongoose");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

/**
 * Partially updates an article (PATCH).
 *
 * - Regular user can update own article fields (title, body, cover)
 * - Admin can update all fields including status of his article
 * - Admin override (ownership bypass) → can only update status
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 *
 * @param {Object} req.body - Request payload
 * @param {string} [req.body.title] - Article title
 * @param {string} [req.body.body] - Article content
 * @param {string} [req.body.cover] - Article cover image
 * @param {string} [req.body.status] - Article status (admin only)
 *
 * @param {Object} req.user - Authenticated user
 * @param {string} req.user.role - User role (admin/user)
 * @param {boolean} [req.adminOverride] - Ownership override flag set by middleware
 *
 * @param {import("express").Response} res
 * @param {Function} next
 *
 * @returns {Promise<void>} Sends updated article response
 */
const updateItemPatch = async (req, res, next) => {
  try {
    /**
     * Extract params and body
     */
    const { id } = req.params;
    const { title, body, cover, status } = req.body;

    /**
     * Collect validation errors
     */
    const errors = [];

    /**
     * Validate article ID
     */
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    /**
     * Validate title (only if provided)
     */
    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      errors.push({
        field: "title",
        message: "invalid input",
        in: "body",
      });
    }

    /**
     * Throw validation errors if any exist
     */
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    /**
     * CASE 1: Admin override (ownership bypass)
     * Only allow status update
     */
    if (req.adminOverride) {
      if (
        status === undefined ||
        typeof status !== "string" ||
        !status.trim()
      ) {
        throw badRequest(
          [{ field: "status", message: "invalid input", in: "body" }],
          "invalid input",
        );
      }

      const article = await articleServices.updateItemPatch(id, { status });

      return res.status(200).json({
        code: 200,
        message: "Successfully updated article status",
        data: article,
        links: {
          self: `/api/v1/articles/${article.id}`,
        },
      });
    }

    /**
     * CASE 2: Normal update payload
     */
    const updateData = {
      title,
      body,
      cover,
    };

    /**
     * Only admin can update his own article status
     */
    if (req.user.role === "admin") {
      updateData.status = status;
    }

    /**
     * Update article
     */
    const article = await articleServices.updateItemPatch(id, updateData);

    return res.status(200).json({
      code: 200,
      message: "Successfully updated article data",
      data: article,
      links: {
        self: `/api/v1/articles/${article.id}`,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = updateItemPatch;
