const articleServices = require("../../../../lib/articles");

const updateItemPatch = async (req, res, next) => {
  const { id } = req.params;

  try {
    const article = await articleServices.updateItemPatch(id, req.body);

    res.status(200).json({
      code: 200,
      message: "successfully updated article data",
      data: article,
      links: {
        self: `/articles/${article._id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = updateItemPatch;
