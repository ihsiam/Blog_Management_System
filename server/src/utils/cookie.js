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
 * Sets the refresh token cookie for the lifetime of the session.
 *
 * @param {import("express").Response} res - Express response object
 * @param {string} token - Refresh token
 *
 * @returns {void}
 */
const setRefreshTokenCookie = (res, token) => {
  res.cookie(REFRESH_TOKEN_COOKIE, token, {
    ...BASE_OPTIONS,
    maxAge: TTL_MS.SESSION,
  });
};

/**
 * Clears the refresh token cookie.
 *
 * @param {import("express").Response} res - Express response object
 *
 * @returns {void}
 */
const clearRefreshTokenCookie = (res) => {
  res.clearCookie(REFRESH_TOKEN_COOKIE, BASE_OPTIONS);
};

/**
 * Sets the short-lived password reset token cookie.
 *
 * @param {import("express").Response} res - Express response object
 * @param {string} token - Reset token
 *
 * @returns {void}
 */
const setResetTokenCookie = (res, token) => {
  res.cookie(RESET_TOKEN_COOKIE, token, {
    ...BASE_OPTIONS,
    maxAge: TTL_MS.RESET_TOKEN,
  });
};

/**
 * Clears the password reset token cookie.
 *
 * @param {import("express").Response} res - Express response object
 *
 * @returns {void}
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
