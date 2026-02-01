const defaults = require("../../../../config/defaults");
const articleServices = require("../../../../lib/articles");

const create = async (req, res, next) => {
  const { title } = req.body;
  const body = req.body.body || defaults.body;
  const cover = req.body.cover || defaults.cover;
  const status = req.body.status || defaults.articleStatus;
  const author = req.user._id;

  try {
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
