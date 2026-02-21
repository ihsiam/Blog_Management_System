const User = require("../../model/User");

// find user by email
const findUserByEmail = async (email) => {
  // find user
  const user = await User.findOne({ email });

  return user ? user.toObject() : false;
};

// find user by id
const findUserById = async (id) => {
  // find user
  const user = await User.findById(id);

  return user ? user.toObject() : false;
};

// user existence
const userExist = async (email) => {
  // find user
  const user = await findUserByEmail(email);

  return !!user;
};

// create user
const createUser = async ({ name, email, password }) => {
  // create user
  const user = new User({ name, email, password });

  await user.save();

  return user.toObject();
};

module.exports = { userExist, createUser, findUserByEmail, findUserById };
