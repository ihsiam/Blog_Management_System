const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");

const updateComment = async (req, res, next) => {
  try {
    // extract data
    const { id } = req.params;
    const { body } = req.body;

    // if no body exists
    if (!body || typeof body !== "string" || !body.trim()) {
      throw badRequest(
        [{ field: "body", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }

    // update comment
    const comment = await commentServices.updateComment({ id, body });

    // response
    res.status(200).json({
      code: 200,
      message: "comment updated",
      data: comment,
      links: {
        self: `/api/v1/comments/${comment.id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = updateComment;
