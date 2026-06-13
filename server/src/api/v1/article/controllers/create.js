const defaults = require("../../../../config/defaults");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

/**
 * Creates a new article.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.body - Request payload
 * @param {string} req.body.title - Article title
 * @param {string} [req.body.body] - Article content
 * @param {string} [req.body.cover] - Article cover image URL
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
    const { title } = req.body;

    if (!title || typeof title !== "string" || !title.trim()) {
      throw badRequest(
        [{ field: "title", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }

    /**
     * Prepare article payload with defaults
     */
    const body = req.body.body || defaults.body;
    const cover = req.body.cover || defaults.cover;
    const status = defaults.articleStatus;
    const author = req.user?.id;

    /**
     * Create article in database
     */
    const article = await articleServices.create({
      title,
      body,
      cover,
      status,
      author,
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
