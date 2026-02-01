const { verifyToken } = require("../lib/token");
const { findUserByEmail } = require("../lib/user");
const { authenticationError } = require("../utils/error");

const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const decode = verifyToken(token);
    const user = await findUserByEmail(decode.email);
    if (!user) {
      next(authenticationError());
    }

    if (user.status !== "approved") {
      next(authenticationError(`Your account status is ${user.status}`));
    }

    req.user = user._doc;
    next();
  } catch (e) {
    next(authenticationError());
  }
};

module.exports = authenticate;
