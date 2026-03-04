const authServices = require("../../../../lib/authentication");
const tokenServices = require("../../../../lib/token");
const { badRequest } = require("../../../../utils/error");
const userServices = require("../../../../lib/user");

const register = async (req, res, next) => {
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
    const user = await authServices.register({ name, email, password });

    // token payload
    const payload = {
      id: user.id,
      role: user.role,
      email: user.email,
    };

    // generate token
    const accessToken = tokenServices.generateAccessToken(payload);
    const refreshToken = tokenServices.generateRefreshToken(payload);

    // save refresh token into db
    await userServices.saveRefreshToken(user.id, refreshToken);

    // response
    const response = {
      code: 201,
      message: "Account created",
      data: {
        access_token: accessToken,
      },
      links: {
        self: "/api/v1/auth/signUp",
        signin: "/api/v1/auth/signin",
      },
    };

    // set refresh token to cookie
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
    });

    // send json response
    res.status(201).json(response);
  } catch (e) {
    next(e);
  }
};

module.exports = register;
