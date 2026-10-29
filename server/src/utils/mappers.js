/**
 * Shared response DTO mappers.
 *
 * Convert persistence-shaped documents into the public API shape.
 * Safe to call on values that are already mapped (idempotent).
 */

/**
 * Convert a Mongoose document to a plain object; leave other values as shallow copies.
 *
 * Falsy values are returned unchanged.
 *
 * @param {Object|null|undefined} value - Document or plain object.
 * @returns {Object|null|undefined} Plain object, or the original falsy value.
 */
const toPlain = (value) => {
  if (!value) return value;
  return value.toObject ? value.toObject() : { ...value };
};

/**
 * Map an article document to the public response shape.
 *
 * Renames `cover_image_url` to `cover`, `author_id` to `author`, and
 * `category_id` to `category`. When both names are present, the public name
 * (`cover`, `author`, `category`) takes precedence.
 *
 * @param {Object} article - Article document or object.
 * @returns {Object} Normalized article.
 */
const mapArticle = (article) => {
  const object = toPlain(article);
  const {
    cover_image_url: coverFromDb,
    author_id: authorFromDb,
    category_id: categoryFromDb,
    cover,
    author,
    category,
    ...rest
  } = object;

  // Prefer already-mapped fields so repeated mapping gives the same result.
  return {
    ...rest,
    cover: cover ?? coverFromDb,
    author: author ?? authorFromDb,
    category: category ?? categoryFromDb,
  };
};

/**
 * Map a comment document (with populated author when present) to the
 * response shape shared by every comment endpoint.
 *
 * @param {Object} comment - Comment document or object
 * @returns {Object} Normalized comment
 */
const mapComment = (comment) => {
  const object = toPlain(comment);
  const {
    author_id: authorFromDb,
    article_id: articleFromDb,
    parent_comment_id: parentFromDb,
    author,
    article,
    parentCommentId,
    ...rest
  } = object;

  // Use `author` when present (even if null); otherwise fall back to `author_id`.
  const resolvedAuthor = author !== undefined ? author : authorFromDb;

  return {
    ...rest,
    article: article ?? articleFromDb,
    author: resolvedAuthor
      ? { id: resolvedAuthor.id, name: resolvedAuthor.name }
      : null,
    parentCommentId:
      (parentCommentId !== undefined ? parentCommentId : parentFromDb) || null,
  };
};

/**
 * Map a user document to the public response shape (without `password_hash`).
 *
 * @param {Object} user - User document or object.
 * @returns {Object} Sanitized user.
 */
const mapUser = (user) => {
  const object = toPlain(user);
  // Delete from the plain copy so the source document is not mutated.
  delete object.password_hash;
  return object;
};

/**
 * Map a user to the public author preview used by article author endpoints.
 *
 * @param {Object} user - User document or object.
 * @returns {{ id: *, name: * }} Author id and name.
 */
const mapAuthor = (user) => {
  const object = toPlain(user);
  return {
    id: object.id,
    name: object.name,
  };
};

/**
 * Map a newly registered user to the sign-up response payload.
 *
 * @param {Object} user - User document or object.
 * @returns {Object} Sign-up user fields.
 */
const mapSignUpUser = (user) => {
  const object = toPlain(user);
  return {
    id: object.id,
    name: object.name,
    email: object.email,
    account_status: object.account_status,
    createdAt: object.createdAt,
    updatedAt: object.updatedAt,
  };
};

module.exports = {
  mapArticle,
  mapComment,
  mapUser,
  mapAuthor,
  mapSignUpUser,
};
