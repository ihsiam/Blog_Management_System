const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");
const { ARTICLE_STATUS } = require("../../../../config/constants");
const { mapArticle } = require("../../../../utils/mappers");

/**
 * Create a new article for the authenticated author.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.title - Article title.
 * @param {string} req.body.body - Article content.
 * @param {string} req.body.category - Category ID.
 * @param {Object} req.file - Uploaded cover image.
 * @param {Object} req.user - Authenticated user.
 * @param {string} req.user.id - Author user ID.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 201 reply, or undefined when an error is forwarded to `next`.
 */
const create = async (req, res, next) => {
  try {
    const { title, body, category } = req.body;

    const errors = [];

    if (!title || typeof title !== "string" || !title.trim()) {
      errors.push({ field: "title", message: "invalid input", in: "body" });
    }

    const status = ARTICLE_STATUS.PUBLISHED;
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

    const article = await articleServices.create({
      title,
      body,
      status,
      author,
      category,
      file: req.file,
    });

    return res.status(201).json({
      code: 201,
      message: "Article created",
      data: mapArticle(article),
      links: {
        self: `/api/v1/articles/${article.id}`,
      },
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = create;
