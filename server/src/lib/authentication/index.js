const { userExist, createUser } = require("../user");
const { badRequest } = require("../../utils/error");
const { hashing } = require("../../utils");

const register = async ({ name, email, password }) => {
  const hasUser = await userExist(email);

  if (hasUser) {
    throw badRequest("User exist");
  }

  const hashPassword = await hashing.generateHash(password);

  const user = await createUser({ name, email, password: hashPassword });
  return user;
};

const login = () => {};

module.exports = { login, register };
