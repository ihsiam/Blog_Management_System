const Article = require("../../model/Article");
const defaults = require("../../config/defaults");
const { notFound, badRequest } = require("../../utils/error");

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
}) => {
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;

  // build query filter
  const filter = {
    title: { $regex: searchTerm, $options: "i" },
  };

  if (status) {
    filter.status = status;
  }

  // retrieve articles
  const articles = await Article.find(filter)
    .populate({ path: "author", select: "name" })
    .sort(sortKey)
    .skip(page * limit - limit)
    .limit(limit);

  return articles.map((article) => article.toObject());
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
const count = async ({ searchTerm = "", status }) => {
  // build query filter
  const filter = {
    title: { $regex: searchTerm, $options: "i" },
  };

  if (status) {
    filter.status = status;
  }

  // count and return
  return Article.countDocuments(filter);
};

/**
 * Creates a new article.
 *
 * @param {Object} params
 * @param {string} params.title
 * @param {string} [params.body]
 * @param {string} [params.cover]
 * @param {string} params.status
 * @param {string} params.author
 *
 * @returns {Promise<Object>}
 */
const create = async ({
  title,
  body = defaults.body,
  cover = defaults.cover,
  status = defaults.articleStatus,
  author,
}) => {
  const article = new Article({ title, body, cover, status, author });

  await article.save();

  return article.toObject();
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
const findSingleItem = async ({ id, expand = "" }) => {
  const trimmedExpand = expand
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const article = await Article.findById(id);

  if (!article) {
    throw notFound("Article not found");
  }

  // only published article can be retrieved
  if (article.status !== "published") {
    throw notFound("Article not found");
  }

  // populate author if requested
  if (trimmedExpand.includes("author")) {
    await article.populate({ path: "author", select: "name" });
  }

  // populate comments if requested
  if (trimmedExpand.includes("comments")) {
    await article.populate({
      path: "comments",
      match: { status: "public" },
    });
  }

  const obj = article.toObject();

  // hide status from article
  delete obj.status;

  // hide status from comments if exists
  if (obj.comments && Array.isArray(obj.comments)) {
    obj.comments = obj.comments.map((comment) => {
      // eslint-disable-next-line no-unused-vars, no-shadow
      const { article, status, ...rest } = comment; // both removed
      return rest;
    });
  }
  return obj;
};

/**
 * Creates or updates an article
 *
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<{article: Object, statusCode: number}>}
 */
const updateOrCreate = async (
  id,
  { title, body, cover, status = defaults.articleStatus, author },
) => {
  const article = await Article.findById(id);

  // create flow
  if (!article) {
    if (!title || typeof title !== "string" || !title.trim()) {
      throw badRequest(
        [{ field: "title", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }

    const newArticle = await create({ title, body, cover, status, author });

    return { article: newArticle, statusCode: 201 };
  }

  // update flow
  const payload = { title, body, cover, status, author };

  Object.keys(payload).forEach((key) => {
    article[key] = payload[key] ?? article[key];
  });

  await article.save();

  return { article: article.toObject(), statusCode: 200 };
};

/**
 * Partially updates an article.
 *
 * @param {string} id
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const updateItemPatch = async (id, { title, body, cover, status }) => {
  const article = await Article.findById(id);

  if (!article) {
    throw notFound();
  }

  // updated payload
  const payload = { title, body, cover, status };

  Object.keys(payload).forEach((key) => {
    article[key] = payload[key] ?? article[key];
  });

  // save into DB
  await article.save();

  return article.toObject();
};

/**
 * Deletes an article by ID.
 *
 * @param {string} id
 * @returns {Promise<Object>}
 */
const deleteItem = (id) => Article.findByIdAndDelete(id);

/**
 * Deletes multiple articles based on filter.
 *
 * @param {Object} filter
 * @returns {Promise<boolean>}
 */
const deleteMany = async (filter) => {
  const result = await Article.deleteMany(filter);
  return !!result;
};

/**
 * Finds article by ID.
 *
 * @param {string} id
 * @returns {Promise<Object|null>}
 */
const findArticleById = async (id) => Article.findById(id);

/**
 * Finds all article IDs by a user.
 *
 * @param {string} id - User ID
 * @returns {Promise<Array<string>>}
 */
const findArticlesByUser = async (id) => {
  const articles = await Article.find({ author: id }).select("_id");
  return articles.map((article) => article._id);
};

/**
 * Checks article ownership.
 *
 * @param {Object} params
 * @param {string} params.resourceId
 * @param {string} params.userId
 * @param {boolean} [params.allowMissing=false]
 *
 * @returns {Promise<boolean|null>}
 */
const checkOwner = async ({ resourceId, userId, allowMissing = false }) => {
  const article = await findArticleById(resourceId);

  if (!article) {
    if (allowMissing) return null;
    throw notFound();
  }

  return article.author.toString() === userId.toString();
};

module.exports = {
  findAll,
  count,
  create,
  findSingleItem,
  updateOrCreate,
  updateItemPatch,
  deleteItem,
  checkOwner,
  findArticleById,
  findArticlesByUser,
  deleteMany,
};
