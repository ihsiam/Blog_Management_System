const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const updateItemPatch = async (req, res, next) => {
  try {
    const { id } = req.params;
    const errors = [];

    // id validation
    if (!id || typeof id !== "string") {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

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
