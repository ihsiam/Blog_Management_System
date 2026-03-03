const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");

const createUser = async (req, res, next) => {
  try {
    // extract register data from request body
    const { name, email, password } = req.body;

    // 400 error data
    const errors = [];

    // name validate
    if (!name || typeof name !== "string" || !name.trim()) {
      errors.push({ field: "name", message: "invalid input", in: "body" });
    }

    // email validate
    if (!email) {
      errors.push({ field: "email", message: "invalid input", in: "body" });
    } else {
      // email format validation
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

      if (!emailOk) {
        errors.push({ field: "email", message: "invalid input", in: "body" });
      }
    }

    // password validate
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

    // create user
    const data = await userServices.createUserByAdmin({
      name,
      email,
      password,
    });

    // response
    res.status(201).json({
      code: 201,
      message: "Account created",
      data,
    });
  } catch (e) {
    next(e);
  }
};

module.exports = createUser;
