/**
 * Shared helpers for Comment integration tests.
 *
 * Seeds comments via the real Comment model. Article/user fixtures reuse
 * Phase 2–3 helpers so Auth + Article relationships stay realistic.
 */

const Comment = require("../../../src/model/Comment");
const { createAuthedUser, seedArticle } = require("./article");

/**
 * Persist a comment document directly.
 *
 * @param {Object} params
 * @param {string} params.article - Article id
 * @param {string} params.author - User id
 * @param {string} [params.body]
 * @param {string} [params.status] - "public" | "hidden"
 * @returns {Promise<Object>}
 */
const seedComment = async ({
  article,
  author,
  body = "Seeded comment",
  status = "public",
} = {}) => {
  if (!article || !author) {
    throw new Error("seedComment requires article and author ids");
  }

  const comment = await Comment.create({
    body,
    status,
    article,
    author,
  });

  return comment.toObject();
};

/**
 * Convenience: approved user + published article (+ optional draft).
 *
 * @param {Object} [options]
 * @returns {Promise<{user, accessToken, article, draft}>}
 */
const createArticleContext = async (options = {}) => {
  const { user, accessToken } = await createAuthedUser(options.user);
  const article = await seedArticle({
    author: user.id,
    title: options.title || "Commentable Article",
    status: "published",
  });

  let draft = null;
  if (options.withDraft) {
    draft = await seedArticle({
      author: user.id,
      title: options.draftTitle || "Draft Article",
      status: "draft",
    });
  }

  return { user, accessToken, article, draft };
};

module.exports = {
  seedComment,
  createArticleContext,
  createAuthedUser,
  seedArticle,
};
