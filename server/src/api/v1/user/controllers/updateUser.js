const mongoose = require("mongoose");
const { badRequest, conflict } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");
const {
  ROLES,
  ACCOUNT_STATUS,
  STATUS_TRANSITION,
} = require("../../../../config/constants");
const { mapUser } = require("../../../../utils/mappers");

/**
 * Update a user profile or account details.
 *
 * @param {import("express").Request} req - Express request.
 * @param {Object} req.params - Route parameters.
 * @param {string} req.params.id - User ID to update.
 * @param {Object} req.body - Request payload.
 * @param {string} [req.body.name] - User full name.
 * @param {string} [req.body.role] - User role (`user` or `admin`).
 * @param {string} [req.body.status] - Account status (`pending`, `active`, or `blocked`).
 * @param {Object} req.user - Authenticated user, set by an earlier middleware.
 * @param {string} req.user.id - Authenticated user ID.
 * @param {import("express").Response} res - Express response.
 * @param {import("express").NextFunction} next - Next middleware.
 * @returns {Promise<void>} Resolves after the response is sent or `next` has been called.
 * @throws {Error} When the input is invalid.
 * @throws {Error} When the authenticated user would block or demote their own account.
 */
const updateUser = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, role, status } = req.body;

    // Collect every validation error so the client can fix them in one request.
    const errors = [];

    // Reject malformed IDs before they reach the database query.
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      errors.push({ field: "name", message: "invalid input", in: "body" });
    }

    if (role !== undefined) {
      if (
        typeof role !== "string" ||
        !role.trim() ||
        !Object.values(ROLES).includes(role)
      ) {
        errors.push({ field: "role", message: "invalid input", in: "body" });
      }
    }

    if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !status.trim() ||
        !Object.values(ACCOUNT_STATUS).includes(status)
      ) {
        errors.push({ field: "status", message: "invalid input", in: "body" });
      }
    }

    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // An admin cannot block or demote their own account.
    if (
      new mongoose.Types.ObjectId(id).toString() === req.user.id &&
      ((role !== undefined && role !== ROLES.ADMIN) ||
        status === ACCOUNT_STATUS.BLOCKED)
    ) {
      throw conflict("You cannot block or demote your own account");
    }

    // Record the status change as an admin action only when a status is sent.
    const data = await userServices.updateUser({
      id,
      name,
      role,
      status,
      ...(status !== undefined && {
        statusTransition: STATUS_TRANSITION.ADMIN,
      }),
    });

    return res.status(200).json({
      code: 200,
      message: "Account updated",
      data: mapUser(data),
    });
  } catch (e) {
    // Forward validation and service errors to the error handler.
    return next(e);
  }
};

module.exports = updateUser;
