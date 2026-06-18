const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const commentServices = require("../../../../lib/comments");

/**
 * Updates an existing comment.
 *
 * - If `req.adminOverride` is true → only comment status can be updated
 * - If normal user → can update comment body (and admin may optionally update status)
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - Comment ID
 *
 * @param {Object} req.body - Request payload
 * @param {string} [req.body.body] - Comment text content
 * @param {string} [req.body.status] - Comment status (public | hidden)
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Returns updated comment response
 */
const updateComment = async (req, res, next) => {
  try {
    // extract data
    const { id } = req.params;
    const { body, status } = req.body;

    // collect validation errors
    const errors = [];

    // id validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({
        field: "id",
        message: "invalid input",
        in: "params",
      });
    }

    /**
     * Admin override flow:
     * Only status update is allowed
     */
    if (req.adminOverride) {
      // validate status strictly for admin override
      if (
        status === undefined ||
        typeof status !== "string" ||
        !["public", "hidden"].includes(status)
      ) {
        errors.push({ field: "status", message: "invalid input", in: "body" });
      }

      if (errors.length) {
        throw badRequest(errors, "invalid input");
      }

      // update only status
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

    /**
     * Validate comment body
     */
    if (body !== undefined) {
      if (typeof body !== "string" || !body.trim()) {
        errors.push({
          field: "body",
          message: "invalid input",
          in: "body",
        });
      }
    }

    /**
     * Validate status only if user is admin and status is provided
     */
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

    // throw validation errors if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // build update payload
    const updateData = {
      id,
      body,
    };

    /**
     * Only admin can update status in normal flow
     */
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
  } catch (err) {
    return next(err);
  }
};

module.exports = updateComment;
