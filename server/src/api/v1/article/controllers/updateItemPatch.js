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

    // If admin overriding ownership (editing someone else's article), only allow status change
    if (req.adminOverride) {
      if (
        status === undefined ||
        typeof status !== "string" ||
        !status.trim()
      ) {
        throw badRequest(
          [{ field: "status", message: "invalid input", in: "body" }],
          "invalid input",
        );
      }

      const article = await articleServices.updateItemPatch(id, { status });

      return res.status(200).json({
        code: 200,
        message: "successfully updated article status",
        data: article,
        links: { self: `/api/v1/articles/${article.id}` },
      });
    }

    // build update payload
    const updateData = {
      title,
      body,
      cover,
    };

    // only admin can update status
    if (req.user.role === "admin") {
      updateData.status = status;
    }

    // update article
    const article = await articleServices.updateItemPatch(id, updateData);

    // response
    return res.status(200).json({
      code: 200,
      message: "successfully updated article data",
      data: article,
      links: {
        self: `/api/v1/articles/${article.id}`,
      },
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = updateItemPatch;
