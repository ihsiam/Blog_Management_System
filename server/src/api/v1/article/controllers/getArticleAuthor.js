const serviceRegistry = require("../../../../lib/service registry");

const getArticleAuthor = async (req, res, next) => {
  try {
    // extract article id
    const articleID = req.params.id;

    // get user
    const user = await serviceRegistry.getArticleAuthor(articleID);

    // transform data
    const data = { id: user.id, name: user.name, email: user.email };

    // response
    res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data,
      links: {
        self: `/api/v1/articles/${articleID}/author`,
        article: `/api/v1/articles/${articleID}`,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = getArticleAuthor;
