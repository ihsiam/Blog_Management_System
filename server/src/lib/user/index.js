const User = require("../../model/User");
const { badRequest, notFound } = require("../../utils/error");
const { hashing } = require("../../utils");
const defaults = require("../../config/defaults");

// find user by email
const findUserByEmail = async (email) => {
  // find user
  const user = await User.findOne({ email });

  return user ? user.toObject() : null;
};

// find user by id
const findUserById = async (id) => {
  // find user
  const user = await User.findById(id).select("-password");

  return user ? user.toObject() : null;
};

// user existence
const userExist = async (email) => {
  // find user
  const user = await findUserByEmail(email);

  return !!user;
};

// admin existence
const adminExist = async () => {
  // find admin
  const admin = await User.find({ role: "admin" });

  return !!admin.length;
};

// create user
const createAdmin = async ({ name, email, password }) => {
  // create user
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

// create user
const createUser = async ({ name, email, password }) => {
  // create user
  const user = new User({ name, email, password });

  await user.save();

  return user.toObject();
};

// create user by admin
const createUserByAdmin = async ({ name, email, password }) => {
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
  const user = new User({
    name,
    email,
    password: hashPassword,
    status: "approved",
  });

  await user.save();

  const userData = user.toObject();

  // delete confidential info
  delete userData.password;
  delete userData.role;
  delete userData.status;

  return userData;
};

// save refresh token into user db
const saveRefreshToken = async (id, refreshToken) => {
  await User.findByIdAndUpdate(id, { $set: { refreshToken } });
};

// remove refresh token from user database
const clearRefreshToken = async (id) => {
  await User.findByIdAndUpdate(id, { $set: { refreshToken: null } });
};

// get all user
const getAllUsers = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortBy = defaults.sortBy,
  sortType = defaults.sortType,
  name,
  email,
}) => {
  // sort key
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  // search option
  const filter = {};

  // for email
  if (email) {
    filter.email = { $regex: email, $options: "i" };
  }

  // for name
  if (name) {
    filter.name = { $regex: name, $options: "i" };
  }

  // find users
  const users = await User.find(filter)
    .sort(sortKey) // filter data based on search
    .skip(page * limit - limit) // skip based on page
    .limit(limit); // retrieved based on limit

  return users.map((user) => user.toObject());
};

// count document
const countTotal = async ({ name, email }) => {
  // search option
  const filter = {};

  // for email
  if (email) {
    filter.email = { $regex: email, $options: "i" };
  }

  // for name
  if (name) {
    filter.name = { $regex: name, $options: "i" };
  }

  // count
  const total = await User.countDocuments(filter);

  return total;
};

// get single user
const getSingleUser = async ({ id, expand = "" }) => {
  // extract expand
  const TrimmedExpand = expand
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // find article
  const user = await User.findById(id).select("-password");

  // if not found
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

// update user data
const updateUser = async ({ id, name, role, status }) => {
  const payload = {};
  if (name !== undefined) payload.name = name;
  if (role !== undefined) payload.role = role;
  if (status !== undefined) payload.status = status;

  // update data
  const user = await User.findByIdAndUpdate(
    id,
    { $set: payload },
    { new: true, runValidators: true },
  ).select("-password");

  // if user not found
  if (!user) throw notFound();

  return user.toObject();
};

const updatePassword = async ({ id, password }) => {
  // password payload
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

  // if user not found
  if (!user) throw notFound();

  return user.toObject();
};

// delete item
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
};
