const { TTL_MS } = require("../config/constants");

const REFRESH_TOKEN_COOKIE = "refreshToken";
const RESET_TOKEN_COOKIE = "resetToken";

/**
 * Options shared by every auth cookie: not readable by scripts, HTTPS only,
 * and never sent on cross-site requests.
 */
const BASE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: "strict",
};

/**
 * Set the refresh token cookie for the lifetime of the session.
 *
 * @param {import("express").Response} res - Express response.
 * @param {string} token - Refresh token.
 */
const setRefreshTokenCookie = (res, token) => {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...BASE_OPTIONS,
    maxAge: TTL_MS.SESSION,
  });
};

/**
 * Clear the refresh token cookie.
 *
 * The same base options are passed so the browser matches and removes the
 * cookie that was originally set.
 *
 * @param {import("express").Response} res - Express response.
 */
const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, BASE_OPTIONS);
};

/**
 * Set the short-lived password reset token cookie.
 *
 * @param {import("express").Response} res - Express response.
 * @param {string} token - Reset token.
 */
const setResetTokenCookie = (res, token) => {
  res.cookie(RESET_TOKEN_COOKIE, token, {
    ...BASE_OPTIONS,
    maxAge: TTL_MS.RESET_TOKEN,
  });
};

/**
 * Clear the password reset token cookie.
 *
 * The same base options are passed so the browser matches and removes the
 * cookie that was originally set.
 *
 * @param {import("express").Response} res - Express response.
 */
const clearResetTokenCookie = (res) => {
  res.clearCookie(RESET_TOKEN_COOKIE, BASE_OPTIONS);
};

module.exports = {
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
  setResetTokenCookie,
  clearResetTokenCookie,
};
