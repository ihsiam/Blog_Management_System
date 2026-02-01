const authServices = require("../../../../lib/authentication");
const { generateToken } = require("../../../../lib/token");

const register = async (req, res, next) => {
  const { name, email, password } = req.body;
  try {
    const user = await authServices.register({ name, email, password });

    const payload = {
      id: user._id,
      role: user.role,
      email: user.email,
    };

    const token = generateToken(payload);

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
