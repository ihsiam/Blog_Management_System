const User = require("../../model/User");

const findUserByEmail = async (email) => {
  const user = await User.findOne({ email });
  return user || false;
};

const userExist = async (email) => {
  const user = await findUserByEmail(email);
  return !!user;
};

const createUser = async ({ name, email, password }) => {
  const user = new User({ name, email, password });
  await user.save();
  return user._doc;
};

module.exports = { userExist, createUser, findUserByEmail };
