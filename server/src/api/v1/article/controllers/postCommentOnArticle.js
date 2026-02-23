const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");

const postCommentOnArticle = async (req, res, next) => {
  try {
    // extract params from request
    const articleID = req.params.id;
    const author = req.user.id;

    // extract comment data
    const { body } = req.body;
    const status = req.body.status || defaults.commentStatus;

    // throw error if comment body not found
    if (!body || typeof body !== "string" || !body.trim()) {
      throw badRequest(
        [{ field: "body", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }

    // create comment
    const comment = await commentServices.create({
      articleID,
      body,
      status,
      author,
    });

    // response
    res.status(201).json({
      code: 201,
      message: "comment posted",
      data: comment,
      links: {
        self: `/api/v1/articles/${articleID}/comments`,
        article: `/api/v1/articles/${articleID}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = postCommentOnArticle;
