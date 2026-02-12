const defaults = require("../../../../config/defaults");
const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const create = async (req, res, next) => {
  try {
    const { title } = req.body;

    const errors = [];

    // validate title
    if (typeof title !== "string" || !title.trim()) {
      errors.push({ field: "title", message: "invalid input", in: "body" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const body = req.body.body || defaults.body;
    const cover = req.body.cover || defaults.cover;
    const status = req.body.status || defaults.articleStatus;
    const author = req.user.id;

    const article = await articleServices.create({
      title,
      body,
      cover,
      status,
      author,
    });

    res.status(201).json({
      code: 201,
      message: "Article created",
      data: article,
      links: {
        self: `/articles/${article._id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = create;
