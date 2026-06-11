const tokenServices = require("../../../../lib/token");
const userServices = require("../../../../lib/user");
const { badRequest } = require("../../../../utils/error");

/**
 * Verify user email and activate account
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    /**
     * Validate and decode activation token
     */
    const userInfo = tokenServices.verifyActiveResetToken(token);

    /**
     * Retrieve user from database
     */
    const user = await userServices.getUserById(userInfo.id);

    /**
     * Prevent re-verification of an already activated account
     */
    if (user.status === "approved") {
      throw badRequest(
        [
          {
            field: "token",
            message: "Account already verified",
            in: "params",
          },
        ],
        "Account already verified",
      );
    }

    /**
     * Activate user account
     */
    const updatedUser = await userServices.updateUser({
      id: user.id,
      status: "approved",
    });

    /**
     * Prepare JWT payload
     */
    const payload = {
      id: updatedUser.id,
      role: updatedUser.role,
      email: updatedUser.email,
    };

    /**
     * Generate refresh token
     */
    const refreshToken = tokenServices.generateRefreshToken(payload);

    /**
     * Persist refresh token for future authentication
     */
    await userServices.saveRefreshToken(updatedUser.id, refreshToken);

    /**
     * Store refresh token in a secure HTTP-only cookie
     */
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });

    /**
     * Send success response
     */
    return res.status(200).json({
      code: 200,
      message: "Email verified successfully.",
      links: {
        signin: "/api/v1/auth/sign-in",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = verifyEmail;
