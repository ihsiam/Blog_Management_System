const defaults = require("../config/defaults");
const generateQueryString = require("./queryString");

/**
 * Build pagination metadata for list responses.
 *
 * The `next` property is set only when a later page exists, and `prev` only
 * when the current page is greater than 1.
 *
 * @param {number} [page=defaults.page] - Current page number.
 * @param {number} [limit=defaults.limit] - Items per page.
 * @param {number} [totalItems=defaults.totalItems] - Total item count.
 * @returns {Object} Page, limit, totals, and optional `next`/`prev` page numbers.
 */
const getPagination = (
  page = defaults.page,
  limit = defaults.limit,
  totalItems = defaults.totalItems,
) => {
  // total number of pages
  const totalPage = Math.ceil(totalItems / limit);

  // base pagination object
  const pagination = {
    page,
    limit,
    totalItems,
    totalPage,
  };

  // add next page only if current page is not last page
  if (page < totalPage) {
    pagination.next = page + 1;
  }

  // add previous page only if current page is greater than first page
  if (page > 1) {
    pagination.prev = page - 1;
  }

  return pagination;
};

/**
 * Project list items onto selected fields and attach a resource `link`.
 *
 * When `selection` is empty, each item is returned in full with a `link`.
 * When `selection` is not empty, a `link` is added only if `path` is set.
 *
 * @param {Object} params - Transform options.
 * @param {Array<Object>} [params.items=[]] - Items to transform.
 * @param {Array<string>} [params.selection=[]] - Field names to keep.
 * @param {string} [params.path=""] - Base path for item links.
 * @returns {Array<Object>} Transformed items.
 * @throws {Error} When `items` or `selection` is not an array.
 */
const transformData = ({ items = [], selection = [], path = "" }) => {
  // validate input types
  if (!Array.isArray(items) || !Array.isArray(selection)) {
    throw new Error("Invalid arguments");
  }

  // An empty selection keeps every field.
  if (selection.length === 0) {
    return items.map((item) => ({
      ...item,
      link: `${path}/${item.id}`,
    }));
  }

  // transform only selected fields
  return items.map((item) => {
    const result = {};

    // pick only allowed fields
    selection.forEach((key) => {
      result[key] = item[key];
    });

    // attach resource link if path provided
    if (path) {
      result.link = `${path}/${item.id}`;
    }

    return result;
  });
};

/**
 * Build HATEOAS `self`, `next`, and `prev` links for a list response.
 *
 * The `next` and `prev` links are included only when `hasNext` or `hasPrev`
 * is true.
 *
 * @param {Object} params - Link options.
 * @param {string} [params.url="/"] - Current request URL.
 * @param {string} [params.path=""] - Base API path.
 * @param {Object} [params.query={}] - Original query parameters.
 * @param {boolean} [params.hasNext=false] - Whether a next page exists.
 * @param {boolean} [params.hasPrev=false] - Whether a previous page exists.
 * @param {number} [params.page=defaults.page] - Current page number.
 * @returns {Object} Links object.
 */
const hateOAS = ({
  url = "/",
  path = "",
  query = {},
  hasNext = false,
  hasPrev = false,
  page = defaults.page,
}) => {
  // base links object
  const links = {
    self: url,
  };

  // next page link
  if (hasNext) {
    const queryStr = generateQueryString({ ...query, page: page + 1 });
    links.next = `${path}?${queryStr}`;
  }

  // previous page link
  if (hasPrev) {
    const queryStr = generateQueryString({ ...query, page: page - 1 });
    links.prev = `${path}?${queryStr}`;
  }

  return links;
};

/**
 * Escape regex metacharacters in user input used with `$regex`.
 *
 * @param {*} value - Raw search value from the request.
 * @returns {string} Literal-safe pattern.
 */
const escapeRegex = (value) =>
  // prefix every regex metacharacter with a backslash
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

module.exports = {
  escapeRegex,
  getPagination,
  transformData,
  hateOAS,
};
