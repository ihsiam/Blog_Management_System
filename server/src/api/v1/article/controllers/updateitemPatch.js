const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const updateItemPatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, body, cover, status } = req.body;

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
        self: `/articles/${article._id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = updateItemPatch;
