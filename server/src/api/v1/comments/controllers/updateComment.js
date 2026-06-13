const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");

const updateComment = async (req, res, next) => {
  try {
    // extract data
    const { id } = req.params;
    const { body, status } = req.body;

    // admin overriding ownership: only status update allowed
    if (req.adminOverride) {
      if (
        status === undefined ||
        typeof status !== "string" ||
        !["public", "hidden"].includes(status)
      ) {
        throw badRequest(
          [{ field: "status", message: "invalid input", in: "body" }],
          "invalid input",
        );
      }

      const comment = await commentServices.updateComment({
        id,
        status,
      });

      return res.status(200).json({
        code: 200,
        message: "comment status updated",
        data: comment,
        links: {
          self: `/api/v1/comments/${comment.id}`,
        },
      });
    }

    // validation errors
    const errors = [];

    // body validation (required for non-adminOverride flow)
    if (!body || typeof body !== "string" || !body.trim()) {
      errors.push({
        field: "body",
        message: "invalid input",
        in: "body",
      });
    }

    // status validation ONLY if user is admin
    if (req.user.role === "admin" && status !== undefined) {
      if (
        typeof status !== "string" ||
        !["public", "hidden"].includes(status)
      ) {
        errors.push({
          field: "status",
          message: "invalid input",
          in: "body",
        });
      }
    }

    // throw errors if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // build update payload
    const updateData = {
      id,
      body,
    };

    // only admin can actually update status
    if (req.user.role === "admin" && status !== undefined) {
      updateData.status = status;
    }

    // update comment
    const comment = await commentServices.updateComment(updateData);

    return res.status(200).json({
      code: 200,
      message: "comment updated",
      data: comment,
      links: {
        self: `/api/v1/comments/${comment.id}`,
      },
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = updateComment;
