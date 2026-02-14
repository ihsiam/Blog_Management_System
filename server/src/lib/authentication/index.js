const { userExist, createUser, findUserByEmail } = require("../user");
const { badRequest, unauthorized } = require("../../utils/error");
const { hashing } = require("../../utils");
const { generateToken } = require("../token");

// user register
const register = async ({ name, email, password }) => {
  // existing user check
  const hasUser = await userExist(email);

  // if user exist with email
  if (hasUser) {
    throw badRequest(
      [{ field: "email", message: "User already exists", in: "body" }],
      "Validation error",
    );
  }

  // password hash
  const hashPassword = await hashing.generateHash(password);

  // create user
  const user = await createUser({
    name,
    email,
    password: hashPassword,
  });

  return user;
};

const login = async ({ email, password }) => {
  // find user with email
  const user = await findUserByEmail(email);

  if (!user) {
    throw unauthorized("Invalid credentials");
  }

  // match password
  const isMatched = await hashing.compareHash(password, user.password);

  if (!isMatched) {
    throw unauthorized("Invalid credentials");
  }

  // check account status
  if (user.status !== "approved") {
    throw unauthorized("Your account is not active");
  }

  // generate token
  const token = generateToken({
    id: user._id,
    role: user.role,
    email: user.email,
  });

  return token;
};

module.exports = {
  register,
  login,
};
