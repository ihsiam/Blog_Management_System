const articleServices = require("../../../../lib/articles");

const findSingleItem = async (req, res, next) => {
  const { id } = req.params;
  const expand = req.query.expand || "";

  try {
    const article = await articleServices.findSingleItem({ id, expand });
    res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data: article,
      links: {
        self: `/articles/${article._id}`,
        author: `/articles/${article._id}/author`,
        comments: `/articles/${article._id}/comments`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = findSingleItem;
