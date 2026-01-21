const services = require("../../../../lib/authentication");

const register = async (req, res, next) => {
  const { name, email, password } = req.body;
  try {
    const hash = await services.register({ name, email, password });
    res.status(201).json(hash);
  } catch (e) {
    next(e);
  }
};

module.exports = register;
