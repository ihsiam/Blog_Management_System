const authServices = require("../../../../lib/authentication");

const login = async (req, res, next) => {
  const { email, password } = req.body;
  try {
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
