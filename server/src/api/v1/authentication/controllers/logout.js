const userServices = require("../../../../lib/user");
const { unauthorized } = require("../../../../utils/error");

const logout = async (req, res, next) => {
  try {
    // extract data
    const token = req.cookies?.refreshToken;
    const { id } = req.user;

    // if no token found
    if (!token) {
      throw unauthorized("Already logged out");
    }

    // clear token from db
    if (id) {
      await userServices.clearRefreshToken(id);
    }

    // clear cookie
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: true,
    });

    // send response
    res.status(200).json({
      code: 200,
      message: "Logged out successfully",
    });
  } catch (e) {
    next(e);
  }
};

module.exports = logout;
