const authServices = require("../../../../lib/authentication");
const { badRequest } = require("../../../../utils/error");

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const errors = [];

    // email validation
    if (!email || typeof email !== "string") {
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

    const token = await authServices.login({ email, password });
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
