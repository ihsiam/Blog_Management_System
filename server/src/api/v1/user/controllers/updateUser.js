const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");

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
 * @param {string} [req.body.status] - User status (pending | approved | block | declined)
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
        !["user", "admin"].includes(role)
      ) {
        errors.push({ field: "role", message: "invalid input", in: "body" });
      }
    }

    // status validation
    if (status !== undefined) {
      const allowedStatus = ["pending", "approved", "block", "declined"];

      if (
        typeof status !== "string" ||
        !status.trim() ||
        !allowedStatus.includes(status)
      ) {
        errors.push({ field: "status", message: "invalid input", in: "body" });
      }
    }

    // throw error if any
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // update user
    const data = await userServices.updateUser({ id, name, role, status });

    // response
    return res.status(200).json({
      code: 200,
      message: "Account updated",
      data,
    });
  } catch (e) {
    return next(e);
  }
};

module.exports = updateUser;
