const articleServices = require("../../../../lib/articles");
const { query } = require("../../../../utils");

const getArticleAuthor = async (req, res, next) => {
  try {
    // extract article id
    const articleID = req.params.id;

    // get user
    const user = await articleServices.getArticleAuthor(articleID);

    // transform data
    const data = query.transformData({
      items: [user],
      selection: ["id", "name", "email"],
    });

    // response
    res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data: data[0],
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
