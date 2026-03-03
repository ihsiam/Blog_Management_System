const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");

const getSingleUser = async (req, res, next) => {
  try {
    // extract data
    const { id } = req.params;
    const { expand } = req.query;

    // 400 error data
    const errors = [];

    // validate id
    if (!id || typeof id !== "string") {
      errors.push({ field: "id", message: "invalid input", in: "params" });
    }

    // expand validation
    if (typeof expand !== "string") {
      errors.push({ field: "expand", message: "invalid input", in: "query" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // get user data
    const data = await userServices.getSingleUser({ id, expand });

    // response
    res.status(200).json({
      code: 200,
      message: "Data retrieved",
      data,
    });
  } catch (e) {
    next(e);
  }
};

module.exports = getSingleUser;
