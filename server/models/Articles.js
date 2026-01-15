/* eslint-disable class-methods-use-this */
const connection = require('../db');

class Article {
    constructor() {
        this.articles = [];
        // this.init();
    }

    async init() {
        const db = await connection.getDB();
        this.articles = db.articles;
    }

    async find() {
        return this.articles;
    }

    async findById(id) {
        return this.articles.find((article) => article.id === id);
    }

    async findByProp(prop) {
        return this.articles.find((article) => article[prop] === prop);
    }

    async search(term) {
        return this.articles.filter((article) => article.title.toLowerCase().includes(term));
    }

    async sort(articles, sortType = 'asc', sortBy = 'updatedAt') {
        let result;
        if (sortType === 'asc') {
            result = await this.sortAsc(articles, sortBy);
        }
        if (sortType === 'dsc') {
            result = await this.sortDsc(articles, sortBy);
        }
        return result;
    }

    async pagination(articles, page, limit) {
        const skip = page * limit - limit;
        const totalItems = articles.length;
        const totalPage = Math.ceil(totalItems / limit);
        const result = articles.slice(skip, skip + limit);

        const hasNext = page < totalPage;
        const hasPrev = page > 1;

        return {
            result,
            totalItems,
            totalPage,
            hasNext,
            hasPrev,
        };
    }

    async sortAsc(articles, sortBy) {
        return articles.sort((a, b) => a[sortBy].toString().localeCompare(b[sortBy].toString()));
    }

    async sortDsc(articles, sortBy) {
        return articles.sort((a, b) => b[sortBy].toString().localeCompare(a[sortBy].toString()));
    }
}

module.exports = Article;
