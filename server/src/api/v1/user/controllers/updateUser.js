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
 * Updates user profile or account details.
 *
 * @param {import("express").Request} req - Express request object
 *
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.id - User ID to update
 *
 * @param {Object} req.body - Request payload
 * @param {string} [req.body.name] - User full name
 * @param {string} [req.body.role] - User role (user | admin)
 * @param {string} [req.body.status] - User status (pending | active | blocked)
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error handler middleware
 *
 * @returns {Promise<void>} Sends updated user data response
 */
const updateUser = async (req, res, next) => {
  try {
    // extract data
    const { id } = req.params;
    const { name, role, status } = req.body;

    // 400 error data
    const errors = [];

    // id validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // name validation
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      errors.push({ field: "name", message: "invalid input", in: "body" });
    }

    // role validation
    if (role !== undefined) {
      if (
        typeof role !== "string" ||
        !role.trim() ||
        !Object.values(ROLES).includes(role)
      ) {
        errors.push({ field: "role", message: "invalid input", in: "body" });
      }
    }

    // status validation
    if (status !== undefined) {
      if (
        typeof status !== "string" ||
        !status.trim() ||
        !Object.values(ACCOUNT_STATUS).includes(status)
      ) {
        errors.push({ field: "status", message: "invalid input", in: "body" });
      }
    }

    // throw error if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // an admin cannot block or demote their own account
    if (
      new mongoose.Types.ObjectId(id).toString() === req.user.id &&
      ((role !== undefined && role !== ROLES.ADMIN) ||
        status === ACCOUNT_STATUS.BLOCKED)
    ) {
      throw conflict("You cannot block or demote your own account");
    }

    // update user
    const data = await userServices.updateUser({
      id,
      name,
      role,
      status,
      ...(status !== undefined && {
        statusTransition: STATUS_TRANSITION.ADMIN,
      }),
    });

    // response
    return res.status(200).json({
      code: 200,
      message: "Account updated",
      data: mapUser(data),
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = updateUser;
