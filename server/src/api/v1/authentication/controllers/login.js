const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");

const login = async (req, res, next) => {
  try {
    // extract login data from request body
    const { email, password } = req.body;

    // 400 error data
    const errors = [];

    // email validation
    if (!email || typeof email !== "string") {
      errors.push({ field: "email", message: "invalid input", in: "body" });
    } else {
      // email format validation
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

      if (!emailOk)
        errors.push({ field: "email", message: "invalid input", in: "body" });
    }

    // password validation
    if (!password || typeof password !== "string") {
      errors.push({ field: "password", message: "invalid input", in: "body" });
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // generate token
    const token = await authServices.login({ email, password });

    // response
    const response = {
      code: 201,
      message: "Login successful",
      data: {
        access_token: token,
      },
      links: {
        self: "/api/v1/auth/signin",
      },
    };
    res.status(201).json(response);
  } catch (e) {
    next(e);
  }
};

module.exports = login;
