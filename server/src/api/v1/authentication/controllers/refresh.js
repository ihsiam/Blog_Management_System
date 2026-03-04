const tokenServices = require("../../../../lib/token");
const { unauthorized } = require("../../../../utils/error");

const refresh = async (req, res, next) => {
  try {
    // extract data
    const token = req.cookies?.refreshToken;

    // if token not found
    if (!token) {
      throw unauthorized("Refresh token missing");
    }

    // get new tokens
    const { newAccessToken, newRefreshToken } =
      await tokenServices.refreshToken(token);

    // set into cookies
    res.cookie("refreshToken", newRefreshToken, {
      httpOnly: true,
      secure: true,
    });

    // sent json response
    res.status(200).json({
      code: 200,
      message: "Token refreshed",
      data: {
        access_token: newAccessToken,
      },
    });
  } catch (e) {
    next(e);
  }
};

module.exports = refresh;
