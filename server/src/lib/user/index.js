const User = require("../../model/User");

const findUserByEmail = async (email) => {
  const user = await User.findOne({ email });
  return user ? user.toObject() : false;
};

const findUserById = async (id) => {
  const user = await User.findById(id);
  return user ? user.toObject() : false;
};

const userExist = async (email) => {
  const user = await findUserByEmail(email);
  return !!user;
};

const createUser = async ({ name, email, password }) => {
  const user = new User({ name, email, password });
  await user.save();
  return user.toObject();
};

module.exports = { userExist, createUser, findUserByEmail, findUserById };
