const Article = require("../../model/Article");
const defaults = require("../../config/defaults");
const { notFound } = require("../../utils/error");

// find all articles
const findAll = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortBy = defaults.sortBy,
  sortType = defaults.sortType,
  searchTerm = defaults.searchTerm,
}) => {
  const sortKey = `${sortType === "dsc" ? "-" : ""}${sortBy}`;
  const filter = { title: { $regex: searchTerm, $options: "i" } };
  const articles = await Article.find(filter)
    .populate({ path: "author", select: "name" })
    .sort(sortKey)
    .skip(page * limit - limit)
    .limit(limit);

  return articles.map((article) => ({
    ...article._doc,
  }));
};

// count articles
const count = async ({ searchTerm = "" }) => {
  const filter = { title: { $regex: searchTerm, $options: "i" } };
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
  if (!title || !author) {
    const error = new Error("Invalid parameters");
    error.status = 400;
    throw error;
  }

  const article = new Article({
    title,
    body,
    cover,
    status,
    author,
  });

  await article.save();
  return article._doc;
};

// find single item
const findSingleItem = async ({ id, expand = "" }) => {
  if (!id) {
    throw new Error("Id required");
  }

  const TrimmedExpand = expand.split(",").map((item) => item.trim());

  const article = await Article.findById(id);

  if (!article) {
    throw notFound();
  }

  if (TrimmedExpand.includes("author")) {
    await article.populate({ path: "author", select: "name" });
  }

  if (TrimmedExpand.includes("comments")) {
    await article.populate({ path: "comments", match: { status: "public" } });

    // empty array if no comment exists
    article.comments = article.comments ?? [];
  }

  return article._doc;
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
  const article = await Article.findById(id);

  if (!article) {
    const newArticle = await create({
      title,
      body,
      cover,
      status,
      author,
    });

    return { article: newArticle, statusCode: 201 };
  }

  const payload = {
    title,
    body,
    cover,
    status,
    author,
  };

  article.overwrite(payload);
  await article.save();
  return { article: article._doc, statusCode: 200 };
};

// update item using patch
const updateItemPatch = async (id, { title, body, cover, status }) => {
  const article = await Article.findById(id);

  if (!article) {
    throw notFound();
  }
  const payload = { title, body, cover, status };

  Object.keys(payload).forEach((key) => {
    article[key] = payload[key] ?? article[key];
  });

  await article.save();
  return article._doc;
};

const deleteItem = async (id) => {
  const article = await Article.findById(id);

  if (!article) {
    throw notFound();
  }

  // todo: need to delete all associated articles
  return Article.findByIdAndDelete(id);
};

const CheckOwner = async ({ resourceId, userId }) => {
  const article = await Article.findById(resourceId);

  if (!article) {
    throw notFound();
  }

  if (article.author.toString() === userId.toString()) {
    return true;
  }

  return false;
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
};
