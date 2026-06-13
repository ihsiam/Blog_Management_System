const defaults = require("../../../../config/defaults");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

/**
 * Updates an existing article or creates a new one if it does not exist.
 *
 * Response dynamically changes based on operation:
 * - 200 → updated article
 * - 201 → newly created article
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Article ID
 *
 * @param {Object} req.body - Request payload
 * @param {string} [req.body.title] - Article title
 * @param {string} [req.body.body] - Article content
 * @param {string} [req.body.cover] - Article cover image URL
 *
 * @param {Object} req.user - Authenticated user (from middleware)
 * @param {string} req.user.id - Author ID
 *
 * @param {import("express").Response} res
 * @param {Function} next
 *
 * @returns {Promise<void>} Sends created/updated article response
 */
const updateOrCreateItem = async (req, res, next) => {
  try {
    /**
     * Extract request data
     */
    const { id } = req.params;
    const { title, body } = req.body;

    const author = req.user.id;
    const cover = req.body.cover || defaults.cover;
    const status = defaults.articleStatus;

    /**
     * Collect validation errors
     */
    const errors = [];

    /**
     * Validate ID
     */
    if (!id || typeof id !== "string") {
      errors.push({
        field: "id",
        message: "invalid input",
        in: "params",
      });
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
     * Throw validation error if any exist
     */
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    /**
     * Create or update article
     */
    const { article, statusCode } = await articleServices.updateOrCreate(id, {
      title,
      body,
      cover,
      status,
      author,
    });

    /**
     * Response message based on operation type
     */
    const message =
      statusCode === 200
        ? "Successfully updated article"
        : "Article created successfully";

    return res.status(statusCode).json({
      code: statusCode,
      message,
      data: article,
      links: {
        self: `/api/v1/articles/${article.id}`,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = updateOrCreateItem;
