const authServices = require("../../../../lib/authentication");
const { generateToken } = require("../../../../lib/token");
const { badRequest } = require("../../../../utils/error");

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

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
    }

    // throw error
    if (errors.length) {
      throw badRequest(errors, "invalid input");
    }

    // create user
    const user = await authServices.register({ name, email, password });

    // token payload
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    // generate token
    const token = generateToken(payload);

    // response
    const response = {
      code: 201,
      message: "Account created",
      data: {
        access_token: token,
      },
      links: {
        self: "/api/v1/auth/signUp",
        signin: "/api/v1/auth/signin",
      },
    };
    res.status(201).json(response);
  } catch (e) {
    next(e);
  }
};

module.exports = register;
