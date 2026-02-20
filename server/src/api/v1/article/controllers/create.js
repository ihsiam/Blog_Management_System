const defaults = require("../../../../config/defaults");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const create = async (req, res, next) => {
  try {
    const { title } = req.body;

    // validate title
    if (!title || typeof title !== "string" || !title.trim()) {
      throw badRequest(
        [{ field: "title", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }

    const body = req.body.body || defaults.body;
    const cover = req.body.cover || defaults.cover;
    const status = req.body.status || defaults.articleStatus;
    const author = req.user?.id;

    // create article
    const article = await articleServices.create({
      title,
      body,
      cover,
      status,
      author,
    });

    // response
    res.status(201).json({
      code: 201,
      message: "Article created",
      data: article,
      links: {
        self: `/api/v1/articles/${article.id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = create;
