/* eslint-disable camelcase */
require('dotenv').config();
const express = require('express');
const swaggerUI = require('swagger-ui-express');
const YAML = require('yamljs');
const connection = require('./db');

const swaggerDocs = YAML.load('./swagger.yaml');

// express app
const app = express();
app.use(express.json());
app.use('/docs', swaggerUI.serve, swaggerUI.setup(swaggerDocs));

app.get('/health', (_req, res) => {
    res.status(200).json({
        health: 'ok',
    });
});

app.get('/api/v1/articles', async (req, res) => {
    // extract params
    const page = +req.query.page || 1;
    const limit = +req.query.limit || 10;
    const sort_type = req.query.sort_type || 'asc';
    const sort_by = req.query.sort_by || 'updatedAt';
    const search = req.query.search || '';

    // fetch data
    const db = await connection.getDB();
    let { articles } = db;

    // search
    if (search) {
        articles = articles.filter((article) => article.title.toLowerCase().includes(search));
    }

    // sorting
    articles.sort((a, b) => {
        if (sort_type === 'asc') {
            if (a[sort_by] > b[sort_by]) {
                return 1;
            }
            if (a[sort_by] < b[sort_by]) {
                return -1;
            }
            return 0;
        }
        if (sort_type === 'dsc') {
            if (b[sort_by] > a[sort_by]) {
                return 1;
            }
            if (b[sort_by] < a[sort_by]) {
                return -1;
            }
            return 0;
        }
        return 0;
    });

    // pagination

    // transform article
    const transformArticle = articles.map((article) => {
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

    // response object
    const response = {
        code: 200,
        message: 'Data retrived',
        data: transformArticle,
        Pagination: {
            page,
            limit,
            next: 3,
            prev: 1,
            totalPage: Math.ceil(articles.length / limit),
            totalItems: articles.length,
        },
        links: {
            self: `/articles?page=${page}&limit=${limit}`,
            next: `/articles?page=${page + 1}&limit=${limit}`,
            prev: `/articles?page=${page - 1}&limit=${limit}`,
        },
    };

    res.status(200).json(response);
});

app.listen(process.env.PORT, () => {
    console.log('server is running');
    console.log('http://localhost:4000');
});
