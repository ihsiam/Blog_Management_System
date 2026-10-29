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
 * Drop public article caches that embed the author name.
 *
 * @returns {Promise<void>} Resolves when matching cache keys are deleted.
 */
const invalidateAuthorCaches = async () => {
  await deleteCachePattern("article:list:*");
  await deleteCachePattern("article:*:author");
  await deleteCachePattern("article:*:expand:*");
  await deleteCachePattern("article:*:comments:*");
};

/**
 * Find a user by normalized email address.
 *
 * @param {string} email - User email address.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object|null>} Plain user object, or null when not found.
 */
const findUserByEmail = async (email, session) => {
  const query = User.findOne({ email: validation.normalizeEmail(email) });
  if (session) query.session(session);

  const user = await query;
  return user ? user.toObject() : null;
};

/**
 * Find a user by ID including the password hash for authentication.
 *
 * @param {string} id - User ID.
 * @returns {Promise<import("mongoose").Document|null>} Mongoose user document with password hash.
 */
const findAuthUserById = async (id) => await User.findById(id);

/**
 * Find a user by ID without the password hash.
 *
 * @param {string} id - User ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object|null>} Sanitized user object, or null when not found.
 */
const findUserById = async (id, session) => {
  const query = User.findById(id).select("-password_hash");
  if (session) query.session(session);

  const user = await query;
  return user ? user.toObject() : null;
};

/**
 * Return whether a user exists for the given email.
 *
 * @param {string} email - User email.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<boolean>} True when a matching user exists.
 */
const userExist = async (email, session) => {
  const user = await findUserByEmail(email, session);
  return !!user;
};

/**
 * Create an active administrator user.
 *
 * @param {Object} params - Admin fields.
 * @param {string} params.name - Display name.
 * @param {string} params.email - Email address.
 * @param {string} params.password - Pre-hashed password.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object>} Created admin user.
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
 * Create a pending user with default role and account status.
 *
 * @param {Object} params - User fields.
 * @param {string} params.name - Display name.
 * @param {string} params.email - Email address.
 * @param {string} params.password - Pre-hashed password.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object>} Created user.
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
 * Create an active user as an administrator (hashes the password).
 *
 * @param {Object} params - User fields.
 * @param {string} params.name - Display name.
 * @param {string} params.email - Email address.
 * @param {string} params.password - Plain-text password.
 * @param {string} [params.role=ROLES.USER] - Assigned role.
 * @returns {Promise<Object>} Created user without password hash.
 * @throws {Error} When the email is already registered.
 */
const createUserByAdmin = async ({
  name,
  email,
  password,
  role = ROLES.USER,
}) => {
  const hasUser = await userExist(email);

  if (hasUser) {
    throw badRequest(
      [{ field: "email", message: "User already exists", in: "body" }],
      "Validation error",
    );
  }

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
 * List users with filters, pagination, and sorting.
 *
 * @param {Object} params - Query options.
 * @param {number} [params.page=defaults.page] - Page number.
 * @param {number} [params.limit=defaults.limit] - Items per page.
 * @param {string} [params.sortBy=defaults.sortBy] - Field to sort by.
 * @param {string} [params.sortType=defaults.sortType] - Sort order (`asc` or `desc`).
 * @param {string} [params.name] - Name substring filter.
 * @param {string} [params.email] - Email substring filter.
 * @param {string} [params.status] - Account status filter.
 * @returns {Promise<Array<Object>>} Matching users as plain objects.
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
  // A leading minus sorts in descending order.
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  const filter = {};

  if (email) filter.email = { $regex: escapeRegex(email), $options: "i" };
  if (name) filter.name = { $regex: escapeRegex(name), $options: "i" };
  if (status) filter.account_status = status;

  const users = await User.find(filter)
    .sort(sortKey)
    // Skip the items of all previous pages.
    .skip(page * limit - limit)
    .limit(limit);

  return users.map((user) => user.toObject());
};

/**
 * Count users matching optional name, email, and status filters.
 *
 * @param {Object} params - Filter options.
 * @param {string} [params.name] - Name substring filter.
 * @param {string} [params.email] - Email substring filter.
 * @param {string} [params.status] - Account status filter.
 * @returns {Promise<number>} Matching user count.
 */
const countTotal = async ({ name, email, status }) => {
  const filter = {};

  if (email) filter.email = { $regex: escapeRegex(email), $options: "i" };
  if (name) filter.name = { $regex: escapeRegex(name), $options: "i" };
  if (status) filter.account_status = status;

  return await User.countDocuments(filter);
};

/**
 * Fetch a user by ID and optionally populate articles or comments.
 *
 * @param {Object} params - Lookup options.
 * @param {string} params.id - User ID.
 * @param {string} [params.expand=""] - Comma-separated expansions (`articles`, `comments`).
 * @returns {Promise<Object>} User without password hash.
 * @throws {Error} When the user does not exist.
 */
const getSingleUser = async ({ id, expand = "" }) => {
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
 * Ensure the system keeps at least one other active administrator.
 *
 * @param {string} id - ID of the user about to be deleted, blocked, or demoted.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<void>} Resolves when the check passes.
 * @throws {Error} When the user does not exist.
 * @throws {Error} When the user is the last active administrator.
 */
const ensureAnotherActiveAdmin = async (id, session) => {
  const targetQuery = User.findById(id);
  if (session) targetQuery.session(session);

  const target = await targetQuery;

  if (!target) throw notFound();

  // Only an active administrator can be the last active administrator.
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
 * Update a user's name, role, and/or account status.
 *
 * @param {Object} params - Fields to update.
 * @param {string} params.id - User ID.
 * @param {string} [params.name] - Display name.
 * @param {string} [params.role] - Assigned role.
 * @param {string} [params.status] - Account status.
 * @param {string} [params.statusTransition] - Source of a status change.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object>} Updated user without password hash.
 * @throws {Error} When the user is missing or the status transition is invalid.
 * @throws {Error} When the change would remove the last active administrator.
 */
const updateUser = async (
  { id, name, role, status, statusTransition },
  session,
) => {
  const payload = {};

  // Blocking or demoting must not remove the last active administrator.
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

    // Allowed moves follow the account state diagram.
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

    // Match on the current status so a concurrent change makes this update fail.
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

  const query = User.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true, ...(session && { session }) },
  ).select("-password_hash");
  if (session) query.session(session);

  const user = await query;

  if (!user) throw notFound();

  if (name !== undefined) await invalidateAuthorCaches();

  return user.toObject();
};

/**
 * Hash and store a new password for a user.
 *
 * @param {Object} params - Password update fields.
 * @param {string} params.id - User ID.
 * @param {string} params.password - Plain-text password.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object>} Updated user without password hash.
 * @throws {Error} When the user does not exist.
 */
const updatePassword = async ({ id, password }, session) => {
  const payload = {};

  if (password !== undefined) {
    const hashPassword = await hashing.generateHash(password);
    payload.password_hash = hashPassword;
  }

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
 * Delete a user by ID together with their sessions, OTPs, and reset tokens.
 *
 * @param {string} id - User ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<boolean>} True when a user document was deleted.
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
 * Return whether `userId` is the same user as `resourceId`.
 *
 * @param {Object} params - Ownership check fields.
 * @param {string} params.resourceId - Target user ID from the route.
 * @param {string} params.userId - Authenticated user ID.
 * @returns {Promise<boolean>} True when the IDs match.
 * @throws {Error} When the target user does not exist.
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
