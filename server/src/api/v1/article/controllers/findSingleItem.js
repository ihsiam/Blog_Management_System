const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const findSingleItem = async (req, res, next) => {
  try {
    const { id } = req.params;
    const expand = req.query.expand || "";

    const errors = [];

    // validate id
    if (!id || typeof id !== "string") {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

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
