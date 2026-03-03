const getAllUsers = require("./getAllUsers");
const getSingleUser = require("./getSingleUser");
const createUser = require("./createUser");
const deleteUser = require("./deleteUser");
const updateUser = require("./updateUser");
const changePassword = require("./changePassword");

module.exports = {
  getAllUsers,
  getSingleUser,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
};
