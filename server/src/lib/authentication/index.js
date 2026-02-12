const { userExist, createUser, findUserByEmail } = require("../user");
const { badRequest, unauthorized } = require("../../utils/error");
const { hashing } = require("../../utils");
const { generateToken } = require("../token");

// user register
const register = async ({ name, email, password }) => {
  const errors = [];

  if (!name) {
    errors.push({ field: "name", message: "Name is required", in: "body" });
  }
  if (!email) {
    errors.push({ field: "email", message: "Email is required", in: "body" });
  }
  if (!password) {
    errors.push({
      field: "password",
      message: "Password is required",
      in: "body",
    });
  }

  if (errors.length) {
    throw badRequest(errors, "Validation error");
  }

  // existing user check
  const hasUser = await userExist(email);
  if (hasUser) {
    throw badRequest(null, "Invalid credentials");
  }

  // password hash
  const hashPassword = await hashing.generateHash(password);

  const user = await createUser({
    name,
    email,
    password: hashPassword,
  });

  return user;
};

const login = async ({ email, password }) => {
  const errors = [];

  if (!email) {
    errors.push({ field: "email", message: "Email is required", in: "body" });
  }
  if (!password) {
    errors.push({
      field: "password",
      message: "Password is required",
      in: "body",
    });
  }

  if (errors.length) {
    throw badRequest(errors, "Validation error");
  }

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
