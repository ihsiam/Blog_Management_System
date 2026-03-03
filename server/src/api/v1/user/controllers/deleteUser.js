const { badRequest } = require("../../../../utils/error");
const serviceRegistry = require("../../../../lib/service registry");

const deleteUser = async (req, res, next) => {
  try {
    // extract article id
    const { id } = req.params;

    // Validate id
    if (!id || typeof id !== "string") {
      throw badRequest(
        [{ field: "id", message: "invalid input", in: "params" }],
        "invalid input",
      );
    }

    // delete user and it's credentials
    await serviceRegistry.deleteUser(id);

    // response
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

module.exports = deleteUser;
