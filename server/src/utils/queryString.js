/* eslint-disable implicit-arrow-linebreak */
const generateQueryString = (query) =>
    Object.keys(query)
        .map((key) => `${encodeURIComponent(key)}=${encodeURIComponent(query[key])}`)
        .join('&');

module.exports = generateQueryString;
