const Category = require("../../model/Category");
const defaults = require("../../config/defaults");
const { notFound } = require("../../utils/error");

/**
 * Retrieves paginated categories with optional name filtering.
 *
 * @param {Object} params
 * @param {number} params.page
 * @param {number} params.limit
 * @param {string} params.sortBy
 * @param {string} params.sortType
 * @param {string} params.searchTerm
 * @param {string} [params.status="active"]
 *
 * @returns {Promise<Array<Object>>}
 */
const findAll = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortBy = defaults.sortBy,
  sortType = defaults.sortType,
  searchTerm = defaults.searchTerm,
  status = "active",
}) => {
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;
  const filter = {
    name: { $regex: searchTerm, $options: "i" },
    status,
  };

  const categories = await Category.find(filter)
    .sort(sortKey)
    .skip(page * limit - limit)
    .limit(limit);

  return categories.map((category) => category.toObject());
};

/**
 * Counts categories based on the public listing filter.
 *
 * @param {Object} params
 * @param {string} params.searchTerm
 * @param {string} [params.status="active"]
 *
 * @returns {Promise<number>}
 */
const count = async ({ searchTerm = "", status = "active" }) =>
  Category.countDocuments({
    name: { $regex: searchTerm, $options: "i" },
    status,
  });

/**
 * Creates a category.
 *
 * @param {Object} params
 * @param {string} params.name
 * @param {string} [params.description]
 *
 * @returns {Promise<Object>}
 */
const create = async ({ name, description }) => {
  const category = new Category({ name, description });
  await category.save();
  return category.toObject();
};

/**
 * Retrieves a category by ID.
 *
 * @param {Object} params
 * @param {string} params.id
 * @param {boolean} [params.includeUnavailable=false]
 *
 * @returns {Promise<Object>}
 */
const findSingleItem = async ({ id, includeUnavailable = false }) => {
  const filter = includeUnavailable
    ? { _id: id }
    : { _id: id, status: "active" };
  const category = await Category.findOne(filter);

  if (!category) throw notFound("Category not found");
  return category.toObject();
};

/**
 * Updates category details.
 *
 * @param {string} id
 * @param {Object} data
 * @param {string} data.name
 * @param {string|null} [data.description]
 *
 * @returns {Promise<Object>}
 */
const updateItemPatch = async (id, { name, description }) => {
  const category = await Category.findById(id);

  if (!category) throw notFound("Category not found");

  category.name = name;
  if (description !== undefined) category.description = description;
  await category.save();

  return category.toObject();
};

/**
 * Updates category availability status.
 *
 * @param {string} id
 * @param {string} status
 *
 * @returns {Promise<Object>}
 */
const updateStatus = async (id, status) => {
  const category = await Category.findById(id);

  if (!category) throw notFound("Category not found");

  category.status = status;
  await category.save();

  return category.toObject();
};

module.exports = {
  findAll,
  count,
  create,
  findSingleItem,
  updateItemPatch,
  updateStatus,
};
