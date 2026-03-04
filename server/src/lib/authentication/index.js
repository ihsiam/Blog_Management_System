const userServices = require("../user");
const { badRequest, unauthorized, forbidden } = require("../../utils/error");
const { hashing } = require("../../utils");
const tokenServices = require("../token");

// user register
const register = async ({ name, email, password }) => {
  // existing user check
  const hasUser = await userServices.userExist(email);

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
  const user = await userServices.createUser({
    name,
    email,
    password: hashPassword,
  });

  return user;
};

// system admin initialize
const systemAdmin = async ({ name, email, password }) => {
  // existing admin check
  const isAdminExist = await userServices.adminExist();

  // if exist
  if (isAdminExist) {
    throw forbidden("System admin already exist");
  }

  // existing email check
  const hasUser = await userServices.userExist(email);

  // if user exist with email
  if (hasUser) {
    throw badRequest(
      [{ field: "email", message: "User already exists", in: "body" }],
      "Validation error",
    );
  }

  // password hash
  const hashPassword = await hashing.generateHash(password);

  // create admin
  const user = await userServices.createAdmin({
    name,
    email,
    password: hashPassword,
  });

  return user;
};

// login route
const login = async ({ email, password }) => {
  // find user with email
  const user = await userServices.findUserByEmail(email);

  // if not found
  if (!user) {
    throw unauthorized("Invalid credentials");
  }

  // match password
  const isMatched = await hashing.compareHash(password, user.password);

  // if password is not matched
  if (!isMatched) {
    throw unauthorized("Invalid credentials");
  }

  // check account status
  if (user.status !== "approved") {
    throw forbidden("Your account is not active");
  }

  // token payload
  const payload = { id: user.id, role: user.role, email: user.email };

  // generate token
  const accessToken = tokenServices.generateAccessToken(payload);
  const refreshToken = tokenServices.generateRefreshToken(payload);

  // save token to db
  await userServices.saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
};

const refreshToken = async (token) => {
  // verify token
  const decoded = tokenServices.verifyRefreshToken(token);

  // find user
  const user = userServices.findUserById(decoded.id);

  // if user not found
  if (!user) {
    throw unauthorized("Invalid refresh token");
  }

  // check account status
  if (user.status !== "approved") {
    throw forbidden("Your account is not active");
  }

  // match token
  if (user.refreshToken !== token) {
    // clear refresh token
    await userServices.saveRefreshToken(user.id, null);
    throw unauthorized("Refresh token is invalid or revoked");
  }

  // issue new token
  const payload = { id: user.id, role: user.role, email: user.email };
  const newAccessToken = tokenServices.generateAccessToken(payload);
  const newRefreshToken = tokenServices.generateRefreshToken(payload);

  // update into db
  await userServices.saveRefreshToken(user.id, newAccessToken);

  return { newAccessToken, newRefreshToken };
};

module.exports = {
  register,
  systemAdmin,
  login,
  refreshToken,
};
