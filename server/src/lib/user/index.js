const User = require("../../model/User");
const { badRequest, notFound } = require("../../utils/error");
const { hashing } = require("../../utils");
const defaults = require("../../config/defaults");

/**
 * Find user by email
 *
 * @param {string} email - User email address
 * @returns {Promise<Object|null>} User object or null
 */
const findUserByEmail = async (email) => {
  const user = await User.findOne({ email });
  return user ? user.toObject() : null;
};

/**
 * Find authenticated user by ID
 *
 * @param {string} id - User ID
 * @returns {Promise<Object|null>} Mongoose user document
 */
const findAuthUserById = async (id) => await User.findById(id);

/**
 * Find user by ID (safe output without sensitive fields)
 *
 * @param {string} id - User ID
 * @returns {Promise<Object|null>} Sanitized user object
 */
const findUserById = async (id) => {
  const user = await User.findById(id).select("-password -refreshToken");
  return user ? user.toObject() : null;
};

/**
 * Check if user exists by email
 *
 * @param {string} email - User email
 * @returns {Promise<boolean>}
 */
const userExist = async (email) => {
  const user = await findUserByEmail(email);
  return !!user;
};

/**
 * Check if any admin exists in system
 *
 * @returns {Promise<boolean>}
 */
const adminExist = async () => {
  const admin = await User.find({ role: "admin" });
  return !!admin.length;
};

/**
 * Create admin user
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} params.email
 * @param {string} params.password
 * @returns {Promise<Object>} Created admin user
 */
const createAdmin = async ({ name, email, password }) => {
  const user = new User({
    name,
    email,
    password,
    role: "admin",
    status: "approved",
  });

  await user.save();
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
const createUser = async ({ name, email, password }) => {
  const user = new User({ name, email, password });

  await user.save();
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
const createUserByAdmin = async ({ name, email, password }) => {
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
    password: hashPassword,
    status: "approved",
  });

  await user.save();

  const userData = user.toObject();

  delete userData.password;
  delete userData.role;
  delete userData.status;

  return userData;
};

/**
 * Save refresh token
 *
 * @param {string} id - User ID
 * @param {string} refreshToken
 * @returns {Promise<void>}
 */
const saveRefreshToken = async (id, refreshToken) => {
  await User.findByIdAndUpdate(id, { $set: { refreshToken } });
};

/**
 * Clear refresh token
 *
 * @param {string} id - User ID
 * @returns {Promise<void>}
 */
const clearRefreshToken = async (id) => {
  await User.findByIdAndUpdate(id, { $set: { refreshToken: null } });
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
  if (status) filter.status = status;

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
  if (status) filter.status = status;

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

  const user = await User.findById(id).select("-password -refreshToken");

  if (!user) {
    throw notFound();
  }

  // expand articles
  if (TrimmedExpand.includes("articles")) {
    await user.populate({ path: "articles", select: "title status -author" });
  }

  // expand comments
  if (TrimmedExpand.includes("comments")) {
    await user.populate({ path: "comments", select: "body status -author" });
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
 * @returns {Promise<Object>}
 */
const updateUser = async ({ id, name, role, status }) => {
  const payload = {};

  if (name !== undefined) payload.name = name;
  if (role !== undefined) payload.role = role;
  if (status !== undefined) payload.status = status;

  // find user and update data
  const user = await User.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true },
  ).select("-password");

  // if user not found
  if (!user) throw notFound();

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
const updatePassword = async ({ id, password }) => {
  const payload = {};

  // password hash
  if (password !== undefined) {
    const hashPassword = await hashing.generateHash(password);
    payload.password = hashPassword;
  }

  // update password
  const user = await User.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true },
  ).select("-password");

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
  getAllUsers,
  countTotal,
  getSingleUser,
  updateUser,
  updatePassword,
  deleteItem,
  findAuthUserById,
};
