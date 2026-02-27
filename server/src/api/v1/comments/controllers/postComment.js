const defaults = require("../../../../config/defaults");
const { badRequest } = require("../../../../utils/error");
const commentArticleServices = require("../../../../lib/commentArticle");

const postComment = async (req, res, next) => {
  try {
    // extract data from request
    const { body, articleID } = req.body;
    const status = req.body.status || defaults.commentStatus;
    const author = req.user.id;

    // 400 error
    const errors = [];

    // if body not found
    if (!body || typeof body !== "string" || !body.trim()) {
      errors.push({ field: "body", message: "invalid input", in: "body" });
    }

    // if articleID not found
    if (!articleID || typeof articleID !== "string" || !articleID.trim()) {
      errors.push({ field: "articleId", message: "invalid input", in: "body" });
    }

    // throw err
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // create comment
    const comment = await commentArticleServices.createComment({
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
        self: `/api/v1/comments/${comment.id}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = postComment;
