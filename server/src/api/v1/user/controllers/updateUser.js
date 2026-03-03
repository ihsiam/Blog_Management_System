const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");

const updateUser = async (req, res, next) => {
  try {
    // extract data
    const { id } = req.params;
    const { name, role, status } = req.body;

    // 400 error data
    const errors = [];

    // id validation
    if (!id || typeof id !== "string") {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // name validation
    if (name !== undefined && (typeof name !== "string" || !name.trim())) {
      errors.push({ field: "name", message: "invalid input", in: "body" });
    }

    // role validation
    if (
      role !== undefined &&
      ["user", "admin"].includes(role) &&
      (typeof role !== "string" || !role.trim())
    ) {
      errors.push({ field: "role", message: "invalid input", in: "body" });
    }

    // title validation
    if (
      status !== undefined &&
      ["pending", "approved", "block", "declined"].includes(status) &&
      (typeof status !== "string" || !status.trim())
    ) {
      errors.push({ field: "status", message: "invalid input", in: "body" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // update user
    const data = await userServices.updateUser({ id, name, role, status });

    // response
    res.status(200).json({
      code: 200,
      message: "Account updated",
      data,
    });
  } catch (e) {
    next(e);
  }
};

module.exports = updateUser;
