/**
 * Single source of truth for the enum-like values used across the API.
 *
 * These mirror the allowed values of the database schemas and the state
 * diagrams. Use them instead of hardcoded strings.
 */
const ROLES = Object.freeze({
  USER: "user",
  ADMIN: "admin",
});

const ACCOUNT_STATUS = Object.freeze({
  PENDING: "pending",
  ACTIVE: "active",
  BLOCKED: "blocked",
});

const ARTICLE_STATUS = Object.freeze({
  DRAFT: "draft",
  PUBLISHED: "published",
});

const COMMENT_STATUS = Object.freeze({
  PUBLIC: "public",
  HIDDEN: "hidden",
});

const CATEGORY_STATUS = Object.freeze({
  ACTIVE: "active",
  UNAVAILABLE: "unavailable",
});

const OTP_PURPOSE = Object.freeze({
  EMAIL_VERIFICATION: "email_verification",
  PASSWORD_RESET: "password_reset",
});

/**
 * Who triggered an account status change (see the account state diagram).
 */
const STATUS_TRANSITION = Object.freeze({
  EMAIL_VERIFICATION: "emailVerification",
  ADMIN: "admin",
});

/**
 * Lifetimes of session related credentials, in milliseconds.
 */
const TTL_MS = Object.freeze({
  SESSION: 30 * 24 * 60 * 60 * 1000,
  RESET_TOKEN: 5 * 60 * 1000,
});

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
