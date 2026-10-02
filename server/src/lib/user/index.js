const User = require("../../model/User");
const Session = require("../../model/Session");
const OTP = require("../../model/OTP");
const PasswordResetToken = require("../../model/PasswordResetToken");
const { badRequest, conflict, notFound } = require("../../utils/error");
const { hashing } = require("../../utils");
const defaults = require("../../config/defaults");
const { deleteCachePattern } = require("../../utils/cache");

/**
 * Find user by email
 *
 * @param {string} email - User email address
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object|null>} User object or null
 */
const findUserByEmail = async (email, session) => {
  const query = User.findOne({ email });
  if (session) query.session(session);

  const user = await query;
  return user ? user.toObject() : null;
};

/**
 * Find authenticated user by ID
 *
 * @param {string} id - User ID
 * @returns {Promise<Object|null>} Mongoose user document with password hash
 */
const findAuthUserById = async (id) => await User.findById(id);

/**
 * Find user by ID (safe output without sensitive fields)
 *
 * @param {string} id - User ID
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object|null>} Sanitized user object
 */
const findUserById = async (id, session) => {
  const query = User.findById(id).select("-password_hash");
  if (session) query.session(session);

  const user = await query;
  return user ? user.toObject() : null;
};

/**
 * Check if user exists by email
 *
 * @param {string} email - User email
 * @returns {Promise<boolean>}
 */
const userExist = async (email, session) => {
  const user = await findUserByEmail(email, session);
  return !!user;
};

/**
 * Check if any admin exists in system
 *
 * @returns {Promise<boolean>}
 */
const adminExist = async (session) => {
  const query = User.find({ role: "admin" });
  if (session) query.session(session);

  const admin = await query;
  return !!admin.length;
};

/**
 * Create admin user
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object>} Created admin user
 */
const createAdmin = async ({ name, email, password }, session) => {
  const user = new User({
    name,
    email,
    password_hash: password,
    role: "admin",
    account_status: "active",
  });

  await user.save({ session });
  return user.toObject();
};

/**
 * Create normal user
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<Object>} Created user
 */
const createUser = async ({ name, email, password }, session) => {
  const user = new User({ name, email, password_hash: password });

  await user.save({ session });
  return user.toObject();
};

/**
 * Create user by admin (auto-approval + hashing)
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<Object>} Created user (sanitized)
 */
const createUserByAdmin = async ({ name, email, password, role = "user" }) => {
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

  const user = new User({
    name,
    email,
    password_hash: hashPassword,
    role,
    account_status: "active",
  });

  await user.save();

  const userData = user.toObject();

  delete userData.password_hash;

  return userData;
};

/**
 * Save refresh token
 *
 * @param {string} id - User ID
 * @param {string} refreshToken - Raw refresh token
 * @param {string} [deviceInfo] - Client device information
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
 */
const saveRefreshToken = async (id, refreshToken, deviceInfo, session) => {
  const refreshTokenHash = await hashing.generateHash(refreshToken);

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const sessionData = new Session({
    user_id: id,
    refresh_token_hash: refreshTokenHash,
    device_info: deviceInfo || "unknown",
    expiresAt,
  });

  await sessionData.save({ session });
};

/**
 * Clear refresh token
 *
 * @param {string} id - User ID
 * @param {string} [refreshToken] - Raw refresh token to invalidate
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
 */
const clearRefreshToken = async (id, refreshToken, session) => {
  if (!refreshToken) {
    await Session.deleteMany(
      { user_id: id },
      session ? { session } : undefined,
    );
    return;
  }

  const query = Session.find({ user_id: id });
  if (session) query.session(session);
  const sessions = await query;

  const matches = await Promise.all(
    sessions.map((item) =>
      hashing.compareHash(refreshToken, item.refresh_token_hash),
    ),
  );
  const matchingSession = sessions[matches.indexOf(true)];

  if (matchingSession) {
    await Session.deleteOne(
      { _id: matchingSession._id },
      session ? { session } : undefined,
    );
  }
};

/**
 * Find a user's active session by raw refresh token.
 *
 * @param {string} id - User ID
 * @param {string} refreshToken - Raw refresh token
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object|null>} Matching session or null
 */
const findSessionByToken = async (id, refreshToken, session) => {
  if (!refreshToken) return null;

  const query = Session.find({ user_id: id });
  if (session) query.session(session);
  const sessions = await query;

  const matches = await Promise.all(
    sessions.map(
      async (item) =>
        item.expiresAt > new Date() &&
        hashing.compareHash(refreshToken, item.refresh_token_hash),
    ),
  );

  return sessions[matches.indexOf(true)] || null;
};

const getActiveSessions = async (id, refreshToken, session) => {
  const query = Session.find({
    user_id: id,
    expiresAt: { $gt: new Date() },
  }).sort({
    createdAt: -1,
  });
  if (session) query.session(session);

  const sessions = await query;
  const current = refreshToken
    ? await Promise.all(
        sessions.map((item) =>
          hashing.compareHash(refreshToken, item.refresh_token_hash),
        ),
      )
    : [];

  return sessions.map((item, index) => ({
    id: item.id,
    deviceInfo: item.device_info,
    isCurrent: current[index] || false,
    createdAt: item.createdAt,
    expiresAt: item.expiresAt,
  }));
};

const deleteSession = async (userId, sessionId, session) => {
  const query = Session.deleteOne({ _id: sessionId, user_id: userId });
  if (session) query.session(session);

  const result = await query;
  return result.deletedCount > 0;
};

const createOtp = async (userId, purpose, codeHash, session) => {
  await OTP.findOneAndUpdate(
    { user_id: userId, purpose },
    {
      $set: {
        code_hash: codeHash,
        is_used: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    },
    { upsert: true, new: true, session },
  );
};

const findValidOtp = async (userId, purpose, session) => {
  const query = OTP.findOne({
    user_id: userId,
    purpose,
    is_used: false,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (session) query.session(session);

  return query;
};

const markOtpUsed = async (id, session) => {
  const query = OTP.updateOne(
    { _id: id, is_used: false },
    { $set: { is_used: true } },
  );
  if (session) query.session(session);

  const result = await query;
  return result.modifiedCount > 0;
};

const savePasswordResetToken = async (userId, tokenHash, session) => {
  await PasswordResetToken.findOneAndUpdate(
    { user_id: userId },
    {
      $set: {
        token_hash: tokenHash,
        is_used: false,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      },
    },
    { upsert: true, new: true, session },
  );
};

const findPasswordResetToken = async (token, session) => {
  const query = PasswordResetToken.find({
    is_used: false,
    expiresAt: { $gt: new Date() },
  });
  if (session) query.session(session);

  const tokens = await query;
  const matches = await Promise.all(
    tokens.map((item) => hashing.compareHash(token, item.token_hash)),
  );

  return tokens[matches.indexOf(true)] || null;
};

const markPasswordResetTokenUsed = async (id, session) => {
  const query = PasswordResetToken.updateOne(
    { _id: id, is_used: false },
    { $set: { is_used: true } },
  );
  if (session) query.session(session);

  const result = await query;
  return result.modifiedCount > 0;
};

/**
 * Get all users with filters, pagination and sorting
 *
 * @param {Object} params
 * @param {number} params.page
 * @param {number} params.limit
 * @param {string} params.sortBy
 * @param {string} params.sortType
 * @param {string} [params.name]
 * @param {string} [params.email]
 * @param {string} [params.status]
 * @returns {Promise<Array<Object>>}
 */
const getAllUsers = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortBy = defaults.sortBy,
  sortType = defaults.sortType,
  name,
  email,
  status,
}) => {
  // sort key
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  // build filter
  const filter = {};

  if (email) filter.email = { $regex: email, $options: "i" };
  if (name) filter.name = { $regex: name, $options: "i" };
  if (status) filter.account_status = status;

  const users = await User.find(filter)
    .sort(sortKey)
    .skip(page * limit - limit)
    .limit(limit);

  return users.map((user) => user.toObject());
};

/**
 * Count users based on filters
 *
 * @param {Object} params
 * @param {string} [params.name]
 * @param {string} [params.email]
 * @param {string} [params.status]
 * @returns {Promise<number>}
 */
const countTotal = async ({ name, email, status }) => {
  const filter = {};

  if (email) filter.email = { $regex: email, $options: "i" };
  if (name) filter.name = { $regex: name, $options: "i" };
  if (status) filter.account_status = status;

  return await User.countDocuments(filter);
};

/**
 * Get single user with optional expansion
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} [params.expand]
 * @returns {Promise<Object>}
 */
const getSingleUser = async ({ id, expand = "" }) => {
  // extract expand
  const TrimmedExpand = expand
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const user = await User.findById(id).select("-password_hash");

  if (!user) {
    throw notFound();
  }

  // expand articles
  if (TrimmedExpand.includes("articles")) {
    await user.populate({ path: "articles", select: "title status -author" });
  }

  // expand comments
  if (TrimmedExpand.includes("comments")) {
    await user.populate({
      path: "comments",
      select: "body status article -author",
    });
  }

  return user.toObject();
};

/**
 * Update user data
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} [params.name]
 * @param {string} [params.role]
 * @param {string} [params.status]
 * @param {string} [params.statusTransition] - Transition context for status updates
 * @returns {Promise<Object>}
 */
const updateUser = async (
  { id, name, role, status, statusTransition },
  session,
) => {
  const payload = {};

  if (name !== undefined) payload.name = name;
  if (role !== undefined) payload.role = role;
  if (status !== undefined) payload.account_status = status;

  if (status !== undefined) {
    if (!statusTransition) {
      throw conflict("Account status transition is not allowed");
    }

    const currentQuery = User.findById(id);
    if (session) currentQuery.session(session);
    const currentUser = await currentQuery;

    if (!currentUser) throw notFound();

    const isEmailVerification =
      statusTransition === "emailVerification" &&
      currentUser.account_status === "pending" &&
      status === "active";
    const isAdminTransition =
      statusTransition === "admin" &&
      ((currentUser.account_status === "active" && status === "blocked") ||
        (currentUser.account_status === "blocked" && status === "active"));

    if (!isEmailVerification && !isAdminTransition) {
      throw conflict("Account status transition is not allowed");
    }

    const query = User.findOneAndUpdate(
      { _id: id, account_status: currentUser.account_status },
      { $set: payload },
      { new: true, runValidators: true, ...(session && { session }) },
    ).select("-password_hash");
    if (session) query.session(session);

    const user = await query;

    if (!user) {
      throw conflict("Account status transition is no longer valid");
    }

    if (name !== undefined) {
      await deleteCachePattern("article:list:*");
      await deleteCachePattern("article:*:author");
      await deleteCachePattern("article:*:expand:*");
      await deleteCachePattern("article:*:comments:*");
    }

    return user.toObject();
  }

  // find user and update data
  const query = User.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true, ...(session && { session }) },
  ).select("-password_hash");
  if (session) query.session(session);

  const user = await query;

  // if user not found
  if (!user) throw notFound();

  if (name !== undefined) {
    await deleteCachePattern("article:list:*");
    await deleteCachePattern("article:*:author");
    await deleteCachePattern("article:*:expand:*");
    await deleteCachePattern("article:*:comments:*");
  }

  return user.toObject();
};

/**
 * Update user password (hashed)
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.password
 * @returns {Promise<Object>}
 */
const updatePassword = async ({ id, password }, session) => {
  const payload = {};

  // password hash
  if (password !== undefined) {
    const hashPassword = await hashing.generateHash(password);
    payload.password_hash = hashPassword;
  }

  // update password
  const query = User.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true, ...(session && { session }) },
  ).select("-password_hash");
  if (session) query.session(session);

  const user = await query;

  if (!user) throw notFound();

  return user.toObject();
};

/**
 * Delete user by ID
 *
 * @param {string} id
 * @returns {Promise<boolean>}
 */
const deleteItem = async (id) => {
  const result = await User.findByIdAndDelete(id);
  return !!result;
};

/**
 * Checks ownership of user.
 *
 * @param {Object} params
 * @param {string} params.resourceId - user ID (from params)
 * @param {string} params.userId - User ID
 *
 * @returns {Promise<boolean>} Ownership result
 * @throws {Error} NotFound if user does not exist
 */
const checkOwner = async ({ resourceId, userId }) => {
  const user = await User.findById(resourceId);

  if (!user) {
    throw notFound();
  }

  return user.id.toString() === userId.toString();
};

module.exports = {
  userExist,
  adminExist,
  createAdmin,
  createUser,
  findUserByEmail,
  findUserById,
  createUserByAdmin,
  saveRefreshToken,
  clearRefreshToken,
  findSessionByToken,
  getActiveSessions,
  deleteSession,
  createOtp,
  findValidOtp,
  markOtpUsed,
  savePasswordResetToken,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  getAllUsers,
  countTotal,
  getSingleUser,
  updateUser,
  updatePassword,
  deleteItem,
  findAuthUserById,
  checkOwner,
};
