const defaults = require("../../../../config/defaults");
const articleServices = require("../../../../lib/articles");

const updateOrCreateItem = async (req, res, next) => {
  const { id } = req.params;
  const { title } = req.body;
  const { body } = req.body;
  const author = req.user._id;
  const cover = req.body.cover || defaults.cover;
  const status = req.body.status || defaults.articleStatus;

  try {
    const { article, statusCode } = await articleServices.updateOrCreate(id, {
      title,
      body,
      cover,
      status,
      author,
    });

    res.status(statusCode).json({
      code: statusCode,
      message:
        statusCode === 200
          ? "successfully updated article data"
          : "Article created",
      data: article,
      links: {
        self: `/articles/${article._id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = updateOrCreateItem;
