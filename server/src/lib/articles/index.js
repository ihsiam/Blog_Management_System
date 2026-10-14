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

const ARTICLE_LIST_TTL_SECONDS = 60;
const ARTICLE_TTL_SECONDS = 300;

/**
 * Ensures an article references an active category.
 *
 * @param {string} category - Category ID
 * @returns {Promise<void>}
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
    // only a missing/unavailable category is a client error
    if (err.statusCode !== 404) throw err;

    throw badRequest(
      [{ field: "category", message: "invalid input", in: "body" }],
      "invalid input",
    );
  }
};

/**
 * Drops public article list and count keys.
 *
 * @returns {Promise<void>}
 */
const invalidatePublishedArticleLists = async () => {
  await deleteCachePattern("article:list:*");
  await deleteCachePattern("article:count:*");
};

/**
 * Drops single-article keys (exact author key + expand variants).
 *
 * @param {string} id - Article ID
 * @returns {Promise<void>}
 */
const invalidateArticleResource = async (id) => {
  await deleteCache(`article:${id}:author`);
  await deleteCachePattern(`article:${id}:expand:*`);
};

/**
 * Retrieves paginated articles with optional filtering.
 *
 * @param {Object} params
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.sortBy - Field to sort by
 * @param {string} params.sortType - Sorting order (asc | desc)
 * @param {string} params.searchTerm - Search keyword
 * @param {string} [params.status] - Article status filter
 *
 * @returns {Promise<Array<Object>>}
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
  // digest keeps the key short and safe even for arbitrary search input
  const listCacheKey = `article:list:${page}:${limit}:${sortBy}:${sortType}:${generateDigest(searchTerm)}:${category || ""}`;

  if (status === ARTICLE_STATUS.PUBLISHED) {
    const cached = await getCache(listCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  // build query filter
  const filter = {
    title: { $regex: escapeRegex(searchTerm), $options: "i" },
  };

  if (status) {
    filter.status = status;
  }

  if (category) {
    filter.category_id = category;
  }

  // retrieve articles
  const articles = await Article.find(filter)
    .populate({ path: "author_id", select: "name" })
    .populate({ path: "category_id", select: "name" })
    .sort(sortKey)
    .skip(page * limit - limit)
    .limit(limit);

  const result = articles.map(mapArticle);

  if (status === ARTICLE_STATUS.PUBLISHED) {
    await setCache(listCacheKey, result, ARTICLE_LIST_TTL_SECONDS);
  }

  return result;
};

/**
 * Counts total articles based on filter.
 *
 * @param {Object} params
 * @param {string} params.searchTerm
 * @param {string} [params.status]
 *
 * @returns {Promise<number>}
 */
const count = async ({ searchTerm = "", status, category }) => {
  const countCacheKey = `article:count:${generateDigest(searchTerm)}:${category || ""}`;

  if (status === ARTICLE_STATUS.PUBLISHED) {
    const cached = await getCache(countCacheKey);
    if (cached !== null) {
      return cached;
    }
  }

  // build query filter
  const filter = {
    title: { $regex: escapeRegex(searchTerm), $options: "i" },
  };

  if (status) {
    filter.status = status;
  }

  if (category) {
    filter.category_id = category;
  }

  // count and return
  const total = await Article.countDocuments(filter);

  if (status === ARTICLE_STATUS.PUBLISHED) {
    await setCache(countCacheKey, total, ARTICLE_LIST_TTL_SECONDS);
  }

  return total;
};

/**
 * Creates a new article.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} [params.body]
 * @param {string} params.status
 * @param {string} params.author
 * @param {Object} params.file - Validated cover image file
 *
 * @returns {Promise<Object>}
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
 * Retrieves a single article with optional population.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {string} [params.expand]
 *
 * @returns {Promise<Object>}
 */
const findSingleItem = async ({ id, expand = "", user }) => {
  const trimmedExpand = expand
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const expandKey = [...trimmedExpand].sort().join(",");
  const cacheKey = `article:${id}:expand:${expandKey}`;
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

  // only published article can be retrieved
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

  // hide status from article
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
 * Partially updates an article.
 *
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
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

  Object.keys(payload).forEach((key) => {
    article[key] = payload[key] ?? article[key];
  });

  await article.save();

  // the replaced cover is no longer referenced
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
 * Updates only the article status.
 *
 * @param {string} id - Article ID
 * @param {string} status - New article status
 * @returns {Promise<Object>}
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
 * Deletes an article by ID.
 *
 * @param {string} id
 * @returns {Promise<Object>}
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
 * Deletes multiple articles based on filter.
 *
 * @param {Object} filter
 * @returns {Promise<boolean>}
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
 * Finds article by ID.
 *
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const findArticleById = async (id, session) => {
  const query = Article.findById(id);
  if (session) query.session(session);
  return query;
};

/**
 * Finds the IDs and cover URLs of all articles by a user.
 *
 * @param {string} id - User ID
 * @param {ClientSession} [session] - Optional MongoDB session
 * @returns {Promise<Array<{id: ObjectId, cover: string}>>}
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
 * Checks article ownership.
 *
 * @param {Object} params
 * @param {string} params.resourceId
 * @param {string} params.userId
 *
 * @returns {Promise<boolean>}
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
