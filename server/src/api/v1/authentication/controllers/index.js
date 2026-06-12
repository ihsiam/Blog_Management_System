const register = require("./register");
const setupAdmin = require("./setupAdmin");
const login = require("./login");
const refresh = require("./refresh");
const logout = require("./logout");
const verifyEmail = require("./verifyEmail");
const resendVerificationMail = require("./resendVerificationMail");
const forgotPassword = require("./forgotPassword");
const resetPassword = require("./resetPassword");

module.exports = {
  register,
  setupAdmin,
  login,
  refresh,
  logout,
  verifyEmail,
  resendVerificationMail,
  forgotPassword,
  resetPassword,
};
