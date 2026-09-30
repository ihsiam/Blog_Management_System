const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

/**
 * Creates a new article.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.title - Article title
 * @param {string} req.body.body - Article content
 * @param {string} req.body.category - Category ID
 * @param {Object} req.file - Uploaded cover image
 *
 * @param {Object} req.user - Authenticated user (from auth middleware)
 * @param {string} req.user.id - User ID of the author
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends created article response
 *
 * @throws {Error} BadRequest if title validation fails
 */
const create = async (req, res, next) => {
  try {
    /**
     * Extract and validate title
     */
    const { title, body, category } = req.body;

    const errors = [];

    if (!title || typeof title !== "string" || !title.trim()) {
      errors.push({ field: "title", message: "invalid input", in: "body" });
    }

    /**
     * Prepare article payload with defaults
     */
    const status = "published";
    const author = req.user?.id;

    if (!body || typeof body !== "string" || !body.trim()) {
      errors.push({ field: "body", message: "invalid input", in: "body" });
    }
    if (!category || typeof category !== "string") {
      errors.push({
        field: "category",
        message: "invalid input",
        in: "body",
      });
    }
    if (!req.file) {
      errors.push({ field: "cover", message: "invalid input", in: "file" });
    }
    if (errors.length) throw badRequest(errors, "invalid input");
    /**
     * Create article in database
     */
    const article = await articleServices.create({
      title,
      body,
      status,
      author,
      category,
      file: req.file,
    });

    /**
     * Send response
     */
    return res.status(201).json({
      code: 201,
      message: "Article created",
      data: article,
      links: {
        self: `/api/v1/articles/${article.id}`,
      },
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = create;
