const mongoose = require("mongoose");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

/**
 * Partially updates an article (PATCH).
 *
 * Updates title, body, cover, or category for the article owner.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 *
 * @param {Object} req.body - Request payload
 * @param {string} [req.body.title] - Article title
 * @param {string} [req.body.body] - Article content
 * @param {string} [req.body.category] - Category ID
 * @param {Object} [req.file] - Uploaded cover image
 *
 * @param {Object} req.user - Authenticated user
 * @param {string} req.user.role - User role (admin/user)
 *
 * @param {import("express").Response} res
 * @param {Function} next
 *
 * @returns {Promise<void>} Sends updated article response
 */
const updateItemPatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, body, category, status } = req.body;
    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      errors.push({
        field: "title",
        message: "invalid input",
        in: "body",
      });
    }

    if (category !== undefined && !mongoose.Types.ObjectId.isValid(category)) {
      errors.push({
        field: "category",
        message: "invalid input",
        in: "body",
      });
    }

    if (status !== undefined) {
      errors.push({ field: "status", message: "invalid input", in: "body" });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const updateData = {
      title,
      body,
      category,
      file: req.file,
    };

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
