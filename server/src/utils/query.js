const defaults = require("../config/defaults");
const generateQueryString = require("./queryString");

// generate pagination
const getPagination = (
  page = defaults.page,
  limit = defaults.limit,
  totalItems = defaults.totalItems,
) => {
  // total page count
  const totalPage = Math.ceil(totalItems / limit);

  // pagination
  const pagination = {
    page,
    limit,
    totalItems,
    totalPage,
  };

  // Add next page only if current page is not the last page
  if (page < totalPage) {
    pagination.next = page + 1;
  }

  // Add previous page only if current page is greater than 1
  if (page > 1) {
    pagination.prev = page - 1;
  }

  return pagination;
};

// transform data based on selection items
const transformData = ({ items = [], selection = [], path = "/" }) => {
  if (!Array.isArray(items) || !Array.isArray(selection)) {
    throw new Error("Invalid arguments");
  }

  // if no selection field then return full data
  if (selection.length === 0) {
    return items.map((item) => ({
      ...item,
      link: `${path}/${item._id}`,
    }));
  }

  // selected field with links
  return items.map((item) => {
    const result = {};

    selection.forEach((key) => {
      result[key] = item[key];
    });
    result.link = `${path}/${item._id}`;

    return result;
  });
};

// generate hateOAS for navigation links
const hateOAS = ({
  url = "/",
  path = "",
  query = {},
  hasNext = false,
  hasPrev = false,
  page = defaults.page,
}) => {
  // links
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

module.exports = { getPagination, transformData, hateOAS };
