const tokenServices = require("../../../../lib/token");
const userServices = require("../../../../lib/user");
const { badRequest, notFound } = require("../../../../utils/error");

/**
 * Verifies user email and activates the account.
 *
 * @param {import("express").Request} req - Express request object
 * @param {Object} req.params - Route parameters
 * @param {string} req.params.token - Email verification JWT token
 *
 * @param {import("express").Response} res - Express response object
 * @param {Function} next - Express error-handling middleware
 *
 * @returns {Promise<void>} Sends authentication response after verification
 *
 * @throws {Error} NotFound if user does not exist
 * @throws {Error} BadRequest if account is already verified
 */
const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;

    /**
     * Validate and decode activation token
     */
    const userInfo = tokenServices.verifyActiveResetToken(token);

    /**
     * Fetch user from database
     */
    const user = await userServices.findUserById(userInfo.id);

    if (!user) {
      throw notFound("User not found");
    }

    /**
     * Prevent duplicate account activation
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
     * Build JWT payload
     */
    const payload = {
      id: updatedUser.id,
      role: updatedUser.role,
      email: updatedUser.email,
    };

    /**
     * Generate authentication tokens
     */
    const refreshToken = tokenServices.generateRefreshToken(payload);
    const accessToken = tokenServices.generateAccessToken(payload);

    /**
     * Persist refresh token for session management
     */
    await userServices.saveRefreshToken(updatedUser.id, refreshToken);

    /**
     * Set refresh token in secure HTTP-only cookie
     */
    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
    });

    return res.status(200).json({
      code: 200,
      message: "Email verified successfully.",
      data: {
        accessToken,
      },
      links: {
        signin: "/api/v1/auth/sign-in",
      },
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = verifyEmail;
