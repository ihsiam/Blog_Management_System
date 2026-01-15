/* eslint-disable max-len */
/* eslint-disable prettier/prettier */
/* eslint-disable camelcase */
/* eslint-disable object-curly-newline */
/* eslint-disable comma-dangle */
const Article = require('../models/Articles');
const dbConnection = require('../db');

const findArticles = async ({
    page = 1,
    limit = 10,
    sort_type = 'asc',
    sort_by = 'updatedAt',
    search = '',
}) => {
    // article instance
    const articleInstance = new Article(dbConnection.db.articles);

    let articles;

    // search
    if (search) {
        articles = await articleInstance.search(search);
    } else {
        articles = await articleInstance.find();
    }

    // sorting
    articles = [...articles];
    articles = await articleInstance.sort(articles, sort_type, sort_by);

    // pagination
    const { result, totalItems, totalPage, hasNext, hasPrev } = await articleInstance.pagination(
        articles,
        page,
        limit
    );

    return { totalItems, totalPage, hasNext, hasPrev, articles: result };
};

const transformarticles = ({ articles = [] }) => articles.map((article) => {
        const transform = { ...article };
        transform.author = {
            id: transform.authorId,
            // todo
        };
        transform.link = `/api/v1/articles/${transform.id}`;
        delete transform.body;
        delete transform.authorId;
        return transform;
    });

const createArticle = async ({ title, body, cover = '', status = 'draft', authorId }) => {
    const articleInstance = new Article(dbConnection.db.articles);
    const article = await articleInstance.create({ title, body, cover, status, authorId }, dbConnection);

    return article;
};

module.exports = {
    findArticles,
    transformarticles,
    createArticle
};
