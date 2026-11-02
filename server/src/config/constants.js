/**
 * Frozen enum-like values shared across the API (roles, statuses, OTPs, TTLs).
 */

/** User roles. */
const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

/** Account lifecycle statuses. */
const ACCOUNT_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  BLOCKED: "blocked",
});

/** Article publication statuses. */
const ARTICLE_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
});

/** Comment visibility statuses. */
const COMMENT_STATUS = Object.freeze({
  PUBLIC: "public",
  HIDDEN: "hidden",
});

/** Category availability statuses. */
const CATEGORY_STATUS = Object.freeze({
  ACTIVE: "active",
  UNAVAILABLE: "unavailable",
});

/** Purposes a one-time password (OTP) can be issued for. */
const OTP_PURPOSE = Object.freeze({
  EMAIL_VERIFICATION: "email_verification",
  PASSWORD_RESET: "password_reset",
});

/** Sources that may trigger an account status change. */
const STATUS_TRANSITION = Object.freeze({
  EMAIL_VERIFICATION: "emailVerification",
  ADMIN: "admin",
});

/**
 * Lifetimes of session-related credentials, in milliseconds.
 *
 * `SESSION` is 30 days and `RESET_TOKEN` is 5 minutes.
 */
const TTL_MS = Object.freeze({
  SESSION: 30 * 24 * 60 * 60 * 1000,
  RESET_TOKEN: 5 * 60 * 1000,
});

// Arrays of the allowed values for each enum, for example for schema validation.
const ROLE_VALUES = Object.freeze(Object.values(ROLES));
const ACCOUNT_STATUS_VALUES = Object.freeze(Object.values(ACCOUNT_STATUS));
const ARTICLE_STATUS_VALUES = Object.freeze(Object.values(ARTICLE_STATUS));
const COMMENT_STATUS_VALUES = Object.freeze(Object.values(COMMENT_STATUS));
const CATEGORY_STATUS_VALUES = Object.freeze(Object.values(CATEGORY_STATUS));

module.exports = Object.freeze({
  TTL_MS,
  ROLES,
  ACCOUNT_STATUS,
  ARTICLE_STATUS,
  COMMENT_STATUS,
  CATEGORY_STATUS,
  OTP_PURPOSE,
  STATUS_TRANSITION,
  ROLE_VALUES,
  ACCOUNT_STATUS_VALUES,
  ARTICLE_STATUS_VALUES,
  COMMENT_STATUS_VALUES,
  CATEGORY_STATUS_VALUES,
});
