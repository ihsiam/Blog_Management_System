/* eslint-disable prettier/prettier */
const Article = require('../../model/Article');
const defaults = require('../../config/defaults');

// find all articles
const findAll = async ({
    page = defaults.page,
    limit = defaults.limit,
    sortBy = defaults.sortBy,
    sortType = defaults.sortType,
    searchTerm = defaults.searchTerm,
}) => {
    const sortKey = `${sortType === 'dsc' ? '-' : ''}${sortBy}`;
    const filter = { title: { $regex: searchTerm, $options: 'i' } };
    const articles = await Article.find(filter)
       // .populate({ path: 'author', select: 'name' })
        .sort(sortKey)
        .skip(page * limit - limit)
        .limit(limit);
    return articles;
};

// count articles
const count = async ({ searchTerm = '' }) => {
    const filter = { title: { $regex: searchTerm, $options: 'i' } };
    const totalArticle = await Article.countDocuments(filter);
    return totalArticle;
};

// create an article
const create = async ({
 title, body = defaults.body, cover = defaults.cover, status = defaults.articleStatus, author,
}) => {
    if (!title || !author) {
        const error = new Error('Invalid parameters');
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

    const result = await article.save();
    return result;
};

module.exports = { findAll, count, create };
