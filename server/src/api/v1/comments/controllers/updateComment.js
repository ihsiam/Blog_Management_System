const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");
const { mapComment } = require("../../../../utils/mappers");

/**
 * Update the body of an existing comment.
 *
 * @param {import("express").Request} req - Express request object.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - Comment ID.
 * @param {Object} req.body - Request payload.
 * @param {string} req.body.body - Comment text.
 * @param {import("express").Response} res - Express response object.
 * @param {import("express").NextFunction} next - Next middleware function.
 * @returns {Promise<import("express").Response|void>} The Express response after sending the 200 reply, or undefined when an error is forwarded to `next`.
 */
const updateComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { body } = req.body;
    const errors = [];

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({
        field: "id",
        message: "invalid input",
        in: "params",
      });
    }

    if (body === undefined || typeof body !== "string" || !body.trim()) {
      errors.push({
        field: "body",
        message: "invalid input",
        in: "body",
      });
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    const comment = await commentServices.updateComment({
      id,
      body,
    });

    return res.status(200).json({
      code: 200,
      message: "Comment updated",
      data: mapComment(comment),
      links: {
        self: `/api/v1/comments/${comment.id}`,
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = updateComment;
