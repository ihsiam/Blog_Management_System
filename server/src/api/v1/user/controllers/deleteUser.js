const mongoose = require("mongoose");
const { badRequest } = require("../../../../utils/error");
const serviceRegistry = require("../../../../lib/service registry");

/**
 * Deletes a user and all related credentials from the system.
 *
 * @param {import("express").Request} req
 * @param {Object} req.params
 * @param {string} req.params.id - User ID to delete
 *
 * @param {import("express").Response} res
 * @param {Function} next
 *
 * @returns {Promise<void>}
 */
const deleteUser = async (req, res, next) => {
  try {
    // extract user id from request params
    const { id } = req.params;

    // id validation
    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    // delete user and related credentials
    await serviceRegistry.deleteUser(id);

    // response (no content)
    return res.status(204).end();
  } catch (e) {
    return next(e);
  }
};

module.exports = deleteUser;
