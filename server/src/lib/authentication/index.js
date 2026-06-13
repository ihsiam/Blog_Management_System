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
 *
 * @throws {Error} BadRequest if email already exists
 */
const register = async ({ name, email, password }) => {
  // Check email uniqueness
  const hasUser = await userServices.userExist(email);

  if (hasUser) {
    throw badRequest(
      [{ field: "email", message: "User already exists", in: "body" }],
      "Validation error",
    );
  }

  // Hash password before persistence
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
 * This is a one-time bootstrap operation.
 * It should be disabled or protected after initial setup.
 *
 * @param {Object} params
 * @param {string} params.name - Admin full name
 * @param {string} params.email - Unique admin email
 * @param {string} params.password - Plain text password
 *
 * @returns {Promise<Object>} Created admin user
 *
 * @throws {Error} Forbidden if admin already exists
 * @throws {Error} BadRequest if email is already taken
 */
const systemAdmin = async ({ name, email, password }) => {
  // Check if system admin already exists
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

  // Secure password hashing
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
 * @param {string} params.email - User email
 * @param {string} params.password - Plain text password
 *
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 *
 * @throws {Error} Unauthorized if credentials are invalid
 * @throws {Error} Forbidden if account is not active
 */
const login = async ({ email, password }) => {
  // Fetch user by email
  const user = await userServices.findUserByEmail(email);

  /**
   * Prevent user enumeration:
   * Same error for invalid email and password
   */
  if (!user) {
    throw unauthorized("Invalid credentials");
  }

  // Validate password
  const isMatched = await hashing.compareHash(password, user.password);

  if (!isMatched) {
    throw unauthorized("Invalid credentials");
  }

  if (user.status !== "approved") {
    throw forbidden("Account is not active");
  }

  // JWT payload
  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  // generates auth token pairs

  const accessToken = tokenServices.generateAccessToken(payload);
  const refreshToken = tokenServices.generateRefreshToken(payload);

  // Stores refresh token into DB.
  await userServices.saveRefreshToken(user.id, refreshToken);

  return { accessToken, refreshToken };
};

/**
 * Rotates refresh token and issues new JWT pair.
 *
 * @param {string} token - Refresh token from client
 *
 * @returns {Promise<{newAccessToken: string, newRefreshToken: string}>}
 *
 * @throws {Error} Unauthorized if token is invalid or revoked
 * @throws {Error} Forbidden if account is inactive
 */
const refreshToken = async (token) => {
  // Verify token
  const decoded = tokenServices.verifyRefreshToken(token);

  // Ensure user still exists
  const user = await userServices.findAuthUserById(decoded.id);

  if (!user) {
    throw unauthorized("Invalid refresh token");
  }

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
