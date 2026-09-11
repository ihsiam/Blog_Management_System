/**
 * Shared helpers for Article integration tests.
 *
 * Seeds articles via the real Article model so suites can set published/draft
 * states without going through every HTTP step when that step is not under test.
 * Auth fixtures reuse Phase 2 helpers (seedUser + issueSession).
 */

const Article = require("../../../src/model/Article");
const { seedUser, issueSession } = require("./auth");

let emailSeq = 0;

/**
 * Create an approved user with a live access token (real JWT + DB session).
 *
 * @param {Object} [overrides]
 * @returns {Promise<{user: Object, accessToken: string}>}
 */
const createAuthedUser = async (overrides = {}) => {
  emailSeq += 1;
  const user = await seedUser({
    name: overrides.name || "Article Author",
    email: overrides.email || `article-user-${emailSeq}@example.com`,
    password: overrides.password || "password123",
    role: overrides.role || "user",
    status: overrides.status || "approved",
  });
  const { accessToken } = await issueSession(user);
  return { user, accessToken };
};

/**
 * Persist an article document directly.
 *
 * @param {Object} params
 * @param {string} params.author - User id
 * @param {string} [params.title]
 * @param {string} [params.body]
 * @param {string} [params.cover]
 * @param {string} [params.status] - "published" | "draft"
 * @returns {Promise<Object>}
 */
const seedArticle = async ({
  author,
  title = "Seeded Article",
  body = "Seeded body",
  cover = "",
  status = "published",
} = {}) => {
  if (!author) {
    throw new Error("seedArticle requires an author id");
  }

  const article = await Article.create({
    title,
    body,
    cover,
    status,
    author,
  });

  return article.toObject();
};

module.exports = {
  createAuthedUser,
  seedArticle,
};
