const userServices = require("../user");
const { badRequest, unauthorized, forbidden } = require("../../utils/error");
const { hashing } = require("../../utils");
const tokenServices = require("../token");

/**
 * Creates a new user account.
 *
 * @param {Object} params
 * @param {string} params.name - User full name
 * @param {string} params.email - Unique user email
 * @param {string} params.password - Plain text password
 *
 * @returns {Promise<Object>} Created user record
 */
const register = async ({ name, email, password }) => {
  // Ensure email uniqueness
  const hasUser = await userServices.userExist(email);

  if (hasUser) {
    throw badRequest(
      [{ field: "email", message: "User already exists", in: "body" }],
      "Validation error",
    );
  }

  // Hash password
  const hashPassword = await hashing.generateHash(password);

  return await userServices.createUser({
    name,
    email,
    password: hashPassword,
  });
};

/**
 * Creates the first system administrator account.
 *
 * Intended to run only once during system initialization.
 *
 * @param {Object} params
 * @param {string} params.name User full name
 * @param {string} params.email Unique user email
 * @param {string} params.password Plain text password
 *
 * @throws {Error} If admin already exists or email is taken
 */
const systemAdmin = async ({ name, email, password }) => {
  // checks if there is already an admin.
  const isAdminExist = await userServices.adminExist();

  if (isAdminExist) {
    throw forbidden("System admin already exists");
  }

  // Ensure email uniqueness
  const hasUser = await userServices.userExist(email);

  if (hasUser) {
    throw badRequest(
      [{ field: "email", message: "User already exists", in: "body" }],
      "Validation error",
    );
  }

  // Hash password
  const hashPassword = await hashing.generateHash(password);

  return await userServices.createAdmin({
    name,
    email,
    password: hashPassword,
  });
};

/**
 * Authenticates a user and issues JWT token pair.
 *
 * Account must be approved before login is allowed
 *
 * @param {Object} params
 * @param {string} params.email Unique user email
 * @param {string} params.password Plain text password
 *
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
const login = async ({ email, password }) => {
  // Fetch user by email
  const user = await userServices.findUserByEmail(email);

  /**
   * Prevent account enumeration attacks:
   * Same response for "user not found" and "wrong password"
   */
  if (!user) {
    throw unauthorized("Invalid credentials");
  }

  // Validate password
  const isMatched = await hashing.compareHash(password, user.password);

  if (!isMatched) {
    throw unauthorized("Invalid credentials");
  }

  // Only approved users can login
  if (user.status !== "approved") {
    throw forbidden("Account is not active");
  }

  // JWT payload
  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  const accessToken = tokenServices.generateAccessToken(payload);
  const refreshToken = tokenServices.generateRefreshToken(payload);

  // Stores refresh token into DB.
  await userServices.saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
};

/**
 * Rotates refresh token and issues new access tokens.
 *
 * Validates against stored DB token
 *
 * Rotates refresh token on every request
 *
 * @param {string} token - Refresh token from client
 *
 * @returns {Promise<{newAccessToken: string, newRefreshToken: string}>}
 */
const refreshToken = async (token) => {
  // Verify token
  const decoded = tokenServices.verifyRefreshToken(token);

  // Ensure user still exists
  const user = await userServices.findUserById(decoded.id);

  if (!user) {
    throw unauthorized("Invalid refresh token");
  }

  // Only approved users can refresh session
  if (user.status !== "approved") {
    throw forbidden("Account is not active");
  }

  // Ensures refresh token is still the latest issued token.
  if (user.refreshToken !== token) {
    // invalidate session if token is mismatched
    await userServices.saveRefreshToken(user.id, null);

    throw unauthorized("Refresh token is invalid or revoked");
  }

  // JWT payload
  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  // Rotate tokens
  const newAccessToken = tokenServices.generateAccessToken(payload);
  const newRefreshToken = tokenServices.generateRefreshToken(payload);

  // Update new refresh token into DB
  await userServices.saveRefreshToken(user.id, newRefreshToken);

  return { newAccessToken, newRefreshToken };
};

module.exports = {
  register,
  systemAdmin,
  login,
  refreshToken,
};
