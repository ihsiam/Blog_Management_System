const mongoose = require("mongoose");
const Article = require("../../model/Article");
const categoryServices = require("../categories");
const storageService = require("../storage");
const defaults = require("../../config/defaults");
const {
  ROLES,
  ARTICLE_STATUS,
  COMMENT_STATUS,
} = require("../../config/constants");
const { notFound, badRequest } = require("../../utils/error");
const { escapeRegex } = require("../../utils/query");
const { generateDigest } = require("../../utils/hashing");
const {
  getCache,
  setCache,
  deleteCache,
  deleteCachePattern,
} = require("../../utils/cache");
const { mapArticle } = require("../../utils/mappers");

/**
 * Cache lifetime, in seconds, for published article lists and counts.
 */
const ARTICLE_LIST_TTL_SECONDS = 60;

/**
 * Cache lifetime, in seconds, for a single article.
 */
const ARTICLE_TTL_SECONDS = 300;

/**
 * Ensure an article references an active category.
 *
 * @param {string} category - Category ID.
 * @returns {Promise<void>} Resolves when the category is valid.
 * @throws {Error} When the category ID is invalid, missing, or unavailable.
 */
const validateCategory = async (category) => {
  if (!category || !mongoose.Types.ObjectId.isValid(category)) {
    throw badRequest(
      [{ field: "category", message: "invalid input", in: "body" }],
      "invalid input",
    );
  }

  try {
    await categoryServices.findSingleItem({ id: category });
  } catch (err) {
    // Only a missing or unavailable category is a client error.
    if (err.statusCode !== 404) throw err;

    throw badRequest(
      [{ field: "category", message: "invalid input", in: "body" }],
      "invalid input",
    );
  }
};

/**
 * Drop public article list and count cache keys.
 *
 * @returns {Promise<void>} Resolves when matching cache keys are deleted.
 */
const invalidatePublishedArticleLists = async () => {
  await deleteCachePattern("article:list:*");
  await deleteCachePattern("article:count:*");
};

/**
 * Drop single-article cache keys (author key and expand variants).
 *
 * @param {string} id - Article ID.
 * @returns {Promise<void>} Resolves when matching cache keys are deleted.
 */
const invalidateArticleResource = async (id) => {
  await deleteCache(`article:${id}:author`);
  await deleteCachePattern(`article:${id}:expand:*`);
};

/**
 * List paginated articles with optional filtering.
 *
 * @param {Object} params - Query options.
 * @param {number} [params.page=defaults.page] - Page number.
 * @param {number} [params.limit=defaults.limit] - Items per page.
 * @param {string} [params.sortBy=defaults.sortBy] - Field to sort by.
 * @param {string} [params.sortType=defaults.sortType] - Sort order (`asc` or `desc`).
 * @param {string} [params.searchTerm=defaults.searchTerm] - Title search keyword.
 * @param {string} [params.status] - Article status filter.
 * @param {string} [params.category] - Category ID filter.
 * @returns {Promise<Array<Object>>} Mapped article records.
 */
const findAll = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortBy = defaults.sortBy,
  sortType = defaults.sortType,
  searchTerm = defaults.searchTerm,
  status,
  category,
}) => {
  // Digest keeps the key short and safe even for arbitrary search input.
  const listCacheKey = `article:list:${page}:${limit}:${sortBy}:${sortType}:${generateDigest(searchTerm)}:${category || ""}`;

  if (status === ARTICLE_STATUS.PUBLISHED) {
    const cached = await getCache(listCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // A leading minus sorts in descending order.
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  const filter = {
    title: { $regex: escapeRegex(searchTerm), $options: "i" },
  };

  if (status) {
    filter.status = status;
  }

  if (category) {
    filter.category_id = category;
  }

  const articles = await Article.find(filter)
    .populate({ path: "author_id", select: "name" })
    .populate({ path: "category_id", select: "name" })
    .sort(sortKey)
    // Skip the items of all previous pages.
    .skip(page * limit - limit)
    .limit(limit);

  const result = articles.map(mapArticle);

  if (status === ARTICLE_STATUS.PUBLISHED) {
    await setCache(listCacheKey, result, ARTICLE_LIST_TTL_SECONDS);
  }

  return result;
};

/**
 * Count articles matching optional title, status, and category filters.
 *
 * @param {Object} params - Filter options.
 * @param {string} [params.searchTerm=""] - Title search keyword.
 * @param {string} [params.status] - Article status filter.
 * @param {string} [params.category] - Category ID filter.
 * @returns {Promise<number>} Matching article count.
 */
const count = async ({ searchTerm = "", status, category }) => {
  const countCacheKey = `article:count:${generateDigest(searchTerm)}:${category || ""}`;

  if (status === ARTICLE_STATUS.PUBLISHED) {
    const cached = await getCache(countCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const filter = {
    title: { $regex: escapeRegex(searchTerm), $options: "i" },
  };

  if (status) {
    filter.status = status;
  }

  if (category) {
    filter.category_id = category;
  }

  const total = await Article.countDocuments(filter);

  if (status === ARTICLE_STATUS.PUBLISHED) {
    await setCache(countCacheKey, total, ARTICLE_LIST_TTL_SECONDS);
  }

  return total;
};

/**
 * Create a new article.
 *
 * @param {Object} params - Article fields.
 * @param {string} params.title - Article title.
 * @param {string} [params.body=defaults.body] - Article body.
 * @param {string} [params.status=defaults.articleStatus] - Publication status.
 * @param {string} params.author - Author user ID.
 * @param {string} params.category - Category ID.
 * @param {Object} params.file - Validated cover image file.
 * @returns {Promise<Object>} Mapped created article.
 */
const create = async ({
  title,
  body = defaults.body,
  status = defaults.articleStatus,
  author,
  category,
  file,
}) => {
  await validateCategory(category);
  const cover = await storageService.uploadArticleCover(file);

  const article = new Article({
    title,
    body,
    cover_image_url: cover,
    status,
    author_id: author,
    category_id: category,
  });

  await article.save();

  await invalidatePublishedArticleLists();

  await article.populate([
    { path: "author_id", select: "name" },
    { path: "category_id", select: "name" },
  ]);

  return mapArticle(article);
};

/**
 * Fetch a single article with optional related-data expansion.
 *
 * @param {Object} params - Lookup options.
 * @param {string} params.id - Article ID.
 * @param {string} [params.expand=""] - Comma-separated expansions (for example `comments`).
 * @param {Object} [params.user] - Requesting user for draft access checks.
 * @returns {Promise<Object>} Mapped article (status omitted from payload).
 * @throws {Error} When the article is missing or not visible to the caller.
 */
const findSingleItem = async ({ id, expand = "", user }) => {
  const trimmedExpand = expand
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  // Sort the expansions so the same set always maps to the same cache key.
  const expandKey = [...trimmedExpand].sort().join(",");
  const cacheKey = `article:${id}:expand:${expandKey}`;
  // Only anonymous requests are cached, since drafts are visible per user.
  const useCache = !user;

  if (useCache) {
    const cached = await getCache(cacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const article = await Article.findById(id);

  if (!article) {
    throw notFound("Article not found");
  }

  // Non-public articles are hidden unless the caller is the author or an admin.
  const isOwner = user && article.author_id.toString() === user.id.toString();
  const isAdmin = user && user.role === ROLES.ADMIN;

  if (article.status !== ARTICLE_STATUS.PUBLISHED && !isOwner && !isAdmin) {
    throw notFound("Article not found");
  }

  await article.populate([
    { path: "author_id", select: "name" },
    { path: "category_id", select: "name" },
  ]);

  // populate comments if requested
  if (trimmedExpand.includes("comments")) {
    await article.populate({
      path: "comments",
      match: { status: COMMENT_STATUS.PUBLIC },
      populate: { path: "author_id", select: "name" },
    });
  }

  const obj = mapArticle(article);

  // Public API shape omits internal status fields.
  delete obj.status;

  // hide status from comments if exists
  if (obj.comments && Array.isArray(obj.comments)) {
    obj.comments = obj.comments.map((comment) => {
      const normalizedComment = { ...comment };
      normalizedComment.author = normalizedComment.author_id;
      delete normalizedComment.author_id;
      delete normalizedComment.article_id;
      delete normalizedComment.parent_comment_id;
      delete normalizedComment.status;
      return normalizedComment;
    });
  }

  if (useCache) await setCache(cacheKey, obj, ARTICLE_TTL_SECONDS);

  return obj;
};

/**
 * Partially update an article.
 *
 * @param {string} id - Article ID.
 * @param {Object} data - Fields to patch.
 * @param {string} [data.title] - New title.
 * @param {string} [data.body] - New body.
 * @param {string} [data.category] - New category ID.
 * @param {Object} [data.file] - Replacement cover image file.
 * @returns {Promise<Object>} Mapped updated article.
 * @throws {Error} When the article does not exist or the new category is invalid.
 */
const updateItemPatch = async (id, { title, body, category, file }) => {
  const article = await Article.findById(id);

  if (!article) {
    throw notFound();
  }

  if (category !== undefined) await validateCategory(category);

  const previousCover = article.cover_image_url;
  const cover = file
    ? await storageService.uploadArticleCover(file)
    : undefined;

  const payload = {
    title,
    body,
    cover_image_url: cover,
    category_id: category,
  };

  // Apply only the provided fields.
  Object.keys(payload).forEach((key) => {
    article[key] = payload[key] ?? article[key];
  });

  await article.save();

  // The replaced cover is no longer referenced.
  if (cover) await storageService.removeArticleCover(previousCover);

  await invalidateArticleResource(id);
  await invalidatePublishedArticleLists();

  await article.populate([
    { path: "author_id", select: "name" },
    { path: "category_id", select: "name" },
  ]);

  return mapArticle(article);
};

/**
 * Update only the article status.
 *
 * @param {string} id - Article ID.
 * @param {string} status - New article status.
 * @returns {Promise<Object>} Mapped updated article.
 * @throws {Error} When the article does not exist.
 */
const updateStatus = async (id, status) => {
  const article = await Article.findById(id);

  if (!article) {
    throw notFound();
  }

  article.status = status;
  await article.save();

  await invalidateArticleResource(id);
  await invalidatePublishedArticleLists();

  await article.populate([
    { path: "author_id", select: "name" },
    { path: "category_id", select: "name" },
  ]);

  return mapArticle(article);
};

/**
 * Delete an article by ID.
 *
 * @param {string} id - Article ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object|null>} Deleted article document, or null when missing.
 */
const deleteItem = async (id, session) => {
  const query = Article.findByIdAndDelete(id);
  if (session) query.session(session);
  const deleted = await query;

  if (deleted) {
    await invalidateArticleResource(id);
    await invalidatePublishedArticleLists();
  }

  return deleted;
};

/**
 * Delete multiple articles matching a filter.
 *
 * @param {Object} filter - MongoDB filter.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<boolean>} True when `deleteMany` ran.
 */
const deleteMany = async (filter, session) => {
  const result = await Article.deleteMany(
    filter,
    session ? { session } : undefined,
  );

  if (result) {
    await invalidatePublishedArticleLists();
  }

  return !!result;
};

/**
 * Find an article by ID.
 *
 * @param {string} id - Article ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Object|null>} Article document, or null when missing.
 */
const findArticleById = async (id, session) => {
  const query = Article.findById(id);
  if (session) query.session(session);
  return query;
};

/**
 * Find the IDs and cover URLs of all articles by a user.
 *
 * @param {string} id - User ID.
 * @param {import("mongoose").ClientSession} [session] - Optional MongoDB session.
 * @returns {Promise<Array<{id: import("mongoose").Types.ObjectId, cover: string}>>} Article IDs and cover URLs.
 */
const findArticlesByUser = async (id, session) => {
  const query = Article.find({ author_id: id }).select("_id cover_image_url");
  if (session) query.session(session);

  const articles = await query;
  return articles.map((article) => ({
    id: article._id,
    cover: article.cover_image_url,
  }));
};

/**
 * Return whether `userId` authored the article.
 *
 * @param {Object} params - Ownership check fields.
 * @param {string} params.resourceId - Article ID.
 * @param {string} params.userId - Authenticated user ID.
 * @returns {Promise<boolean>} True when the user is the author.
 * @throws {Error} When the article does not exist.
 */
const checkOwner = async ({ resourceId, userId }) => {
  const article = await findArticleById(resourceId);

  if (!article) {
    throw notFound();
  }

  return article.author_id.toString() === userId.toString();
};

module.exports = {
  findAll,
  count,
  create,
  findSingleItem,
  updateItemPatch,
  updateStatus,
  deleteItem,
  checkOwner,
  findArticleById,
  findArticlesByUser,
  deleteMany,
};
