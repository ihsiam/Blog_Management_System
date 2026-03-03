const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");

const changePassword = async (req, res, next) => {
  try {
    // extract data
    const { id } = req.params;
    const { password } = req.body;

    // 400 error data
    const errors = [];

    // id validation
    if (!id || typeof id !== "string") {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // password validation
    if (!password || typeof password !== "string") {
      errors.push({ field: "password", message: "invalid input", in: "body" });
    } else if (password.length < 8) {
      errors.push({
        field: "password",
        message: "Password must be at least 8 character",
        in: "body",
      });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // update password
    const data = await userServices.updatePassword({ id, password });

    // response
    res.status(200).json({
      code: 200,
      message: "password updated",
      data,
    });
  } catch (e) {
    next(e);
  }
};

module.exports = changePassword;
