const { userExist, createUser, findUserByEmail } = require("../user");
const { badRequest, authenticationError } = require("../../utils/error");
const { hashing } = require("../../utils");
const { generateToken } = require("../token");

const register = async ({ name, email, password }) => {
  const hasUser = await userExist(email);

  if (hasUser) {
    throw badRequest("User exist");
  }

  const hashPassword = await hashing.generateHash(password);

  const user = await createUser({ name, email, password: hashPassword });

  return user;
};

const login = async ({ email, password }) => {
  const user = await findUserByEmail(email);

  if (!user) {
    throw badRequest("Invalid credentials");
  }

  const isMatched = await hashing.compareHash(password, user.password);

  if (!isMatched) {
    throw badRequest("Invalid credentials");
  }

  if (user.status !== "approved") {
    throw authenticationError(`Your account status is ${user.status}`);
  }

  const payload = {
    id: user._id,
    role: user.role,
    email: user.email,
  };

  const token = generateToken(payload);

  return token;
};

module.exports = { login, register };
