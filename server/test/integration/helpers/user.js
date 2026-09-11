/**
 * Shared helpers for User integration tests.
 *
 * Reuses Phase 2–3 auth/article fixtures. Seeds are intentionally thin —
 * User HTTP flows under test go through the real controllers/services.
 */

const { createAuthedUser, seedArticle } = require("./article");
const { seedComment } = require("./comment");
const { seedUser, issueSession } = require("./auth");

module.exports = {
  createAuthedUser,
  seedArticle,
  seedComment,
  seedUser,
  issueSession,
};
