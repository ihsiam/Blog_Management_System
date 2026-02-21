const articleServices = require("../../../../lib/articles");
const { badRequest } = require("../../../../utils/error");

const deleteItem = async (req, res, next) => {
  try {
    // extract article id
    const { id } = req.params;

    // Validate id
    if (!id || typeof id !== "string") {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    // delete article
    await articleServices.deleteItem(id);

    // response
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

module.exports = deleteItem;
