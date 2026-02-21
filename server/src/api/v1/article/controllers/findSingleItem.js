const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const findSingleItem = async (req, res, next) => {
  try {
    // extract params from request
    const { id } = req.params;
    const expand = req.query.expand || "";

    // 400 error data
    const errors = [];

    // validate id
    if (!id || typeof id !== "string") {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // expand validation
    if (typeof expand !== "string") {
      errors.push({ field: "expand", message: "invalid input", in: "query" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // find single item
    const article = await articleServices.findSingleItem({ id, expand });

    // response
    res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data: article,
      links: {
        self: `/api/v1/articles/${article.id}`,
        author: `/api/v1/articles/${article.id}/author`,
        comments: `/api/v1/articles/${article.id}/comments`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = findSingleItem;
