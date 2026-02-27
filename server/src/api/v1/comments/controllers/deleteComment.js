const { badRequest } = require("../../../../utils/error");
const commentService = require("../../../../lib/comments");

const deleteComment = async (req, res, next) => {
  try {
    // extract id
    const { id } = req.params;

    // if not found
    if (!id || typeof id !== "string" || !id.trim()) {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    // delete comment
    await commentService.deleteItem(id);

    // response
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

module.exports = deleteComment;
