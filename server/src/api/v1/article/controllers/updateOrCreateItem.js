const defaults = require("../../../../config/defaults");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const updateOrCreateItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const { body } = req.body;
    const author = req.user.id;
    const cover = req.body.cover || defaults.cover;
    const status = req.body.status || defaults.articleStatus;

    const errors = [];

    // id validation
    if (!id || typeof id !== "string") {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // title validation
    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      errors.push({ field: "title", message: "invalid input", in: "body" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // update or create article
    const { article, statusCode } = await articleServices.updateOrCreate(id, {
      title,
      body,
      cover,
      status,
      author,
    });

    // response
    res.status(statusCode).json({
      code: statusCode,
      message:
        statusCode === 200
          ? "successfully updated article data"
          : "Article created",
      data: article,
      links: {
        self: `/api/v1/articles/${article.id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = updateOrCreateItem;
