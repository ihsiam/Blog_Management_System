const defaults = require("../config/defaults");
const generateQueryString = require("./queryString");

/**
 * Generates pagination metadata for list responses.
 *
 * @param {number} [page=defaults.page] - Current page number
 * @param {number} [limit=defaults.limit] - Items per page
 * @param {number} [totalItems=defaults.totalItems] - Total number of items
 *
 * @returns {Object} Pagination metadata object
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
 * Transforms an array of objects based on selected fields.
 *
 * @param {Object} params
 * @param {Array<Object>} params.items - Data items to transform
 * @param {Array<string>} params.selection - Fields to include in output
 * @param {string} [params.path=""] - Base path for generating item links
 *
 * @returns {Array<Object>} Transformed data array
 *
 * @throws {Error} If items or selection are not valid arrays
 */
const transformData = ({ items = [], selection = [], path = "" }) => {
  // validate input types
  if (!Array.isArray(items) || !Array.isArray(selection)) {
    throw new Error("Invalid arguments");
  }

  // if no selection provided, return full object with link
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
 * Generates HATEOAS navigation links.
 *
 * @param {Object} params
 * @param {string} [params.url="/"] - Current request URL
 * @param {string} [params.path=""] - Base API path
 * @param {Object} [params.query={}] - Original query parameters
 * @param {boolean} [params.hasNext=false] - Whether next page exists
 * @param {boolean} [params.hasPrev=false] - Whether previous page exists
 * @param {number} [params.page=defaults.page] - Current page number
 *
 * @returns {Object} HATEOAS links object
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

module.exports = {
  getPagination,
  transformData,
  hateOAS,
};
