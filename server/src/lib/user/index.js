const User = require("../../model/User");
const sessionServices = require("../session");
const otpServices = require("../otp");
const passwordResetServices = require("../passwordReset");
const { badRequest, conflict, notFound } = require("../../utils/error");
const { hashing, validation } = require("../../utils");
const defaults = require("../../config/defaults");
const {
  ROLES,
  ACCOUNT_STATUS,
  STATUS_TRANSITION,
} = require("../../config/constants");
const { deleteCachePattern } = require("../../utils/cache");
const { escapeRegex } = require("../../utils/query");
const { mapUser } = require("../../utils/mappers");

/**
 * Drops public article caches that embed the author name.
 *
 * @returns {Promise<void>}
 */
const invalidateAuthorCaches = async () => {
  await deleteCachePattern("article:list:*");
  await deleteCachePattern("article:*:author");
  await deleteCachePattern("article:*:expand:*");
  await deleteCachePattern("article:*:comments:*");
};

/**
 * Find user by email
 *
 * @param {string} email - User email address
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object|null>} User object or null
 */
const findUserByEmail = async (email, session) => {
  const query = User.findOne({ email: validation.normalizeEmail(email) });
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
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<boolean>}
 */
const userExist = async (email, session) => {
  const user = await findUserByEmail(email, session);
  return !!user;
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
    email: validation.normalizeEmail(email),
    password_hash: password,
    role: ROLES.ADMIN,
    account_status: ACCOUNT_STATUS.ACTIVE,
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
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Object>} Created user
 */
const createUser = async ({ name, email, password }, session) => {
  const user = new User({
    name,
    email: validation.normalizeEmail(email),
    password_hash: password,
  });

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
 * @param {string} [params.role]
 * @returns {Promise<Object>} Created user (sanitized)
 */
const createUserByAdmin = async ({
  name,
  email,
  password,
  role = ROLES.USER,
}) => {
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
    email: validation.normalizeEmail(email),
    password_hash: hashPassword,
    role,
    account_status: ACCOUNT_STATUS.ACTIVE,
  });

  await user.save();

  return mapUser(user);
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

  if (email) filter.email = { $regex: escapeRegex(email), $options: "i" };
  if (name) filter.name = { $regex: escapeRegex(name), $options: "i" };
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

  if (email) filter.email = { $regex: escapeRegex(email), $options: "i" };
  if (name) filter.name = { $regex: escapeRegex(name), $options: "i" };
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
    await user.populate({
      path: "articles",
      select: "title status -author_id",
    });
  }

  // expand comments
  if (TrimmedExpand.includes("comments")) {
    await user.populate({
      path: "comments",
      select: "body status article_id -author_id",
    });
  }

  return user.toObject();
};

/**
 * Ensure the system keeps at least one other active administrator
 *
 * Does nothing when the target is not an active administrator.
 *
 * @param {string} id - ID of the user about to be deleted, blocked or demoted
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<void>}
 * @throws {Error} NotFound if user does not exist
 * @throws {Error} Conflict if the user is the last active administrator
 */
const ensureAnotherActiveAdmin = async (id, session) => {
  const targetQuery = User.findById(id);
  if (session) targetQuery.session(session);

  const target = await targetQuery;

  if (!target) throw notFound();

  if (
    target.role !== ROLES.ADMIN ||
    target.account_status !== ACCOUNT_STATUS.ACTIVE
  ) {
    return;
  }

  const othersQuery = User.countDocuments({
    _id: { $ne: id },
    role: ROLES.ADMIN,
    account_status: ACCOUNT_STATUS.ACTIVE,
  });
  if (session) othersQuery.session(session);

  const others = await othersQuery;

  if (!others) {
    throw conflict("Cannot remove the last active administrator");
  }
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

  // blocking or demoting must not remove the last active administrator
  if (
    (role !== undefined && role !== ROLES.ADMIN) ||
    status === ACCOUNT_STATUS.BLOCKED
  ) {
    await ensureAnotherActiveAdmin(id);
  }

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

    // allowed moves follow the account state diagram
    const isEmailVerification =
      statusTransition === STATUS_TRANSITION.EMAIL_VERIFICATION &&
      currentUser.account_status === ACCOUNT_STATUS.PENDING &&
      status === ACCOUNT_STATUS.ACTIVE;
    const isAdminTransition =
      statusTransition === STATUS_TRANSITION.ADMIN &&
      ((currentUser.account_status === ACCOUNT_STATUS.ACTIVE &&
        status === ACCOUNT_STATUS.BLOCKED) ||
        (currentUser.account_status === ACCOUNT_STATUS.BLOCKED &&
          status === ACCOUNT_STATUS.ACTIVE));

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

    if (name !== undefined) await invalidateAuthorCaches();

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

  if (name !== undefined) await invalidateAuthorCaches();

  return user.toObject();
};

/**
 * Update user password (hashed)
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} params.password
 * @param {ClientSession} [session] - Optional MongoDB session
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
 * Delete user by ID together with their sessions, OTPs and reset tokens
 *
 * @param {string} id
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<boolean>}
 */
const deleteItem = async (id, session) => {
  await sessionServices.clearRefreshToken({ id }, session);
  await otpServices.deleteOtpsByUser(id, session);
  await passwordResetServices.deletePasswordResetTokenByUser(id, session);

  const result = await User.findByIdAndDelete(
    id,
    session ? { session } : undefined,
  );
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
  createAdmin,
  createUser,
  findUserByEmail,
  findUserById,
  createUserByAdmin,
  getAllUsers,
  countTotal,
  getSingleUser,
  updateUser,
  updatePassword,
  deleteItem,
  ensureAnotherActiveAdmin,
  findAuthUserById,
  checkOwner,
};
