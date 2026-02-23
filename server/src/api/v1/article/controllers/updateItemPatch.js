const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const updateItemPatch = async (req, res, next) => {
  try {
    // extract article id
    const { id } = req.params;

    // extract update data from request body
    const { title, body, cover, status } = req.body;

    // 400 error data
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

    // update article
    const article = await articleServices.updateItemPatch(id, {
      title,
      body,
      cover,
      status,
    });

    // response
    res.status(200).json({
      code: 200,
      message: "successfully updated article data",
      data: article,
      links: {
        self: `/api/v1/articles/${article.id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = updateItemPatch;
