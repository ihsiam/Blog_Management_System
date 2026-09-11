/**
 * Shared helpers for Auth integration tests.
 *
 * Creates users directly via the real User model + hashing utilities so
 * suites can set up approved/pending/blocked states without going through
 * every HTTP step when that step is not under test.
 */

const jwt = require("jsonwebtoken");
const User = require("../../../src/model/User");
const { hashing } = require("../../../src/utils");
const tokenServices = require("../../../src/lib/token");

/**
 * Persist a user with a bcrypt-hashed password.
 *
 * @param {Object} overrides
 * @returns {Promise<Object>} Plain user object (toObject shape)
 */
const seedUser = async ({
  name = "Test User",
  email,
  password = "password123",
  role = "user",
  status = "approved",
  refreshToken = null,
} = {}) => {
  if (!email) {
    throw new Error("seedUser requires an email");
  }

  const hashPassword = await hashing.generateHash(password);
  const user = await User.create({
    name,
    email,
    password: hashPassword,
    role,
    status,
    refreshToken,
  });

  return user.toObject();
};

/**
 * Issue a real access/refresh pair and store the refresh token on the user.
 *
 * @param {Object} user - Seeded user (needs id, role, email)
 * @returns {Promise<{accessToken: string, refreshToken: string}>}
 */
const issueSession = async (user) => {
  const payload = {
    id: user.id,
    role: user.role,
    email: user.email,
  };

  const accessToken = tokenServices.generateAccessToken(payload);
  const refreshToken = tokenServices.generateRefreshToken(payload);

  await User.findByIdAndUpdate(user.id, { $set: { refreshToken } });

  return { accessToken, refreshToken };
};

/**
 * Extract the activation/reset JWT from a mocked sendMail call payload.
 *
 * @param {Object} mailArg - First argument passed to emailService.sendMail
 * @returns {string} JWT token
 */
const extractTokenFromMail = (mailArg) => {
  const match = mailArg?.text?.match(
    /\/([A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+)/,
  );
  if (!match) {
    throw new Error("No JWT found in email text");
  }
  return match[1];
};

/**
 * Build a cookie header value for the refreshToken cookie.
 *
 * @param {string} refreshToken
 * @returns {string}
 */
const refreshCookie = (refreshToken) => `refreshToken=${refreshToken}`;

/**
 * Read the refreshToken value from a Set-Cookie header array.
 *
 * @param {string[]|undefined} setCookie
 * @returns {string|null}
 */
const parseRefreshCookie = (setCookie) => {
  if (!setCookie || !setCookie.length) return null;
  const entry = setCookie.find((c) => c.startsWith("refreshToken="));
  if (!entry) return null;
  return entry.split(";")[0].split("=").slice(1).join("=");
};

/**
 * Sign an already-expired active/reset token (for expiry edge cases).
 *
 * @param {Object} payload
 * @returns {string}
 */
const expiredActiveResetToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACTIVE_RESET_SECRET, {
    algorithm: "HS256",
    expiresIn: "-1s",
  });

/**
 * Sign an already-expired access token.
 *
 * @param {Object} payload
 * @returns {string}
 */
const expiredAccessToken = (payload) =>
  jwt.sign(payload, process.env.JWT_ACCESS_SECRET, {
    algorithm: "HS256",
    expiresIn: "-1s",
  });

/**
 * Sign an already-expired refresh token.
 *
 * @param {Object} payload
 * @returns {string}
 */
const expiredRefreshToken = (payload) =>
  jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    algorithm: "HS256",
    expiresIn: "-1s",
  });

module.exports = {
  seedUser,
  issueSession,
  extractTokenFromMail,
  refreshCookie,
  parseRefreshCookie,
  expiredActiveResetToken,
  expiredAccessToken,
  expiredRefreshToken,
};
