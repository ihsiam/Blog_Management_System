/* eslint-disable prettier/prettier */
/* eslint-disable camelcase */
/* eslint-disable object-curly-newline */
/* eslint-disable comma-dangle */
const Article = require('../models/Articles');

const findArticles = async ({
    page = 1,
    limit = 10,
    sort_type = 'asc',
    sort_by = 'updatedAt',
    search = '',
}) => {
    const articleInstance = new Article();
    await articleInstance.init();

    let articles;

    // search
    if (search) {
        articles = await articleInstance.search(search);
    } else {
        articles = await articleInstance.find();
    }

    // sorting
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
        transform.link = `/articles/${transform.id}`;
        delete transform.body;
        delete transform.authorId;
        return transform;
    });

module.exports = {
    findArticles,
    transformarticles
};
