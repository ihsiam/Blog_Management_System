/* eslint-disable no-underscore-dangle */
/* eslint-disable comma-dangle */
const defaults = require('../config/defaults');
const generateQueryString = require('./queryString');

const getPagination = (
    page = defaults.page,
    limit = defaults.limit,
    totalItems = defaults.totalItems
) => {
    const totalPage = Math.ceil(totalItems / limit);

    const pagination = {
        page,
        limit,
        totalItems,
        totalPage,
    };

    if (page < totalPage) {
        pagination.next = page + 1;
    }

    if (page > 1) {
        pagination.prev = page - 1;
    }

    return pagination;
};

const transformData = ({ items = [], selection = [], path = '/' }) => {
    if (!Array.isArray(items) || !Array.isArray(selection)) {
        throw new Error('Invalid arguments');
    }

    if (selection.length === 0) {
        return items.map((item) => ({
            ...item,
            link: `${path}/${item._id}`,
        }));
    }

    return items.map((item) => {
        const result = {};

        selection.forEach((key) => {
            result[key] = item[key];
        });
        result.link = `${path}/${item._id}`;

        return result;
    });
};

const hateOAS = ({
    url = '/',
    path = '',
    query = {},
    hasNext = false,
    hasPrev = false,
    page = defaults.page,
}) => {
    const links = {
        self: url,
    };

    if (hasNext) {
        const queryStr = generateQueryString({ ...query, page: page + 1 });
        links.next = `${path}?${queryStr}`;
    }

    if (hasPrev) {
        const queryStr = generateQueryString({ ...query, page: page - 1 });
        links.prev = `${path}?${queryStr}`;
    }

    return links;
};

module.exports = { getPagination, transformData, hateOAS };
