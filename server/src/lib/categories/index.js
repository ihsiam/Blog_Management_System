const Category = require("../../model/Category");
const defaults = require("../../config/defaults");
const { CATEGORY_STATUS } = require("../../config/constants");
const { notFound } = require("../../utils/error");
const { escapeRegex } = require("../../utils/query");

/**
 * List paginated categories with optional name and status filtering.
 *
 * @param {Object} params - Query options.
 * @param {number} [params.page=defaults.page] - Page number.
 * @param {number} [params.limit=defaults.limit] - Items per page.
 * @param {string} [params.sortBy=defaults.sortBy] - Field to sort by.
 * @param {string} [params.sortType=defaults.sortType] - Sort order (`asc` or `desc`).
 * @param {string} [params.searchTerm=defaults.searchTerm] - Name search keyword.
 * @param {string} [params.status] - Status filter; all statuses when omitted.
 * @returns {Promise<Array<Object>>} Plain category objects.
 */
const findAll = async ({
  page = defaults.page,
  limit = defaults.limit,
  sortBy = defaults.sortBy,
  sortType = defaults.sortType,
  searchTerm = defaults.searchTerm,
  status,
}) => {
  // A leading minus sorts in descending order.
  const sortKey = `${sortType === "desc" ? "-" : ""}${sortBy}`;
  const filter = {
    name: { $regex: escapeRegex(searchTerm), $options: "i" },
  };

  if (status) filter.status = status;

  const categories = await Category.find(filter)
    .sort(sortKey)
    // Skip the items of all previous pages.
    .skip(page * limit - limit)
    .limit(limit);

  return categories.map((category) => category.toObject());
};

/**
 * Count categories matching optional name and status filters.
 *
 * @param {Object} params - Filter options.
 * @param {string} [params.searchTerm=""] - Name search keyword.
 * @param {string} [params.status] - Status filter; all statuses when omitted.
 * @returns {Promise<number>} Matching category count.
 */
const count = async ({ searchTerm = "", status }) =>
  Category.countDocuments({
    name: { $regex: escapeRegex(searchTerm), $options: "i" },
    ...(status && { status }),
  });

/**
 * Create a category.
 *
 * @param {Object} params - Category fields.
 * @param {string} params.name - Category name.
 * @param {string} [params.description] - Category description.
 * @returns {Promise<Object>} Created category as a plain object.
 */
const create = async ({ name, description }) => {
  const category = new Category({ name, description });
  await category.save();
  return category.toObject();
};

/**
 * Fetch a category by ID.
 *
 * Unless `includeUnavailable` is true, only categories with the active status
 * are returned.
 *
 * @param {Object} params - Lookup options.
 * @param {string} params.id - Category ID.
 * @param {boolean} [params.includeUnavailable=false] - Include unavailable categories when true.
 * @returns {Promise<Object>} Category as a plain object.
 * @throws {Error} When the category is missing or unavailable.
 */
const findSingleItem = async ({ id, includeUnavailable = false }) => {
  const filter = includeUnavailable
    ? { _id: id }
    : { _id: id, status: CATEGORY_STATUS.ACTIVE };
  const category = await Category.findOne(filter);

  if (!category) throw notFound("Category not found");
  return category.toObject();
};

/**
 * Update category name and/or description.
 *
 * @param {string} id - Category ID.
 * @param {Object} data - Fields to patch.
 * @param {string} [data.name] - New name.
 * @param {string|null} [data.description] - New description.
 * @returns {Promise<Object>} Updated category as a plain object.
 * @throws {Error} When the category does not exist.
 */
const updateItemPatch = async (id, { name, description }) => {
  const category = await Category.findById(id);

  if (!category) throw notFound("Category not found");

  // Unlike `name`, `description` may be set to `null` to clear it.
  if (name !== undefined) category.name = name;
  if (description !== undefined) category.description = description;
  await category.save();

  return category.toObject();
};

/**
 * Update category availability status.
 *
 * @param {string} id - Category ID.
 * @param {string} status - New category status.
 * @returns {Promise<Object>} Updated category as a plain object.
 * @throws {Error} When the category does not exist.
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
