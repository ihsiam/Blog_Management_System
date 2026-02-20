const Article = require("../../model/Article");
const defaults = require("../../config/defaults");
const { notFound, badRequest } = require("../../utils/error");
const UserServices = require("../user");

// find all articles
const findAll = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortBy = defaults.sortBy,
  sortType = defaults.sortType,
  searchTerm = defaults.searchTerm,
}) => {
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;
  const filter = { title: { $regex: searchTerm, $options: "i" } };

  // find articles
  const articles = await Article.find(filter)
    .populate({ path: "author", select: "name" })
    .sort(sortKey)
    .skip(page * limit - limit)
    .limit(limit);

  return articles.map((article) => article.toObject());
};

// count articles
const count = async ({ searchTerm = "" }) => {
  const filter = { title: { $regex: searchTerm, $options: "i" } };
  // count article
  const totalArticle = await Article.countDocuments(filter);

  return totalArticle;
};

// create an article
const create = async ({
  title,
  body = defaults.body,
  cover = defaults.cover,
  status = defaults.articleStatus,
  author,
}) => {
  // create article
  const article = new Article({ title, body, cover, status, author });

  await article.save();

  return article.toObject();
};

// find single item
const findSingleItem = async ({ id, expand = "" }) => {
  const TrimmedExpand = expand
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  // find article
  const article = await Article.findById(id);

  // if not found
  if (!article) {
    throw notFound();
  }

  // expand author
  if (TrimmedExpand.includes("author")) {
    await article.populate({ path: "author", select: "name" });
  }

  // expand comments
  if (TrimmedExpand.includes("comments")) {
    await article.populate({ path: "comments", match: { status: "public" } });
  }

  return article.toObject();
};

// create or update an item
const updateOrCreate = async (
  id,
  {
    title,
    body,
    cover = defaults.cover,
    status = defaults.articleStatus,
    author,
  },
) => {
  // find article
  const article = await Article.findById(id);

  // if not found, create new
  if (!article) {
    // if title not found for creation phase
    if (!title || typeof title !== "string" || !title.trim()) {
      throw badRequest(
        [{ field: "title", message: "invalid input", in: "body" }],
        "invalid input",
      );
    }

    // create article
    const newArticle = await create({ title, body, cover, status, author });
    return { article: newArticle, statusCode: 201 };
  }

  // if found, update
  const payload = { title, body, cover, status, author };
  Object.keys(payload).forEach((key) => {
    article[key] = payload[key] ?? article[key];
  });

  await article.save();

  return { article: article.toObject(), statusCode: 200 };
};

// update item using patch
const updateItemPatch = async (id, { title, body, cover, status }) => {
  // find article
  const article = await Article.findById(id);

  // if not found
  if (!article) {
    throw notFound();
  }

  // update article
  const payload = { title, body, cover, status };
  Object.keys(payload).forEach((key) => {
    article[key] = payload[key] ?? article[key];
  });

  await article.save();

  return article.toObject();
};

// delete item
const deleteItem = async (id) => {
  // find article
  const article = await Article.findById(id);

  // if not found
  if (!article) {
    throw notFound();
  }

  // todo: delete all associated articles if needed
  return Article.findByIdAndDelete(id);
};

// find article by id
const findArticleById = async (id) => {
  const article = await Article.findById(id);

  return article;
};

// check ownership
const CheckOwner = async ({ resourceId, userId, allowMissing = false }) => {
  // find article
  const article = await findArticleById(resourceId);

  // if not found
  if (!article) {
    // for put method
    if (allowMissing) {
      return null;
    }
    throw notFound();
  }

  return article.author.toString() === userId.toString();
};

const getArticleAuthor = async (articleID) => {
  // find article
  const article = await findSingleItem({ id: articleID });

  // if article not found
  if (!article) {
    throw notFound();
  }

  // find user
  const user = await UserServices.findUserById(article.author);

  return user;
};

module.exports = {
  findAll,
  count,
  create,
  findSingleItem,
  updateOrCreate,
  updateItemPatch,
  deleteItem,
  CheckOwner,
  findArticleById,
  getArticleAuthor,
};
